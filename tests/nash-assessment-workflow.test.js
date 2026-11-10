import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAssessment } from '../scripts/nash-assessment-workflow.js';
import {
  canonicalAssessment, requirementResponse, responseText, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

function provider({
  failure, incomplete = false, mock = false, corruptRows, corruptReview,
} = {}) {
  const requests = [];
  let active = 0;
  let maxActive = 0;
  const stream = async (options) => {
    requests.push(options);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => { setTimeout(resolve, 1); });
    const message = options.messages[0].content;
    if (failure) options.onError?.(new Error(failure));
    else if (message === 'core') {
      const view = canonicalAssessment();
      view.requirements = [];
      options.onDelta(responseText(view));
    } else if (message.startsWith('Perform a final critical integrity review')) {
      const marker = 'COMPLETE CURRENT ASSESSMENT TO REVIEW\n';
      const view = JSON.parse(message.slice(message.indexOf(marker) + marker.length));
      const review = {
        reviewedRequirementIds: view.requirements.map((row) => row.id),
        coreUpdates: {},
        requirementCorrections: [],
      };
      corruptReview?.(review);
      options.onDelta(JSON.stringify(review));
    } else {
      const marker = '=== SOURCE QUESTIONS (including preliminary draft intelligence, not accepted ratings) ===\n';
      const rows = JSON.parse(message.slice(message.indexOf(marker) + marker.length))
        .map(requirementResponse).reverse();
      corruptRows?.(rows);
      options.onDelta(JSON.stringify({ requirements: rows }));
    }
    if (!failure && !incomplete) {
      options.onDone({
        responseId: `response-${requests.length}`, model: 'reported-model', requestedModel: 'requested-model', mock,
      });
    }
    active -= 1;
  };
  return { stream, requests, maxActive: () => maxActive };
}

test('real completed stages produce a fully validated 166-row assessment in source order', async () => {
  const requirements = sourceRequirements(166);
  const fake = provider();
  const result = await generateAssessment({
    stream: fake.stream, messages: [{ role: 'user', content: 'core' }], requirements,
  });
  assert.equal(fake.requests.length, 8);
  assert.equal(fake.maxActive(), 2);
  assert.equal(result.view.requirements.length, 166);
  assert.deepEqual(
    result.view.requirements.map((row) => row.id),
    requirements.map((row) => row.id),
  );
  assert.deepEqual(
    result.view.requirements.map((row) => row.priority),
    requirements.map((row) => row.priority),
  );
  assert.equal(result.view.inputCoverage.status, 'verified-manifest');
  assert.equal(result.view.provenance.stages.length, 8);
  assert.equal(result.view.provenance.stages[0].model, 'reported-model');
  assert.equal(result.view.provenance.stages[0].requestedModel, 'requested-model');
  assert.equal(result.rawResponses.length, 8);
  assert.equal(result.view.provenance.stages.at(-1).stage, 'integrity-review');
  assert.equal(fake.requests.slice(1).every((request) => request.webSearch === false), true);
  assert.equal(result.view.meta.score, null);
});

test('mock, failed and prematurely ended responses cannot produce a report', async () => {
  await Promise.all([{ mock: true }, { incomplete: true }, { failure: 'gateway failed' }].map(async (options) => {
    const fake = provider(options);
    await assert.rejects(() => generateAssessment({
      stream: fake.stream, messages: [{ role: 'user', content: 'core' }], requirements: sourceRequirements(),
    }), /completed FluffyJaws response|gateway failed/);
    assert.equal(fake.requests.length, 1);
  }));
});

test('missing, duplicate, reprioritized and unlinked requirement responses fail closed', async () => {
  await Promise.all([
    (rows) => { rows.pop(); },
    (rows) => { [rows[1]] = rows; },
    (rows) => { rows.find((row) => row.id === 'REQ-1').priority = 'M'; },
    (rows) => { rows[0].evidenceRefs = ['invented']; },
  ].map(async (corruptRows) => {
    const fake = provider({ corruptRows });
    await assert.rejects(() => generateAssessment({
      stream: fake.stream, messages: [{ role: 'user', content: 'core' }], requirements: sourceRequirements(),
    }), /Requirement review failed/);
  }));
});

