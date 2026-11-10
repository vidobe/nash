/* eslint-env node, es2020 */

import assert from 'node:assert/strict';
import test from 'node:test';
import decorateOverview from '../blocks/nash-overview/nash-overview.js';
import { buildDaDocument, decodeAssessmentPayload } from '../scripts/da-doc.js';
import {
  getAssessment, listAssessments, reassignOpportunity, saveAssessment,
} from '../scripts/nash-assessments.js';
import { assessmentScore } from '../scripts/nash-scoring.js';

function qualitativeAssessment(overrides = {}) {
  return {
    id: 'qualitative',
    company: 'Côte d’Ivoire 客户',
    opportunity: 'Customer platform',
    assessmentName: 'AEM Sites assessment',
    status: 'done',
    createdAt: 1,
    score: null,
    verdict: 'Conditional Go',
    solutions: [{ name: 'AEM Sites', slug: 'aem-sites' }],
    dimensions: Array.from({ length: 7 }, (_, index) => ({
      dimension: `Dimension ${index + 1}`,
      weight: null,
      scored: null,
      max: null,
      notes: 'Qualitative finding.',
    })),
    assessmentView: {
      version: 2,
      contractVersion: 3,
      scoring: { status: 'not-calibrated', reason: 'No approved calibration for this scope.' },
      summary: 'A complete qualitative assessment — not a numeric rating.',
      dimensions: [{ id: 'strategy', finding: 'Customer evidence ✓' }],
      evidence: [{ source: 'Customer RFP', text: 'Authoring & delivery' }],
      futureField: { keep: ['All', 'canonical', 'fields'] },
    },
    reportMarkdown: '# Assessment\n\nQualitative findings.',
    ...overrides,
  };
}

function contractV3AssessmentView(label = 'Published') {
  const reviews = Array.from({ length: 7 }, (_, index) => ({
    id: `review-${index + 1}`,
    title: `${label} dimension ${index + 1}`,
    finding: `${label} qualitative finding ✓`,
    scored: null,
    max: null,
    weight: null,
    evidence: [`${label} source ${index + 1}`],
    openQuestions: [`${label} verification question ${index + 1}`],
  }));
  const requirements = Array.from({ length: 166 }, (_, index) => ({
    id: `requirement-${index + 1}`,
    requirement: `${label} requirement ${index + 1}: authoring & delivery 客户`,
    reviewId: reviews[index % reviews.length].id,
    status: index % 2 ? 'requires-verification' : 'supported',
    evidence: [{ sourceId: 'rfp', locator: `Page ${index + 1}`, excerpt: `${label} evidence ${index + 1}` }],
    verificationGateIds: [`gate-${(index % reviews.length) + 1}`],
  }));
  return {
    version: 2,
    contractVersion: 3,
    scoring: { status: 'not-calibrated', reason: 'No approved seven-dimension calibration.' },
    sections: [
      { id: 'summary', title: `${label} summary`, content: [`${label} complete qualitative assessment.`] },
      { id: 'dimension-reviews', title: 'Seven-dimension review', rows: reviews },
      {
        id: 'requirements',
        title: 'Requirement coverage',
        columns: ['Requirement', 'Status', 'Evidence', 'Verification gates'],
        rows: requirements,
      },
    ],
    verificationGates: reviews.map((review, index) => ({
      id: `gate-${index + 1}`,
      reviewId: review.id,
      status: 'open',
      question: `${label} verification question ${index + 1}`,
      requiredEvidence: [`${label} proof ${index + 1}`],
    })),
    inputCoverage: {
      status: 'partial',
      analyzed: [{ id: 'rfp', name: `${label} RFP.pdf`, pages: 166 }],
      missing: [`${label} architecture inventory`],
      exclusions: [{ id: 'appendix', reason: `${label} unreadable source` }],
      requirementCount: 166,
    },
    provenance: {
      source: 'generated',
      contractVersion: 3,
      model: 'synthetic-test-model',
      generatedAt: '2026-11-10T10:00:00.000Z',
      documents: [{ id: 'rfp', title: `${label} RFP.pdf`, checksum: `${label}-synthetic-checksum` }],
      extensions: { retained: [null, 0, false, `${label} future field`] },
    },
  };
}

