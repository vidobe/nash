import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessmentProjection, buildAssessmentChatContext, isCustomerShareableUrl,
  parseAssessmentResponse, requirementManifestForFiles, requirementsFromRows,
  validateAssessmentView, validateRequirementRows,
} from '../scripts/nash-assessment-contract.js';
import {
  canonicalAssessment, responseText, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

test('complete qualitative assessment covers all seven dimensions without invented points', () => {
  const view = canonicalAssessment();
  assert.deepEqual(validateAssessmentView(view, { requirements: sourceRequirements() }), []);
  assert.deepEqual(parseAssessmentResponse(responseText(view)), view);
  assert.equal(view.dimensions.length, 7);
  assert.equal(view.dimensionDetails.at(-1).sections.length, 4);
});

test('rejects skeletal, six-dimension, unlinked and falsely scored responses', () => {
  [
    (view) => { delete view.executive; },
    (view) => { view.dimensions.pop(); },
    (view) => { view.dimensionDetails.pop(); },
    (view) => { view.confidence.pop(); },
    (view) => { view.dimensionDetails[0].criteria[0].evidenceRefs = ['invented']; },
    (view) => { view.confidence[0].factRefs = ['invented']; },
    (view) => { view.dimensionDetails.at(-1).sections.pop(); },
    (view) => { view.dimensionDetails[0].gateRefs = ['missing']; },
    (view) => { view.meta.score = 0; },
    (view) => { view.dimensions[0].scored = 0; },
    (view) => { view.scoring.status = 'scored'; },
  ].forEach((mutate) => {
    const view = canonicalAssessment();
    mutate(view);
    assert.ok(validateAssessmentView(view).length, mutate.toString());
    assert.throws(() => parseAssessmentResponse(responseText(view)), /incomplete/);
  });
});

test('invalid nested structures return explicit validation errors', () => {
  [
    (view) => { view.dimensionDetails[0].criteria = 'wrong'; },
    (view) => { view.dimensionDetails[0].sections = {}; },
    (view) => { view.evidence = [null]; },
    (view) => { view.dimensionDetails[0].sections = [null]; },
    (view) => { view.dimensionDetails[0].criteria = [null]; },
  ].forEach((mutate) => {
    const view = canonicalAssessment();
    mutate(view);
    assert.ok(validateAssessmentView(view).length);
  });
});

test('strict JSON cannot be repaired into a successful assessment', () => {
  assert.throws(() => parseAssessmentResponse('ordinary prose'), /required assessment structure/);
  assert.throws(() => parseAssessmentResponse(responseText().replace('\nNASH_ASSESSMENT_V2_END', '}\nNASH_ASSESSMENT_V2_END')), /invalid assessment JSON/);
});

test('matrix validation requires the exact source IDs and unchanged priorities', () => {
  const view = canonicalAssessment();
  const manifest = sourceRequirements();
  assert.deepEqual(validateRequirementRows(view.requirements, manifest, view.evidence), []);
  const missing = structuredClone(view.requirements).slice(1);
  assert.match(validateRequirementRows(missing, manifest, view.evidence).join(' '), /exactly the 2/);
  const duplicated = [view.requirements[0], view.requirements[0]];
  assert.match(validateRequirementRows(duplicated, manifest, view.evidence).join(' '), /unique/);
  const changed = structuredClone(view.requirements);
  changed[0].priority = 'M';
  assert.match(validateRequirementRows(changed, manifest, view.evidence).join(' '), /changes the source priority/);
  changed[0].id = 'invented';
  assert.match(validateRequirementRows(changed, manifest, view.evidence).join(' '), /exactly the 2/);
});

test('source extraction preserves alphabetic support IDs, blank priorities and source row numbers', () => {
  const rows = [
    ['Source worksheet'], ['Question ID', 'Source ID', 'Priority', 'Category', 'Closed question'],
    ['REQ-1', 'REQ-1', 'M', 'Functional', 'Can approved content be reused?'],
    [],
    ['REQ-SUPl', 'REQ-SUPl', '', 'Support', 'Can the target freshness be measured?'],
  ];
  assert.deepEqual(requirementsFromRows(rows, 'source.xlsx', 'Comparison'), [{
    id: 'REQ-1',
    priority: 'M',
    question: 'Can approved content be reused?',
    source: 'source.xlsx',
    locator: 'Comparison, row 3',
  }, {
    id: 'REQ-SUPl',
    priority: 'Unclassified',
    question: 'Can the target freshness be measured?',
    source: 'source.xlsx',
    locator: 'Comparison, row 5',
  }]);
});

test('duplicate source questions reconcile only when priority and wording agree', () => {
  const requirements = sourceRequirements();
  const file = { name: 'manifest.json', text: JSON.stringify({ requirements }) };
  assert.equal(requirementManifestForFiles([file, file]).length, 2);
  const conflicting = structuredClone(requirements);
  conflicting[0].priority = 'M';
  assert.throws(() => requirementManifestForFiles([file, {
    name: 'other.json', text: JSON.stringify({ requirements: conflicting }),
  }]), /disagree/);
  assert.throws(() => requirementManifestForFiles([{ name: 'broken.json', text: '{"requirements":[' }]), /incomplete or invalid/);
  assert.deepEqual(requirementManifestForFiles([{ name: 'other.txt', text: 'Customer narrative without a question manifest.' }]), []);
});

test('public reference pack excludes internal knowledge, private authoring and credentials', () => {
  [
    'https://adobe.highspot.com/items/example',
    'https://example.sharepoint.com/document',
    'https://wiki.example.com/internal',
    'https://main--nash--vidobe.aem.page/solutions/aem',
    'https://da.live/example/document',
    'https://example.com/doc?access_token=secret',
    'https://example.com/doc ; https://example.com/other',
    'https://user:password@example.com/doc',
    'http://localhost:3148/',
    'https://127.0.0.1/doc',
  ].forEach((url) => assert.equal(isCustomerShareableUrl(url), false, url));
  assert.equal(isCustomerShareableUrl('https://www.aem.live/docs/architecture'), true);
  const view = canonicalAssessment();
  view.publicReferences[0].url = 'https://adobe.highspot.com/items/example';
  assert.match(validateAssessmentView(view).join(' '), /private or unlinked/);
});

test('an oversized executive headline is rejected instead of overwhelming the overview', () => {
  const view = canonicalAssessment();
  view.executive.headline = Array(30).fill('word').join(' ');
  assert.match(validateAssessmentView(view).join(' '), /headline is too long/);
});

test('canonical projection atomically clears historical scores and stale dimension data', () => {
  const previous = { score: 62, dimensions: [{ dimension: 'Old dimension', scored: 62, max: 100 }], context: { old: true } };
  Object.assign(previous, assessmentProjection(canonicalAssessment()));
  assert.equal(previous.score, null);
  assert.equal(previous.dimensions.length, 7);
  assert.equal(previous.context.old, undefined);
  assert.equal(previous.assessmentView.contractVersion, 3);
});

test('follow-up context explicitly retains the complete canonical matrix and AI analysis', () => {
  const view = canonicalAssessment();
  view.evidence[0].claim = 'Source context. '.repeat(5000);
  view.requirements = sourceRequirements(166).map((row) => ({ id: row.id }));
  const context = buildAssessmentChatContext({ company: 'Example Organization', assessmentView: view });
  assert.ok(context.length > 40000);
  assert.match(context, /REQ-166/);
  assert.match(context, /Readiness and governance/);
  assert.match(context, /not rely on an expired response thread/);
});
