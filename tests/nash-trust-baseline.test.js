import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSESSMENT_CONTRACT_VERSION, parseAssessmentResponse, registerEvidence,
} from '../scripts/nash-assessment-contract.js';
import { buildQualPrompt, buildRequirementReviewPrompt } from '../scripts/nash-assessment-prompts.js';
import { generateAssessment } from '../scripts/nash-assessment-workflow.js';
import {
  TRUST_BASELINE_ORIGIN, fetchTrustBaseline, isNashOwnedEvidence, trustBaselineEvidence,
  trustBaselinesFor,
} from '../scripts/nash-trust-baseline.js';
import {
  fitResponse, responseText, rubricCore, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

const BATCH_MARKER = '=== SOURCE ROWS (draft = answer already prepared in the customer\'s workbook) ===\n';
const REVIEW_MARKER = 'COMPLETE CURRENT ASSESSMENT TO REVIEW\n';

// Shape-only fixture rows; they are not real Adobe facts.
const SHEET = {
  data: [
    {
      Topic: 'Assurance', Statement: 'Fixture assurance statement.', Conditions: '', Source: 'Fixture trust page', URL: 'https://www.adobe.com/trust/fixture.html', Verified: '2026-11-12',
    },
    {
      Topic: 'Encryption', Statement: 'Fixture encryption statement.', Conditions: 'Fixture condition.', Source: 'Fixture security page', URL: 'https://experienceleague.adobe.com/en/docs/fixture',
    },
    {
      Topic: 'Support', Statement: 'Fixture support statement.', Source: '', URL: 'https://helpx.adobe.com/legal/fixture.html',
    },
    { Topic: 'Wrong host', Statement: 'Not Adobe.', URL: 'https://example.com/fixture' },
    { Topic: '', Statement: 'No topic.', URL: 'https://www.adobe.com/fixture' },
    { Topic: 'Insecure', Statement: 'Plain http.', URL: 'http://www.adobe.com/fixture' },
  ],
};

const sheetFetch = (sheet = SHEET, status = 200) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: status === 200, status, json: async () => sheet };
  };
  return { fetchImpl, calls };
};

function baselineProvider({ review, citeBaseline = true } = {}) {
  const requests = [];
  const stream = async (options) => {
    requests.push(options);
    const message = options.messages[0].content;
    if (message === 'core') {
      const view = rubricCore();
      if (citeBaseline) view.dimensions[1].evidenceRefs = [...view.dimensions[1].evidenceRefs, 'T1'];
      options.onDelta(responseText(view));
    } else if (message.startsWith('Perform a final critical integrity review')) {
      const view = JSON.parse(message.slice(message.indexOf(REVIEW_MARKER) + REVIEW_MARKER.length));
      const result = {
        reviewedRequirementIds: view.requirements.map((row) => row.id),
        coreUpdates: {},
        requirementCorrections: [],
      };
      review?.(result, view);
      options.onDelta(JSON.stringify(result));
    } else {
      const rows = JSON.parse(message.slice(message.indexOf(BATCH_MARKER) + BATCH_MARKER.length))
        .map((row, index) => ({
          ...fitResponse(row, 'Out of the box'), evidenceRefs: index === 0 ? ['T2'] : ['E1'],
        }));
      options.onDelta(JSON.stringify({ requirements: rows }));
    }
    options.onDone({
      responseId: `response-${requests.length}`, model: 'reported-model', requestedModel: 'requested-model', mock: false,
    });
  };
  return { stream, requests };
}

const baseline = () => trustBaselineEvidence([{
  path: '/trust/aem-cloud-service.json', name: 'AEM as a Cloud Service', rows: SHEET.data,
}]);

test('authored baseline rows become numbered public-source evidence; unsafe rows are skipped', () => {
  const { evidence, sources } = baseline();
  assert.deepEqual(evidence.map((item) => item.id), ['T1', 'T2', 'T3']);
  assert.deepEqual(evidence[1], {
    id: 'T2',
    type: 'public-source',
    origin: TRUST_BASELINE_ORIGIN,
    topic: 'Encryption',
    source: 'Fixture security page',
    locator: 'https://experienceleague.adobe.com/en/docs/fixture',
    claim: 'Fixture encryption statement. Conditions: Fixture condition.',
  });
  assert.equal(evidence[0].verified, '2026-11-12');
  assert.equal(evidence[2].source, 'helpx.adobe.com');
  assert.deepEqual(sources, [{
    path: '/trust/aem-cloud-service.json', name: 'AEM as a Cloud Service', facts: 3, skipped: [5, 6, 7],
  }]);
  assert.ok(evidence.every(isNashOwnedEvidence));
  assert.equal(isNashOwnedEvidence({ id: 'E1', type: 'public-source' }), false);
});

test('only AEM as a Cloud Service selections load the baseline, and a missing sheet never blocks', async () => {
  assert.deepEqual(trustBaselinesFor(['aem-assets']).map((item) => item.path), ['/trust/aem-cloud-service.json']);
  assert.deepEqual(trustBaselinesFor(['analytics', 'target']), []);

  const ok = sheetFetch();
  const loaded = await fetchTrustBaseline(['aem', 'aem-assets'], ok.fetchImpl);
  assert.deepEqual(ok.calls, ['/trust/aem-cloud-service.json']);
  assert.equal(loaded.evidence.length, 3);

  const none = sheetFetch();
  assert.deepEqual(await fetchTrustBaseline(['analytics'], none.fetchImpl), { evidence: [], sources: [] });
  assert.deepEqual(none.calls, []);

  const missing = await fetchTrustBaseline(['aem'], sheetFetch(SHEET, 404).fetchImpl);
  assert.deepEqual(missing.evidence, []);
  assert.deepEqual(missing.sources, [{
    path: '/trust/aem-cloud-service.json', name: 'AEM as a Cloud Service', facts: 0, error: 'HTTP 404',
  }]);
  const malformed = await fetchTrustBaseline(['aem'], sheetFetch({ rows: [] }).fetchImpl);
  assert.equal(malformed.sources[0].error, 'not a sheet');
});