function legacyDimensions() {
  return [20, 20, 20, 15, 15, 10].map((max, index) => ({
    dimension: `Dimension ${index + 1}`,
    scored: [12, 13, 14, 8, 9, 6][index],
    max,
  }));
}

function payloadFromDocument(html) {
  const encoded = html.match(/<div><div>nash-payload<\/div><div>([^<]+)<\/div><\/div>/)?.[1];
  assert.ok(encoded, 'DA document includes the embedded assessment payload');
  return decodeAssessmentPayload(encoded);
}

class ElementStub {
  constructor() {
    this.children = [];
    this.nodes = new Map();
    this.nodeLists = new Map();
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
  }

  set innerHTML(html) {
    this.html = html;
    this.children = [];
  }

  get innerHTML() {
    return this.html || '';
  }

  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new ElementStub());
    return this.nodes.get(selector);
  }

  querySelectorAll(selector) {
    return this.nodeLists.get(selector) || [];
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  appendChild(child) {
    this.children.push(child);
  }

  trigger(name) {
    this.listeners.get(name)?.({});
  }
}

function browser(t, assessments = [], rows = []) {
  const storage = new Map([['nash-assessments', JSON.stringify(assessments)]]);
  const document = Object.assign(new EventTarget(), {
    createElement: () => new ElementStub(),
    querySelectorAll: () => [],
  });
  const globals = {
    document,
    window: { location: new URL('https://main--nash--vidobe.aem.page/') },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  Object.entries(globals).forEach(([name, value]) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ data: rows }) }));
  return new ElementStub();
}

function queryRow(company, score, overrides = {}) {
  return {
    title: company,
    path: `/qualifications/${company.toLowerCase().replace(/\s/g, '-')}`,
    status: 'done',
    score,
    ...overrides,
  };
}

function cards(block) {
  return block.querySelector('.nash-overview-grid').children;
}

test('DA export and payload decoding preserve complete unscored canonical assessments', () => {
  const assessment = qualitativeAssessment();
  const original = structuredClone(assessment);
  const html = buildDaDocument(assessment, '<h1>Qualitative assessment</h1>', 'owner@adobe.com');
  const payload = payloadFromDocument(html);
  assert.equal(payload.score, null);
  assert.equal(payload.scoringstatus, 'not-calibrated');
  assert.equal(payload.verdict, 'Conditional Go');
  assert.equal(payload.id, assessment.id);
  assert.equal(payload.opportunity, assessment.opportunity);
  assert.equal(payload.assessmentName, assessment.assessmentName);
  assert.deepEqual(payload.assessmentView, assessment.assessmentView);
  assert.deepEqual(payload.dimensions, assessment.dimensions);
  assert.equal(payload.reportMarkdown, assessment.reportMarkdown);
  assert.match(html, /<div><div>score<\/div><div><\/div><\/div>/);
  assert.deepEqual(assessment, original, 'Export does not mutate the assessment');
});

