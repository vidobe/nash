import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAssessment } from '../scripts/nash-assessment-workflow.js';
import {
  DOC_URL, draftedRequirements, fitResponse, responseText, rubricCore, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

const BATCH_MARKER = '=== SOURCE ROWS (draft = answer already prepared in the customer\'s workbook) ===\n';

function provider({
  failure, incomplete = false, mock = false, corruptRows, corruptReview, fitFor,
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
      options.onDelta(responseText(rubricCore()));
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
      const rows = JSON.parse(message.slice(message.indexOf(BATCH_MARKER) + BATCH_MARKER.length))
        .map((row) => fitResponse(row, fitFor?.(row))).reverse();
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
  const progress = [];
  let heartbeats = 0;
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements,
    onProgress: (event) => progress.push(event),
    onHeartbeat: () => { heartbeats += 1; },
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
  assert.equal(result.view.contractVersion, 5);
  assert.equal(result.view.scoring.status, 'scored');
  assert.equal(result.view.scoring.functionalCoverage.percent, 100);
  assert.equal(result.view.dimensionDetails[2].scoreBasis, 'computed');
  assert.equal(result.view.meta.score, 78);
  assert.equal(result.view.meta.verdict, 'Go');
  assert.equal(progress[0].phase, 'assessment');
  assert.equal(progress.at(-1).phase, 'review');
  assert.deepEqual(progress.filter((event) => event.phase === 'requirements')
    .map((event) => event.reviewed), [0, 32, 64, 96, 128, 160, 166]);
  assert.ok(progress.every((event) => !('answer' in event) && !('thinking' in event)));
  assert.ok(heartbeats >= fake.requests.length * 3);
});

test('every live stage forwards activity heartbeats without leaking its contents as progress', async () => {
  const fake = provider();
  const progress = [];
  let heartbeats = 0;
  await generateAssessment({
    stream: async (options) => {
      options.onThinking?.('private reasoning');
      options.onActivity?.('internal tool details');
      await fake.stream(options);
    },
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
    onProgress: (event) => progress.push(event),
    onHeartbeat: () => { heartbeats += 1; },
  });
  assert.equal(fake.requests.length, 3);
  assert.ok(heartbeats >= 15);
  assert.doesNotMatch(JSON.stringify(progress), /private reasoning|internal tool details/);
});

test('a dropped connection restarts only that stage and the run still completes', async () => {
  const fake = provider();
  let dropped = false;
  const retries = [];
  const responses = [];
  const result = await generateAssessment({
    stream: async (options) => {
      if (!dropped && options.messages[0].content === 'core') {
        dropped = true;
        options.onDelta('{"partial": ');
        options.onError(new TypeError('network error'));
        return;
      }
      await fake.stream(options);
    },
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
    retryDelaysMs: [0, 0],
    onRetry: (event) => retries.push(event),
    onResponse: (event) => responses.push(event),
  });
  assert.deepEqual(retries, [{
    stage: 'core', attempt: 2, maxAttempts: 3, reason: 'network error',
  }]);
  assert.equal(fake.requests.length, 3);
  assert.deepEqual(
    responses.filter((event) => event.stage === 'core').map((event) => [event.attempt, event.error]),
    [[1, 'network error'], [2, null]],
  );
  assert.equal(result.view.requirements.length, 2);
});

test('a dropped requirement batch is resent alone while its sibling completes once', async () => {
  const fake = provider();
  const firstId = (options) => {
    const message = options.messages[0].content;
    const index = message.indexOf(BATCH_MARKER);
    return index < 0 ? null : JSON.parse(message.slice(index + BATCH_MARKER.length))[0].id;
  };
  let dropped = false;
  const result = await generateAssessment({
    stream: async (options) => {
      if (!dropped && firstId(options) === 'REQ-1') {
        dropped = true;
        options.onError(new Error('FluffyJaws stream ended before response.completed.'));
        return;
      }
      await fake.stream(options);
    },
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(66),
    retryDelaysMs: [0, 0],
  });
  assert.equal(result.view.requirements.length, 66);
  assert.equal(fake.requests.filter((options) => firstId(options) === 'REQ-1').length, 1);
  assert.equal(fake.requests.filter((options) => firstId(options) === 'REQ-33').length, 1);
});

test('connection retries are bounded and never repeat cancelled or rejected requests', async () => {
  const cases = [
    [new TypeError('network error'), 3, /network error/],
    [new TypeError('Failed to fetch'), 3, /Failed to fetch/],
    [new Error('FluffyJaws stream ended before response.completed.'), 3, /ended before/],
    [new Error('FluffyJaws request failed (503)'), 3, /\(503\)/],
    [new Error('FluffyJaws request failed (401)'), 1, /\(401\)/],
    [new DOMException('The operation was aborted.', 'AbortError'), 1, /aborted/],
    [new Error('content_filter'), 1, /content_filter/],
    [new Error('Run stopped early (max_output_tokens).'), 1, /stopped early/],
  ];
  await Promise.all(cases.map(async ([error, expected, pattern]) => {
    let calls = 0;
    await assert.rejects(() => generateAssessment({
      stream: async (options) => { calls += 1; options.onError(error); },
      messages: [{ role: 'user', content: 'core' }],
      requirements: sourceRequirements(),
      retryDelaysMs: [0, 0],
    }), pattern);
    assert.equal(calls, expected, error.message);
  }));
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

test('missing, duplicate, unfitted and unlinked requirement responses fail closed', async () => {
  await Promise.all([
    (rows) => { rows.pop(); },
    (rows) => { [rows[1]] = rows; },
    (rows) => { rows.find((row) => row.id === 'REQ-1').fit = 'Mostly'; },
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
    const view = rubricCore();
    if (requests.length === 1) view.dimensions[1].rating = 6;
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
  assert.match(requests[1].messages.at(-1).content, /integer rating from 1 to 5/);
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
      if (first) { rows[0].evidenceRefs.push('E404'); first = false; }
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
  assert.equal(result.view.requirements.some((row) => row.evidenceRefs.includes('E404')), false);
});

test('mechanical slips are repaired by Nash and recorded instead of costing a model round', async () => {
  const fake = provider({ corruptRows: (rows) => { rows[0].evidenceRefs.push('G1'); } });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
  });
  assert.equal(fake.requests.length, 3, 'core, one batch and the review; no correction');
  assert.equal(result.view.requirements.some((row) => row.evidenceRefs.includes('G1')), false);
  assert.deepEqual(result.view.provenance.repairs, [{
    stage: 'requirements:REQ-1',
    type: 'gate-reference-removed',
    detail: '1 acceptance-gate reference removed from evidence lists (G1)',
  }]);

  const requests = [];
  const stream = async (options) => {
    requests.push(options);
    const view = rubricCore();
    view.publicReferences[0].url += '/mismatch';
    options.onDelta(responseText(view));
    options.onDone({ responseId: `response-${requests.length}`, model: 'reported', mock: false });
  };
  const core = await generateAssessment({
    stream, messages: [{ role: 'user', content: 'core' }], integrityReview: false,
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(core.view.publicReferences, []);
  assert.deepEqual(core.view.provenance.repairs.map(({ stage, type }) => [stage, type]), [
    ['core', 'public-reference-removed'],
  ]);
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

test('the source owns priority, status, location and category even when a model row changes them', async () => {
  const fake = provider({
    corruptRows: (rows) => {
      Object.assign(rows.find((row) => row.id === 'REQ-1'), {
        priority: 'M', status: 'Gap', sourceLocator: 'Invented', category: 'Invented',
      });
    },
  });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: draftedRequirements(),
  });
  const [row] = result.view.requirements;
  assert.deepEqual([row.priority, row.status, row.sourceLocator, row.category], [
    'Unclassified', 'Covered', 'Requirements, row 2', 'Content',
  ]);
  assert.equal(fake.requests.length, 3, 'No correction round-trip was needed');
});

test('draft answers become cited rows and Functional Coverage is computed from the matrix', async () => {
  const fake = provider({
    fitFor: (row) => (row.draft?.answer === 'Yes' ? 'Out of the box' : 'Needs clarification'),
  });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: draftedRequirements(4),
    skills: 'Authored AEM knowledge.',
  });
  const batch = fake.requests[1].messages[0].content;
  assert.match(batch, /Authored AEM knowledge\./);
  assert.match(batch, /C1: Introduction to AEM headless/);
  const citations = result.view.evidence.filter((item) => item.type === 'source-citation');
  assert.deepEqual(citations.map((item) => [item.id, item.locator]), [['C1', DOC_URL]]);
  assert.deepEqual(result.view.requirements.map((row) => row.evidenceRefs), [
    ['E1', 'C1'], ['E1'], ['E1', 'C1'], ['E1'],
  ]);
  assert.deepEqual(result.view.requirements.map((row) => row.draft?.answer), ['Yes', 'OPEN', 'Yes', 'OPEN']);
  const coverage = result.view.scoring.functionalCoverage;
  assert.equal(coverage.percent, 75, 'Must rows weigh three times an unclassified row');
  assert.equal(coverage.rating, 4);
  assert.equal(result.view.dimensions[2].rating, 4);
  assert.equal(result.view.meta.score, 74);
  assert.equal(result.view.meta.verdict, 'Go');
});

test('draft sources that no conclusion uses are dropped from the evidence register', async () => {
  const fake = provider({ fitFor: () => 'Not supported' });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: draftedRequirements(),
  });
  assert.equal(result.view.evidence.some((item) => item.type === 'source-citation'), false);
  assert.ok(result.view.requirements.every((row) => !row.evidenceRefs.includes('C1')));
  assert.equal(result.view.scoring.functionalCoverage.rating, 1);
  assert.deepEqual(result.view.scoring.functionalCoverage.mustGaps, ['REQ-2']);
});

test('the critical review can move a rating and Nash recomputes the total and verdict', async () => {
  const fake = provider({
    corruptReview: (review) => {
      review.dimensionUpdates = [{
        name: 'Commercial Viability',
        rating: 5,
        details: { scoreRationale: 'An existing Adobe agreement covers the expected investment.' },
      }];
    },
  });
  const result = await generateAssessment({
    stream: fake.stream,
    messages: [{ role: 'user', content: 'core' }],
    requirements: sourceRequirements(),
  });
  const commercial = result.view.dimensions.find((item) => item.dimension === 'Commercial Viability');
  assert.deepEqual([commercial.rating, commercial.scored], [5, 15]);
  assert.equal(result.view.meta.score, 84);
  assert.match(result.view.dimensionDetails[3].scoreRationale, /existing Adobe agreement/);
});