test('registered evidence lets the core cite T IDs, and wins over a model record with the same ID', () => {
  const { evidence } = baseline();
  const core = rubricCore();
  core.dimensions[0].evidenceRefs = [...core.dimensions[0].evidenceRefs, 'T1'];
  assert.throws(() => parseAssessmentResponse(responseText(core), {
    expectedVersion: ASSESSMENT_CONTRACT_VERSION,
  }), /T1|evidence/i);

  core.evidence = [...core.evidence, { ...evidence[0], claim: 'A model rewrite of the fact.', origin: undefined }];
  const view = parseAssessmentResponse(responseText(core), {
    expectedVersion: ASSESSMENT_CONTRACT_VERSION, registeredEvidence: evidence,
  });
  assert.deepEqual(view.evidence.filter((item) => item.id === 'T1'), [evidence[0]]);
  assert.deepEqual(registerEvidence([{ id: 'E1' }], []), [{ id: 'E1' }]);
});

test('prompts list the baseline for the core and tell batches how to answer trust rows', () => {
  const { evidence } = baseline();
  const core = buildQualPrompt({
    company: 'Acme Bank', solutionNames: 'AEM Sites', skills: 'skills', trustBaseline: evidence,
  });
  assert.match(core, /=== ADOBE TRUST & SERVICE BASELINE/);
  assert.match(core, /T2 · Encryption: Fixture encryption statement\. Conditions: Fixture condition\. \[Fixture security page\] <https:\/\/experienceleague\.adobe\.com\/en\/docs\/fixture>/);
  assert.match(core, /trust and compliance facts the customer asks about that the trust & service baseline below does not already cover/);
  const plain = buildQualPrompt({ company: 'Acme Bank', solutionNames: 'AEM Sites', skills: 'skills' });
  assert.doesNotMatch(plain, /TRUST & SERVICE BASELINE/);
  assert.match(plain, /such as certifications, data residency and regulated-industry use/);

  const view = rubricCore();
  const rows = sourceRequirements(1);
  const batch = buildRequirementReviewPrompt({
    ...view, evidence: [...view.evidence, ...evidence],
  }, rows);
  assert.match(batch, /T1-T3 are Adobe's verified trust & service baseline/);
  assert.match(batch, /"id":"T2","type":"public-source","topic":"Encryption"/);
  assert.doesNotMatch(buildRequirementReviewPrompt(view, rows), /trust & service baseline/);
});

test('cited baseline facts survive the review unchanged and unused ones are pruned', async () => {
  const fake = baselineProvider({
    review: (result, view) => {
      result.coreUpdates.evidence = view.evidence
        .filter((item) => item.id !== 'T2')
        .map((item) => (item.id === 'T1' ? { ...item, claim: 'Adobe guarantees everything.' } : item));
    },
  });
  const trustBaseline = baseline();
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(2),
    trustBaseline,
  });
  const facts = result.view.evidence.filter((item) => item.origin === TRUST_BASELINE_ORIGIN);
  assert.deepEqual(facts, trustBaseline.evidence.slice(0, 2));
  assert.deepEqual(result.view.requirements[0].evidenceRefs, ['T2']);
  assert.deepEqual(result.view.provenance.trustBaseline, {
    sources: trustBaseline.sources, cited: ['T1', 'T2'],
  });
  const batchPrompt = fake.requests.map((request) => request.messages[0].content)
    .find((content) => content.includes(BATCH_MARKER));
  assert.match(batchPrompt, /T1-T3 are Adobe's verified trust & service baseline/);
  const reviewPrompt = fake.requests.at(-1).messages[0].content;
  assert.match(reviewPrompt, /origin trust-baseline \(T IDs\) is Nash's verified Adobe trust & service baseline/);
});

test('an empty or unavailable baseline keeps existing checkpoints valid; a loaded one starts fresh', async () => {
  const run = async (trustBaseline, checkpoint) => {
    const fake = baselineProvider({ citeBaseline: false });
    let saved;
    await generateAssessment({
      stream: fake.stream,
      messages: [{ role: 'user', content: 'core' }],
      requirements: [],
      integrityReview: false,
      checkpoint,
      onCheckpoint: (value) => { saved = value; },
      ...(trustBaseline ? { trustBaseline } : {}),
    }).catch(() => {});
    return { saved, requests: fake.requests.length };
  };
  const first = await run();
  assert.equal(first.requests, 1);
  assert.ok(first.saved.inputSha256);
  const unavailable = await run({
    evidence: [], sources: [{ path: '/trust/aem-cloud-service.json', facts: 0, error: 'HTTP 404' }],
  }, first.saved);
  assert.equal(unavailable.requests, 0);
  const loaded = await run(baseline(), first.saved);
  assert.equal(loaded.requests, 1);
  assert.notEqual(loaded.saved.inputSha256, first.saved.inputSha256);
});