test('contract-v3 local and DA roundtrips preserve all canonical fields, seven reviews and 166 requirement rows', (t) => {
  browser(t);
  const assessmentView = contractV3AssessmentView();
  const assessment = qualitativeAssessment({ assessmentView });
  saveAssessment(assessment, 'owner@adobe.com');
  const reopened = getAssessment(assessment.id);
  assert.deepEqual(reopened.assessmentView, assessmentView);

  const html = buildDaDocument(reopened, '<p>Published qualitative assessment.</p>');
  const payload = payloadFromDocument(html);
  const view = payload.assessmentView;
  assert.equal(view.version, 2);
  assert.equal(view.contractVersion, 3);
  assert.equal(view.scoring.status, 'not-calibrated');
  assert.equal(payload.score, null);
  assert.equal(payload.scoringstatus, 'not-calibrated');
  assert.deepEqual(view, assessmentView, 'Every canonical field survives without reconstruction');
  assert.deepEqual(view.sections, assessmentView.sections);
  assert.deepEqual(view.verificationGates, assessmentView.verificationGates);
  assert.deepEqual(view.inputCoverage, assessmentView.inputCoverage);
  assert.deepEqual(view.provenance, assessmentView.provenance);
  assert.equal(view.sections.find((section) => section.id === 'dimension-reviews').rows.length, 7);
  const requirements = view.sections.find((section) => section.id === 'requirements').rows;
  assert.equal(requirements.length, 166);
  assert.deepEqual(
    requirements.map((requirement) => requirement.id),
    Array.from({ length: 166 }, (_, index) => `requirement-${index + 1}`),
    'No requirement row is dropped, reordered or duplicated',
  );
  assert.equal(view.verificationGates.length, 7);
  assert.deepEqual(payload.dimensions, assessment.dimensions);
  assert.deepEqual(getAssessment(assessment.id).assessmentView, assessmentView);
});

test('experimentalAssessmentView persists locally but stays out of DA like every existing private lab field', (t) => {
  browser(t);
  const privateMarker = 'PRIVATE_LAB_ONLY_SENTINEL';
  const experimental = {
    experimentalAssessmentView: contractV3AssessmentView(privateMarker),
    experimentalCms: privateMarker,
    experimentalConfidence: [{ label: privateMarker, level: 'low' }],
    experimentalDimensions: [{ dimension: privateMarker, scored: 20, max: 20 }],
    experimentalDossier: { source: privateMarker },
    experimentalError: privateMarker,
    experimentalEvidence: [{ source: privateMarker }],
    experimentalGeneratedAt: 1794304800000,
    experimentalReportMarkdown: `# ${privateMarker}`,
    experimentalScore: 99,
    experimentalStatus: 'done',
    experimentalVerdict: `${privateMarker} Go`,
  };
  const assessment = qualitativeAssessment({
    assessmentView: contractV3AssessmentView(),
    ...experimental,
  });
  saveAssessment(assessment, 'owner@adobe.com');
  reassignOpportunity(assessment.opportunity);
  const local = getAssessment(assessment.id);
  Object.entries(experimental).forEach(([field, value]) => assert.deepEqual(local[field], value));

  const beforeExport = structuredClone(local);
  const html = buildDaDocument(local, '<p>Published qualitative assessment.</p>');
  const payload = payloadFromDocument(html);
  Object.keys(experimental).forEach((field) => {
    assert.equal(Object.hasOwn(payload, field), false, `${field} must remain local-only`);
    assert.ok(!html.includes(field), `${field} is not published as source or metadata`);
  });
  assert.ok(!JSON.stringify(payload).includes(privateMarker), 'No encoded lab content is published');
  assert.ok(!html.includes(privateMarker), 'No lab content appears in the document body or metadata');
  assert.deepEqual(payload.assessmentView, assessment.assessmentView);
  assert.equal(payload.score, null, 'The private lab score does not become the published score');
  assert.equal(payload.scoringstatus, 'not-calibrated');
  assert.equal(payload.verdict, assessment.verdict);
  assert.deepEqual(local, beforeExport, 'Publication does not remove local lab data');
  Object.entries(experimental).forEach(([field, value]) => {
    assert.deepEqual(getAssessment(assessment.id)[field], value);
  });
});

test('DA metadata and payloads retain exact historical scores, including numeric zero strings', () => {
  [0, 59, 62, '0', ' 59 ', '62'].forEach((score) => {
    const assessment = qualitativeAssessment({
      score, assessmentView: null, dimensions: legacyDimensions(),
    });
    const html = buildDaDocument(assessment);
    const payload = payloadFromDocument(html);
    assert.equal(payload.score, Number(score));
    assert.equal(payload.scoringstatus, 'scored');
    assert.ok(html.includes(`<div><div>score</div><div>${Number(score)}</div></div>`));
    assert.match(html, /<div><div>scoringstatus<\/div><div>scored<\/div><\/div>/);
    assert.equal(assessment.score, score);
  });
});

