import {
  parseAssessmentResponse, validateAssessmentView, validateRequirementRows,
} from './nash-assessment-contract.js';
import { buildRequirementReviewPrompt } from './nash-assessment-prompts.js';
import { solutionGuidanceText } from './nash-assessment-guidance.js';
import {
  applyAssessmentReview, buildAssessmentReviewCorrectionMessages, buildAssessmentReviewMessages,
} from './nash-assessment-review.js';

export async function fetchSkillsText(slugs) {
  const parts = await Promise.all(slugs.map(async (slug) => {
    try {
      const response = await fetch(`/solutions/${slug}.plain.html`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const div = document.createElement('div');
      div.innerHTML = await response.text();
      const text = div.textContent.replace(/\n{3,}/g, '\n\n').trim();
      if (!text) throw new Error('empty authored content');
      return { slug, text };
    } catch (error) {
      return { slug, error: error.message || 'request failed' };
    }
  }));
  const failures = parts.filter((part) => part.error);
  if (failures.length) {
    throw new Error(`Could not load solution skills: ${failures.map((part) => `${part.slug} (${part.error})`).join(', ')}. Try again when the authored content is available.`);
  }
  if (!parts.length) throw new Error('No solution skills were selected. Select a solution and try again.');
  return `${parts.map((part) => `## ${part.slug}\n${part.text}`).join('\n\n')}\n\n${solutionGuidanceText(slugs)}`;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function completedAnswer(stream, options) {
  let answer = '';
  let completion;
  let failure;
  const { onResponse, ...request } = options;
  await stream({
    ...request,
    onDelta: (delta) => { answer += delta; options.onDelta?.(delta); },
    onError: (error) => { failure = error; },
    onDone: (metadata) => { completion = metadata; },
  });
  onResponse?.({ answer, completion, error: failure?.message || null });
  if (failure) throw failure;
  if (!completion || completion.mock || !answer.trim()) {
    throw new Error('A real, completed FluffyJaws response is required. No report was replaced.');
  }
  return { answer, completion };
}

export async function generateAssessment({
  stream, messages, requirements = [], onDelta, onThinking, onActivity,
  reasoningEffort = 'medium', webSearch = true, onResponse, checkpoint, onCheckpoint,
  integrityReview = true, sourceContext = '', solutionSlugs = [],
}) {
  const promptSha256 = await sha256(JSON.stringify(messages));
  const inputSha256 = await sha256(JSON.stringify({
    messages, requirements, integrityReview, sourceContext, solutionSlugs,
  }));
  const matches = checkpoint?.inputSha256 === inputSha256;
  if (checkpoint && !matches) onActivity?.('The source inputs changed; starting a fresh assessment');
  if (matches && !Array.isArray(checkpoint.responses)) {
    throw new Error('The saved generation checkpoint is incomplete. No report was replaced.');
  }
  const cached = new Map((matches ? checkpoint.responses : []).map((item) => [item.stage, item]));
  const validated = new Map();
  const remember = (stage, result) => {
    validated.set(stage, { stage, answer: result.answer, completion: result.completion });
    onCheckpoint?.({ inputSha256, promptSha256, responses: [...validated.values()] });
  };
  const request = async (stage, options) => {
    const saved = cached.get(stage);
    if (saved) {
      if (saved.completion?.mock !== false || !saved.completion.responseId
        || typeof saved.answer !== 'string' || !saved.answer.trim()) {
        throw new Error('The saved generation stage is invalid. No report was replaced.');
      }
      onResponse?.({ ...saved, stage, fromCheckpoint: true });
      return { answer: saved.answer, completion: saved.completion, fromCheckpoint: true };
    }
    return completedAnswer(stream, {
      ...options,
      onResponse: (response) => onResponse?.({ stage, ...response }),
    });
  };
  let core = await request('core', {
    messages,
    onDelta,
    onThinking,
    onActivity,
    webSearch,
    reasoningEffort,
  });
  const validation = { requirements, pendingRequirements: requirements.length > 0 };
  const stages = [{
    stage: 'core',
    ...core.completion,
    fromCheckpoint: !!core.fromCheckpoint,
    rawSha256: await sha256(core.answer),
  }];
  const rawResponses = [{ stage: 'core', text: core.answer }];
  let view;
  try {
    view = parseAssessmentResponse(core.answer, validation);
  } catch (error) {
    onActivity?.('Checking the assessment structure and source links');
    const correction = [
      ...messages,
      { role: 'assistant', content: core.answer },
      {
        role: 'user',
        content: `The application rejected the assessment: ${error.message}
Return the COMPLETE corrected canonical assessment between the original exact markers, not a patch or explanation. Preserve substantive findings unless a correction is needed for evidence integrity. Do not invent verification or numerical scores. All seven reviews are required.
Every public-source evidence locator must be ONE exact https URL, with no prose or semicolon-separated links. Split multiple sources into separate evidence IDs, assign each claim to the correct source, and update affected evidenceRefs/publicReferences. Each public reference URL must equal its matching public-source locator exactly. Keep internal or unverified material out of publicReferences.
Use the full original evidence supplied above, not previousResponseId. No further research/tool calls. This is the only correction attempt.`,
      },
    ];
    core = await request('core-correction', {
      messages: correction,
      webSearch: false,
      reasoningEffort,
    });
    view = parseAssessmentResponse(core.answer, validation);
    stages.push({
      stage: 'core-correction',
      ...core.completion,
      rawSha256: await sha256(core.answer),
      promptSha256: await sha256(JSON.stringify(correction)),
    });
    rawResponses.push({ stage: 'core-correction', text: core.answer });
  }
  remember('core', core);
  const rows = [];
  const batchSize = 32;
  // Parallel reviews share explicit evidence rather than relying on response IDs.
  for (let offset = 0; offset < requirements.length; offset += batchSize * 2) {
    const batches = [
      requirements.slice(offset, offset + batchSize),
      requirements.slice(offset + batchSize, offset + batchSize * 2),
    ].filter((batch) => batch.length);
    onActivity?.(`Mapping source requirements ${offset + 1}–${Math.min(offset + batchSize * 2, requirements.length)} of ${requirements.length}`);
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.allSettled(batches.map(async (batch) => {
      const stage = `requirements:${batch[0].id}`;
      const reviewMessages = [{ role: 'user', content: buildRequirementReviewPrompt(view, batch) }];
      let result = await request(stage, {
        messages: reviewMessages,
        webSearch: false,
        reasoningEffort,
      });
      const parseRows = (answer) => {
        let payload;
        try {
          payload = JSON.parse(answer);
        } catch {
          throw new Error(`Requirement review ${batch[0].id} returned invalid JSON. No report was replaced.`);
        }
        const errors = validateRequirementRows(payload.requirements, batch, view.evidence);
        if (errors.length) throw new Error(`Requirement review failed: ${errors.slice(0, 4).join(' ')}`);
        return payload.requirements;
      };
      let reviewed;
      try {
        reviewed = parseRows(result.answer);
      } catch (error) {
        const corrected = await request(`${stage}-correction`, {
          messages: [
            ...reviewMessages,
            { role: 'assistant', content: result.answer },
            {
              role: 'user',
              content: `The requirement validator rejected the response: ${error.message}
Return the COMPLETE corrected requirements JSON for this exact batch, not a patch. Preserve all source IDs and priorities. Use only these evidence IDs: ${view.evidence.map((item) => item.id).join(', ')}.
Acceptance-gate IDs such as G1/G2 are validation plans, NOT source evidence. Do not put them in evidenceRefs. Mention relevant gates in validation. Do not invent evidence or remove a source question. No research/tools and no previousResponseId. This is the only correction attempt.`,
            },
          ],
          webSearch: false,
          reasoningEffort,
        });
        stages.push({
          stage: `${stage}-rejected`,
          ...result.completion,
          rawSha256: await sha256(result.answer),
          fromCheckpoint: !!result.fromCheckpoint,
        });
        rawResponses.push({ stage: `${stage}-rejected`, text: result.answer });
        result = corrected;
        reviewed = parseRows(result.answer);
      }
      remember(stage, result);
      return {
        ...result,
        rows: reviewed,
        stage,
        rawSha256: await sha256(result.answer),
      };
    }));
    results.filter((result) => result.status === 'fulfilled').forEach(({ value }) => {
      rows.push(...value.rows);
      stages.push({
        stage: value.stage,
        ...value.completion,
        rawSha256: value.rawSha256,
        fromCheckpoint: !!value.fromCheckpoint,
      });
      rawResponses.push({ stage: value.stage, text: value.answer });
    });
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  if (requirements.length) {
    const byId = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
    view.requirements = requirements.map((source) => ({
      ...byId.get(source.id.toLowerCase()),
      id: source.id,
      priority: source.priority,
      source: source.source,
      sourceId: source.sourceId || source.id,
      sourceLocator: source.locator,
    }));
  }
  let finalView = view;
  if (integrityReview) {
    onActivity?.('Critically reviewing all seven conclusions and the complete requirement matrix');
    const reviewMessages = buildAssessmentReviewMessages({
      view, requirements, sourceContext, solutionSlugs,
    });
    let review = await request('integrity-review', {
      messages: reviewMessages,
      webSearch: false,
      reasoningEffort,
    });
    try {
      finalView = applyAssessmentReview(view, review.answer, requirements);
    } catch (error) {
      stages.push({
        stage: 'integrity-review-rejected',
        ...review.completion,
        rawSha256: await sha256(review.answer),
      });
      rawResponses.push({ stage: 'integrity-review-rejected', text: review.answer });
      review = await request('integrity-correction', {
        messages: buildAssessmentReviewCorrectionMessages(reviewMessages, review.answer, error),
        webSearch: false,
        reasoningEffort,
      });
      finalView = applyAssessmentReview(view, review.answer, requirements);
    }
    remember('integrity-review', review);
    stages.push({
      stage: 'integrity-review',
      ...review.completion,
      fromCheckpoint: !!review.fromCheckpoint,
      rawSha256: await sha256(review.answer),
      promptSha256: await sha256(JSON.stringify(reviewMessages)),
    });
    rawResponses.push({ stage: 'integrity-review', text: review.answer });
  }
  finalView.inputCoverage = {
    status: requirements.length ? 'verified-manifest' : 'no-independent-manifest',
    requirementIds: requirements.map((row) => row.id),
    expected: requirements.length || null,
    reviewed: finalView.requirements.length,
    note: requirements.length
      ? 'Every source question ID and priority was checked against the extracted manifest.'
      : 'No deterministic source-question manifest was available; completeness is not independently verified.',
  };
  finalView.provenance = {
    generatedAt: new Date().toISOString(),
    provider: 'Adobe FluffyJaws',
    promptSha256,
    inputSha256,
    stages,
  };
  const errors = validateAssessmentView(finalView, { requirements });
  if (errors.length) throw new Error(`Final assessment validation failed: ${errors.slice(0, 6).join(' ')}`);
  return { view: finalView, completion: core.completion, rawResponses };
}
