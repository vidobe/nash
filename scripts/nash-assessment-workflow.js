import {
  ASSESSMENT_CONTRACT_VERSION, finalizeRequirementRow, parseAssessmentResponse,
  sourceCitationEvidence, validateAssessmentView, validateRequirementRows,
} from './nash-assessment-contract.js';
import { buildRequirementReviewPrompt } from './nash-assessment-prompts.js';
import { FIT_LEVELS, applyAssessmentRubric } from './nash-rubric.js';
import { latestGeneration, parseModelJson, syntaxCorrection } from './nash-model-json.js';
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

/** Drops draft citations that no finding ended up using, keeping the register meaningful. */
function pruneUnusedCitations(view) {
  const { evidence, ...rest } = view;
  const used = JSON.stringify(rest);
  return {
    ...view,
    evidence: evidence.filter((item) => item.type !== 'source-citation' || used.includes(`"${item.id}"`)),
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const TRANSIENT_STREAM_ERRORS = [
  /network ?error/i,
  /failed to fetch/i,
  /load failed/i,
  /network connection was lost/i,
  /stream ended before response\.completed/i,
  /malformed fluffyjaws stream event/i,
  /FluffyJaws request failed \((?:408|425|429|500|502|503|504)\)/,
];

/** True for dropped connections and gateway hiccups that resending the same stage can recover. */
export function isTransientStreamError(error) {
  if (!error || error.name === 'AbortError') return false;
  const message = String(error.message || '');
  return TRANSIENT_STREAM_ERRORS.some((pattern) => pattern.test(message));
}

const wait = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

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
  onProgress, onHeartbeat, onRetry, retryDelaysMs = [5000, 20000],
  reasoningEffort = 'medium', webSearch = true, onResponse, checkpoint, onCheckpoint,
  integrityReview = true, sourceContext = '', solutionSlugs = [], skills = '',
}) {
  const promptSha256 = await sha256(JSON.stringify(messages));
  const inputSha256 = await sha256(JSON.stringify({
    messages, requirements, integrityReview, sourceContext, solutionSlugs, skills,
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
    onHeartbeat?.();
    const saved = cached.get(stage);
    if (saved) {
      if (saved.completion?.mock !== false || !saved.completion.responseId
        || typeof saved.answer !== 'string' || !saved.answer.trim()) {
        throw new Error('The saved generation stage is invalid. No report was replaced.');
      }
      onResponse?.({ ...saved, stage, fromCheckpoint: true });
      return { answer: saved.answer, completion: saved.completion, fromCheckpoint: true };
    }
    const maxAttempts = retryDelaysMs.length + 1;
    // Each attempt resends the stage's complete messages, so a dropped stream is safe to repeat.
    const attempt = async (number) => {
      try {
        return await completedAnswer(stream, {
          ...options,
          onDelta: (delta) => { onHeartbeat?.(); options.onDelta?.(delta); },
          onThinking: (delta) => { onHeartbeat?.(); options.onThinking?.(delta); },
          onActivity: (activity) => { onHeartbeat?.(); options.onActivity?.(activity); },
          onResponse: (response) => {
            onHeartbeat?.();
            onResponse?.({ stage, attempt: number, ...response });
          },
        });
      } catch (error) {
        if (number >= maxAttempts || !isTransientStreamError(error)) throw error;
        onRetry?.({
          stage, attempt: number + 1, maxAttempts, reason: error.message,
        });
        onActivity?.(`The FluffyJaws connection dropped; restarting ${stage} (attempt ${number + 1} of ${maxAttempts})`);
        await wait(retryDelaysMs[number - 1]);
        onHeartbeat?.();
        return attempt(number + 1);
      }
    };
    return attempt(1);
  };
  onProgress?.({ phase: 'assessment' });
  let core = await request('core', {
    messages,
    onDelta,
    onThinking,
    onActivity,
    webSearch,
    reasoningEffort,
  });
  const validation = {
    requirements,
    pendingRequirements: requirements.length > 0,
    expectedVersion: ASSESSMENT_CONTRACT_VERSION,
  };
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
      { role: 'assistant', content: latestGeneration(core.answer) },
      {
        role: 'user',
        content: `The application rejected the assessment: ${error.message}${syntaxCorrection(error)}
Return the COMPLETE corrected canonical assessment between the original exact markers, not a patch or explanation. Preserve substantive findings unless a correction is needed for evidence integrity. All seven reviews are required, each with an integer rating from 1 to 5; Nash computes the points, total and verdict.
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
  const citations = sourceCitationEvidence(requirements, view.evidence);
  view = { ...view, evidence: [...view.evidence, ...citations.evidence] };
  const coreView = view;
  const rows = [];
  let reviewedCount = 0;
  const reportReviewed = (count) => {
    reviewedCount += count;
    onProgress?.({ phase: 'requirements', reviewed: reviewedCount, total: requirements.length });
  };
  const batchSize = 32;
  if (requirements.length) reportReviewed(0);
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
      const reviewMessages = [{
        role: 'user',
        content: buildRequirementReviewPrompt(coreView, batch, {
          skills, citationRefs: citations.refs,
        }),
      }];
      let result = await request(stage, {
        messages: reviewMessages,
        webSearch: false,
        reasoningEffort,
      });
      const sources = new Map(batch.map((row) => [row.id.toLowerCase(), row]));
      const parseRows = (answer) => {
        let payload;
        try {
          payload = parseModelJson(answer);
        } catch (error) {
          throw new Error(`Requirement review ${batch[0].id} returned invalid JSON. No report was replaced.`, { cause: error });
        }
        if (!Array.isArray(payload?.requirements)) {
          throw new Error(`Requirement review ${batch[0].id} returned no requirements array.`);
        }
        const finalized = payload.requirements.map((row) => {
          const source = sources.get(String(row?.id || '').toLowerCase());
          if (!source) return row;
          return finalizeRequirementRow(row, source, citations.refs.get(source.id.toLowerCase()));
        });
        const errors = validateRequirementRows(finalized, batch, coreView.evidence, {
          version: coreView.contractVersion,
        });
        if (errors.length) throw new Error(`Requirement review failed: ${errors.slice(0, 4).join(' ')}`);
        return finalized;
      };
      let reviewed;
      try {
        reviewed = parseRows(result.answer);
      } catch (error) {
        const corrected = await request(`${stage}-correction`, {
          messages: [
            ...reviewMessages,
            { role: 'assistant', content: latestGeneration(result.answer) },
            {
              role: 'user',
              content: `The requirement validator rejected the response: ${error.message}${syntaxCorrection(error)}
Return the COMPLETE corrected requirements JSON for this exact batch, not a patch. Include every source ID once, each with exactly one fit: ${FIT_LEVELS.map((level) => level.fit).join(', ')}. Use only these evidence IDs: ${coreView.evidence.map((item) => item.id).join(', ')}.
Acceptance-gate IDs such as G1/G2 are NOT evidence; never put them in evidenceRefs. Do not invent evidence or remove a source question. No research/tools and no previousResponseId. This is the only correction attempt.`,
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
      reportReviewed(reviewed.length);
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
    view = applyAssessmentRubric({
      ...view,
      requirements: requirements.map((source) => byId.get(source.id.toLowerCase())),
    });
  }
  let finalView = view;
  onProgress?.({ phase: 'review' });
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
      finalView = applyAssessmentReview(view, review.answer, requirements, citations.refs);
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
      finalView = applyAssessmentReview(view, review.answer, requirements, citations.refs);
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
  finalView = pruneUnusedCitations(finalView);
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
  const errors = validateAssessmentView(finalView, {
    requirements, expectedVersion: ASSESSMENT_CONTRACT_VERSION,
  });
  if (errors.length) throw new Error(`Final assessment validation failed: ${errors.slice(0, 6).join(' ')}`);
  return { view: finalView, completion: core.completion, rawResponses };
}