test('explicit indexed unscored verdict survives local storage, DA metadata and payload reopening', async (t) => {
  const block = browser(t);
  const assessment = qualitativeAssessment({
    score: '',
    verdict: 'Conditional-Go',
    scoringstatus: 'not-calibrated',
    assessmentView: null,
    dimensions: legacyDimensions(),
  });
  saveAssessment(assessment);
  const local = getAssessment(assessment.id);
  assert.equal(local.score, '');
  assert.equal(local.verdict, 'Conditional-Go');
  assert.equal(local.scoringstatus, 'not-calibrated');
  assert.equal(assessmentScore(local), null);
  const html = buildDaDocument(local);
  assert.match(html, /<div><div>score<\/div><div><\/div><\/div>/);
  assert.match(html, /<div><div>verdict<\/div><div>Conditional-Go<\/div><\/div>/);
  assert.match(html, /<div><div>scoringstatus<\/div><div>not-calibrated<\/div><\/div>/);
  const payload = payloadFromDocument(html);
  assert.equal(payload.score, null);
  assert.equal(payload.verdict, 'Conditional-Go');
  assert.equal(payload.scoringstatus, 'not-calibrated');
  assert.equal(assessmentScore(payload), null, 'Known unscored state prevents dimension fallback');

  await decorateOverview(block);
  assert.equal(cards(block)[0].dataset.scoringStatus, 'not-calibrated');
  assert.match(cards(block)[0].innerHTML, /Not scored/);
  assert.match(cards(block)[0].innerHTML, /Conditional-Go/);
  assert.doesNotMatch(cards(block)[0].innerHTML, /No-go|nash-overview-radar|nash-overview-score-orbit/);
});

test('DA export never turns absent or blank numeric inputs into a zero score', () => {
  [undefined, null, '', ' '].forEach((score) => {
    const assessment = qualitativeAssessment({ score, assessmentView: null });
    const html = buildDaDocument(assessment);
    assert.equal(payloadFromDocument(html).score, null);
    assert.match(html, /<div><div>score<\/div><div><\/div><\/div>/);
    assert.equal(assessment.score, score);
  });
});

test('explicit uncalibrated status suppresses stale numeric metadata without losing canonical data', () => {
  const assessment = qualitativeAssessment({ score: 88, dimensions: legacyDimensions() });
  const html = buildDaDocument(assessment);
  const payload = payloadFromDocument(html);
  assert.equal(payload.score, null);
  assert.deepEqual(payload.assessmentView, assessment.assessmentView);
  assert.deepEqual(payload.dimensions, assessment.dimensions);
  assert.match(html, /<div><div>score<\/div><div><\/div><\/div>/);
});

test('payload decoding rejects malformed and non-object payloads', () => {
  [null, undefined, '', ' ', 'not valid base64', btoa('null'), btoa('[]'), btoa('"text"')]
    .forEach((value) => assert.equal(decodeAssessmentPayload(value), null));
  const legacy = { company: 'GBI', score: '0', assessmentView: { customField: 'kept' } };
  assert.deepEqual(decodeAssessmentPayload(btoa(JSON.stringify(legacy))), legacy);
});

test('local save, reopen and opportunity reassignment preserve canonical data and score distinctions', (t) => {
  browser(t);
  const assessment = qualitativeAssessment();
  saveAssessment(assessment, 'owner@adobe.com');
  let reopened = getAssessment(assessment.id);
  assert.equal(reopened.score, null);
  assert.equal(reopened.verdict, 'Conditional Go');
  assert.deepEqual(reopened.assessmentView, assessment.assessmentView);
  assert.deepEqual(reopened.dimensions, assessment.dimensions);
  assert.equal(reopened.user, 'owner@adobe.com');
  reassignOpportunity(assessment.opportunity);
  reopened = getAssessment(assessment.id);
  assert.equal(reopened.opportunity, 'Unassigned');
  assert.equal(reopened.score, null);
  assert.deepEqual(reopened.assessmentView, assessment.assessmentView);

  [undefined, null, '', ' ', 0, '0', 59, '62'].forEach((score, index) => {
    const id = `stored-${index}`;
    saveAssessment({ id, score, assessmentView: { retained: true } });
    const saved = getAssessment(id);
    assert.equal(saved.score, score);
    assert.equal(assessmentScore(saved), index < 4 ? null : Number(score));
    assert.deepEqual(saved.assessmentView, { retained: true });
  });
  assert.equal(listAssessments().length, 9);
});