test('one model correction replays the full source and must pass the same strict validator', async () => {
  const requests = [];
  const stream = async (options) => {
    requests.push(options);
    const view = canonicalAssessment();
    if (requests.length === 1) view.publicReferences[0].url += '/mismatch';
    options.onDelta(responseText(view));
    options.onDone({ responseId: `response-${requests.length}`, model: 'reported', mock: false });
  };
  const result = await generateAssessment({
    stream,
    messages: [{ role: 'user', content: 'Full original customer evidence' }],
    integrityReview: false,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].messages[0].content, 'Full original customer evidence');
  assert.match(requests[1].messages.at(-1).content, /unverified, private or unlinked/);
  assert.equal(requests[1].webSearch, false);
  assert.equal(result.view.provenance.stages[1].stage, 'core-correction');
  assert.equal(result.rawResponses.length, 2);
});

test('invalid correction cannot trigger repeated retries or save a partial assessment', async () => {
  let calls = 0;
  const stream = async (options) => {
    calls += 1;
    options.onDelta('Invalid structured response');
    options.onDone({ responseId: `response-${calls}`, model: 'reported', mock: false });
  };
  await assert.rejects(() => generateAssessment({
    stream, messages: [{ role: 'user', content: 'Full original source' }],
  }), /required assessment structure/);
  assert.equal(calls, 2);
});

test('completed stages resume without manufacturing a new gateway completion', async () => {
  const requirements = sourceRequirements();
  const messages = [{ role: 'user', content: 'core' }];
  const fake = provider();
  let checkpoint;
  await generateAssessment({
    stream: fake.stream,
    messages,
    requirements,
    onCheckpoint: (value) => { checkpoint = value; },
  });
  assert.equal(checkpoint.responses.length, 3);
  const result = await generateAssessment({
    stream: () => assert.fail('completed stages must not be sent again'),
    messages,
    requirements,
    checkpoint,
  });
  assert.equal(result.view.requirements.length, 2);
  assert.equal(result.view.provenance.stages.every((stage) => stage.fromCheckpoint), true);
});

test('changed source inputs cannot reuse an old assessment checkpoint', async () => {
  const fake = provider();
  let checkpoint;
  await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
    onCheckpoint: (value) => { checkpoint = value; },
  });
  const changed = provider();
  const activity = [];
  await generateAssessment({
    stream: changed.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(3),
    checkpoint,
    onActivity: (value) => activity.push(value),
  });
  assert.equal(changed.requests.length, 3);
  assert.match(activity[0], /source inputs changed/);
});

test('a bounded row correction fixes source references without dropping requirements', async () => {
  let first = true;
  const fake = provider({
    corruptRows: (rows) => {
      if (first) { rows[0].evidenceRefs.push('G1'); first = false; }
    },
  });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
  });
  assert.equal(fake.requests.length, 4);
  assert.equal(result.view.requirements.length, 2);
  assert.equal(result.view.provenance.stages.some((stage) => stage.stage.endsWith('-rejected')), true);
  assert.equal(result.view.requirements.some((row) => row.evidenceRefs.includes('G1')), false);
});

test('a failed batch retains validated sibling stages without reporting overall success', async () => {
  const fake = provider({
    corruptRows: (rows) => {
      if (rows.some((row) => row.id === 'REQ-1')) rows[0].evidenceRefs = ['invented'];
    },
  });

  let checkpoint;
  await assert.rejects(() => generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(66),
    onCheckpoint: (value) => { checkpoint = value; },
  }), /Requirement review failed/);
  assert.equal(checkpoint.responses.some((stage) => stage.stage === 'requirements:REQ-33'), true);
  assert.equal(checkpoint.responses.some((stage) => stage.stage === 'requirements:REQ-1'), false);
});

test('a failed critical review cannot save an otherwise structurally complete assessment', async () => {
  const fake = provider({ corruptReview: (review) => { review.reviewedRequirementIds.pop(); } });
  await assert.rejects(() => generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
  }), /did not cover every requirement/);
  assert.equal(fake.requests.length, 4);
});