test('overview index parsing keeps zero and historical scores distinct from blank and unknown scores', async (t) => {
  const rows = [
    queryRow('Unknown', null, { verdict: 'Conditional Go' }),
    queryRow('Blank', ' ', { dimensionvalues: JSON.stringify(legacyDimensions()) }),
    queryRow('Zero', '0', { scoringstatus: '' }),
    queryRow('GBI 59', '59', { scoringstatus: 'scored' }),
    queryRow('GBI 62', '62', { scoringstatus: 'scored' }),
  ];
  const block = browser(t, [], rows);
  await decorateOverview(block);
  const unknown = cards(block).find((card) => card.dataset.company === 'unknown').innerHTML;
  const blank = cards(block).find((card) => card.dataset.company === 'blank').innerHTML;
  const zero = cards(block).find((card) => card.dataset.company === 'zero').innerHTML;
  assert.equal(cards(block).find((card) => card.dataset.company === 'unknown').dataset.scoringStatus, 'not-calibrated');
  ['zero', 'gbi 59', 'gbi 62'].forEach((company) => {
    assert.equal(cards(block).find((card) => card.dataset.company === company).dataset.scoringStatus, 'scored');
  });
  assert.match(unknown, /Fit score: Not scored/);
  assert.match(unknown, /Conditional Go/);
  assert.doesNotMatch(unknown, /No-go|nash-overview-radar|nash-overview-score-orbit|\/100/);
  assert.match(blank, /Not scored/);
  assert.doesNotMatch(blank, /nash-overview-radar|nash-overview-score-orbit/);
  assert.match(zero, /0 out of 100 fit score/);
  assert.match(zero, /No-go/);
  const stats = block.querySelector('.nash-overview-stats').innerHTML;
  assert.match(stats, />40<span class="nash-overview-stat-unit">\/100/);
  assert.match(stats, /3 scored &middot; 2 not scored/);
  assert.match(stats, /0 Go, 2 Conditional, 1 No-go, 2 not scored/);
  const table = block.querySelector('.nash-overview-listwrap').innerHTML;
  assert.match(table, /aria-label="Fit score: Not scored">Not scored/);
  assert.match(table, /nash-overview-t-score"[^>]*>0<\/span>/);

  block.querySelector('.nash-overview-sort-btn').trigger('click');
  assert.deepEqual(cards(block).map((card) => card.dataset.company), [
    'gbi 62', 'gbi 59', 'zero', 'unknown', 'blank',
  ], 'Score sorting puts a genuine zero ahead of unscored reports');
});

test('overview index row preserves Conditional-Go independently of an explicitly unscored blank score', async (t) => {
  const row = queryRow('Conditional index row', '', {
    verdict: 'Conditional-Go',
    scoringstatus: 'not-calibrated',
    dimensionvalues: JSON.stringify(legacyDimensions()),
  });
  const stale = {
    ...row, title: 'Stale numeric status', path: '/qualifications/stale-numeric-status', score: '62',
  };
  const block = browser(t, [], [row, stale]);
  await decorateOverview(block);
  const [card] = cards(block);
  assert.equal(card.dataset.scoringStatus, 'not-calibrated');
  assert.equal(card.dataset.status, 'done');
  assert.match(card.innerHTML, /Not scored/);
  assert.match(card.innerHTML, /Conditional-Go/);
  assert.doesNotMatch(card.innerHTML, /No-go|nash-overview-radar|nash-overview-score-orbit|\/100/);
  assert.equal(cards(block)[1].dataset.scoringStatus, 'not-calibrated');
  assert.match(cards(block)[1].innerHTML, /Not scored/);
  assert.match(cards(block)[1].innerHTML, /Conditional-Go/);
  assert.doesNotMatch(cards(block)[1].innerHTML, /nash-overview-radar|nash-overview-score-orbit|\/100/);
  const table = block.querySelector('.nash-overview-listwrap').innerHTML;
  assert.match(table, /data-scoring-status="not-calibrated"/);
  assert.match(table, /aria-label="Fit score: Not scored">Not scored/);
  assert.match(table, /Conditional-Go/);
  assert.doesNotMatch(table, /No-go/);
  assert.match(block.querySelector('.nash-overview-stats').innerHTML, /0 scored &middot; 2 not scored/);
});

test('overview does not coerce missing, blank or invalid index scores to numeric zero', async (t) => {
  const unknown = [undefined, null, '', ' \n\t ', 'unknown', '12 points', Infinity];
  const block = browser(t, [], unknown.map((score, index) => queryRow(`Unknown ${index}`, score)));
  await decorateOverview(block);
  cards(block).forEach((card) => {
    assert.match(card.innerHTML, /Not scored/);
    assert.doesNotMatch(card.innerHTML, /No-go|nash-overview-radar|nash-overview-score-orbit|\/100/);
  });
  const stats = block.querySelector('.nash-overview-stats').innerHTML;
  assert.match(stats, /0 scored &middot; 7 not scored/);
  assert.doesNotMatch(stats, /nash-overview-stat-unit|nash-overview-stat-bar/);
});

test('overview honors canonical unscored status while preserving qualitative verdicts', async (t) => {
  const block = browser(t, [
    qualitativeAssessment(),
    qualitativeAssessment({
      id: 'stale',
      company: 'Stale numeric score',
      score: 88,
      dimensions: legacyDimensions(),
      verdict: 'Discovery needed',
    }),
    qualitativeAssessment({
      id: 'historic',
      company: 'Historical',
      score: '59',
      verdict: 'Go',
      assessmentView: null,
      dimensions: legacyDimensions(),
    }),
    qualitativeAssessment({
      id: 'zero',
      company: 'Zero',
      score: 0,
      verdict: '',
      assessmentView: null,
      dimensions: [],
    }),
  ]);
  await decorateOverview(block);
  assert.match(cards(block)[0].innerHTML, /Not scored/);
  assert.match(cards(block)[0].innerHTML, /Conditional Go/);
  assert.match(cards(block)[0].innerHTML, /No approved calibration/);
  assert.match(cards(block)[1].innerHTML, /Not scored/);
  assert.match(cards(block)[1].innerHTML, /Discovery needed/);
  assert.doesNotMatch(cards(block)[1].innerHTML, /nash-overview-radar|nash-overview-score-orbit/);
  assert.match(cards(block)[2].innerHTML, />Go<\/span>/);
  assert.doesNotMatch(cards(block)[2].innerHTML, />Conditional<\/span>/);
  const stats = block.querySelector('.nash-overview-stats').innerHTML;
  assert.match(stats, />30<span class="nash-overview-stat-unit">\/100/);
  assert.match(stats, /2 scored &middot; 2 not scored/);
});

test('partial dimension data never becomes a zero-filled or incomplete radar', async (t) => {
  const partial = legacyDimensions();
  partial[1].scored = null;
  const block = browser(t, [
    qualitativeAssessment({
      id: 'partial',
      company: 'Partial',
      score: 59,
      assessmentView: null,
      dimensions: partial,
    }),
    qualitativeAssessment({
      id: 'known',
      company: 'Known',
      score: 62,
      assessmentView: null,
      dimensions: legacyDimensions(),
    }),
  ]);
  await decorateOverview(block);
  assert.match(cards(block)[0].innerHTML, /59 out of 100 fit score/);
  assert.doesNotMatch(cards(block)[0].innerHTML, /nash-overview-radar-value/);
  assert.match(cards(block)[1].innerHTML, /nash-overview-radar-value/);
  assert.match(cards(block)[1].innerHTML, /Dimension 1 60%/);
});
