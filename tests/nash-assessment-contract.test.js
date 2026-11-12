import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  ASSESSMENT_CONTRACT_VERSION,
  assessmentProjection, buildAssessmentChatContext, finalizeRequirementRow, isCanonicalAssessment,
  isCustomerShareableUrl, parseAssessmentResponse, requirementManifestForFiles,
  requirementsFromRows, sourceCitationEvidence, stripRequirementManifest,
  validateAssessmentView, validateRequirementRows,
} from '../scripts/nash-assessment-contract.js';
import { coverageRationale, functionalCoverage } from '../scripts/nash-rubric.js';
import {
  DOC_URL, canonicalAssessment, draftedRequirements, fitResponse, responseText,
  rubricAssessment, rubricCore, sourceRequirements,
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

test('a restarted core stream and a skipped closer recover the identical validated assessment', () => {
  const view = canonicalAssessment();
  const full = responseText(view);
  assert.deepEqual(parseAssessmentResponse(`${full.slice(0, 5000)}${full}`), view);
  const skipped = full.replace('"]}],"requirements"', '"]],"requirements"');
  assert.notEqual(skipped, full);
  assert.deepEqual(parseAssessmentResponse(skipped), view);
});

test('matrix validation requires the exact source IDs and unchanged priorities', () => {
  const view = canonicalAssessment();
  const manifest = sourceRequirements();
  const v3 = { version: 3 };
  assert.deepEqual(validateRequirementRows(view.requirements, manifest, view.evidence, v3), []);
  const missing = structuredClone(view.requirements).slice(1);
  assert.match(validateRequirementRows(missing, manifest, view.evidence, v3).join(' '), /exactly the 2/);
  const duplicated = [view.requirements[0], view.requirements[0]];
  assert.match(validateRequirementRows(duplicated, manifest, view.evidence, v3).join(' '), /unique/);
  const changed = structuredClone(view.requirements);
  changed[0].priority = 'M';
  assert.match(validateRequirementRows(changed, manifest, view.evidence, v3).join(' '), /changes the source priority/);
  changed[0].id = 'invented';
  assert.match(validateRequirementRows(changed, manifest, view.evidence, v3).join(' '), /exactly the 2/);
  assert.match(
    validateRequirementRows(view.requirements, manifest, view.evidence).join(' '),
    /needs one fit value/,
    'Contract v4 rows need a fit',
  );
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
    category: 'Functional',
  }, {
    id: 'REQ-SUPl',
    priority: 'Unclassified',
    question: 'Can the target freshness be measured?',
    source: 'source.xlsx',
    locator: 'Comparison, row 5',
    category: 'Support',
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

test('rubric contract: Nash computes points, total and verdict from the model ratings', () => {
  const core = parseAssessmentResponse(responseText(rubricCore()), {
    requirements: sourceRequirements(),
    pendingRequirements: true,
    expectedVersion: ASSESSMENT_CONTRACT_VERSION,
  });
  assert.equal(core.scoring.status, 'scored');
  assert.equal(core.scoring.method, 'nash-rubric-v1');
  assert.deepEqual(core.dimensions.map((item) => [item.rating, item.scored, item.max]), [
    [4, 16, 20], [4, 16, 20], [3, 12, 20], [3, 9, 15], [3, 9, 15], [4, 8, 10], [4, null, null],
  ]);
  assert.equal(core.meta.score, 70, 'AI & Agentic Fit is upside and never counted');
  assert.equal(core.meta.verdict, 'Go');
  assert.ok(core.dimensionDetails.every((detail) => detail.scoreBasis === 'rubric'));
  const stored = rubricAssessment();
  assert.equal(stored.dimensionDetails[2].scoreBasis, 'computed');
  assert.equal(stored.scoring.functionalCoverage.percent, 100);
  assert.equal(
    stored.dimensionDetails[2].scoreRationale,
    coverageRationale(stored.scoring.functionalCoverage),
    'Nash, not the model, explains the computed rating, so its numbers always match the matrix',
  );
  assert.equal(stored.meta.score, 78);
  assert.deepEqual(validateAssessmentView(stored, { requirements: sourceRequirements() }), []);
  assert.ok(isCanonicalAssessment(stored) && isCanonicalAssessment(canonicalAssessment()));
  assert.equal(isCanonicalAssessment({ contractVersion: 2 }), false);
  assert.match(validateAssessmentView(canonicalAssessment(), { expectedVersion: ASSESSMENT_CONTRACT_VERSION }).join(' '), /current assessment contract/);
});

test('contract v4: missing ratings and tampered arithmetic fail closed', () => {
  [
    (view) => { delete view.dimensions[0].rating; },
    (view) => { view.dimensions[1].rating = 6; },
    (view) => { view.dimensions.at(-1).rating = 0; },
  ].forEach((mutate) => {
    const view = rubricCore();
    mutate(view);
    assert.throws(() => parseAssessmentResponse(responseText(view), {
      requirements: sourceRequirements(), pendingRequirements: true,
    }), /integer rating/);
  });
  [
    (view) => { view.meta.score = 95; },
    (view) => { view.meta.verdict = 'No-go'; },
    (view) => { view.dimensions[0].scored = 20; },
    (view) => { view.dimensions[2].rating = 1; },
    (view) => { view.scoring.functionalCoverage.percent = 40; },
    (view) => { view.dimensionDetails[2].scoreBasis = 'rubric'; },
  ].forEach((mutate) => {
    const view = rubricAssessment();
    mutate(view);
    assert.match(validateAssessmentView(view, { requirements: sourceRequirements() }).join(' '), /Nash rubric/, mutate.toString());
  });
  const stringRating = rubricCore();
  stringRating.dimensions[0].rating = '4';
  assert.equal(parseAssessmentResponse(responseText(stringRating), {
    requirements: sourceRequirements(), pendingRequirements: true,
  }).dimensions[0].rating, 4);
});

test('functional coverage weights priority and fit; a Must gap caps the rating', () => {
  const rows = [
    {
      id: 'A-1', priority: 'M', fit: 'Out of the box', evidenceRefs: ['E1'],
    },
    {
      id: 'A-2', priority: 'S', fit: 'Custom build', evidenceRefs: [],
    },
    {
      id: 'A-3', priority: 'Unclassified', fit: 'Needs clarification', evidenceRefs: ['E1'],
    },
  ];
  const coverage = functionalCoverage(rows);
  assert.equal(coverage.percent, 75);
  const edge = (met, total) => functionalCoverage(Array.from({ length: total }, (_, index) => ({
    id: `E-${index}`, priority: 'S', fit: index < met ? 'Configuration' : 'Not supported', evidenceRefs: ['E1'],
  })));
  [[60, 67, 89], [76, 102, 74], [9, 10, 90]].forEach(([met, total, shown]) => {
    const { percent, rating } = edge(met, total);
    assert.equal(percent, shown);
    const band = [[90, 5], [75, 4], [60, 3], [40, 2]]
      .find(([minimum]) => percent >= minimum)?.[1] || 1;
    assert.equal(rating, band, `${percent}% shown must match its rating band`);
  });
  assert.equal(coverage.rating, 4);
  assert.equal(coverage.unsourced, 1);
  assert.equal(coverageRationale(coverage), 'Nash computed 75% priority-weighted coverage across 3 requirements, counting each Must three times and each Should twice. 1 is met out of the box or by configuration; 2 count half (1 custom build, 1 needs clarification). That is in the 75–89% band, so the rating is 4 of 5. By priority weight, 50% is met as standard or by configuration, 33% needs custom work or a partner and 17% is still open.');
  assert.deepEqual(coverage.parts, {
    standard: { rows: 1, percent: 50 },
    custom: { rows: 1, percent: 33 },
    open: { rows: 1, percent: 17 },
    unsupported: { rows: 0, percent: 0 },
  });
  assert.equal(coverage.offers, undefined, 'Rows without an offer report no offer split');
  const allMet = functionalCoverage(Array.from({ length: 20 }, (_, index) => ({
    id: `B-${index}`, priority: 'S', fit: 'Configuration', evidenceRefs: ['E1'],
  })));
  assert.equal(allMet.rating, 5);
  const mustGap = functionalCoverage([...Array.from({ length: 40 }, (_, index) => ({
    id: `B-${index}`, priority: 'S', fit: 'Configuration', evidenceRefs: ['E1'],
  })), {
    id: 'C-1', priority: 'M', fit: 'Not supported', evidenceRefs: ['E1'],
  }]);
  assert.ok(mustGap.percent >= 90);
  assert.equal(mustGap.rating, 4);
  assert.deepEqual(mustGap.mustGaps, ['C-1']);
  assert.match(coverageRationale(mustGap), /40 are met out of the box or by configuration; 1 is not supported, counting zero\. That would rate 5, but an unsupported Must requirement \(C-1\) caps it at 4 of 5\. By priority weight, 96% is met as standard or by configuration and 4% is not supported\.$/);
  assert.equal(functionalCoverage([]), null);
});

test('contract v4 rows: one fit derives the status; evidence may be empty but never invented', () => {
  const manifest = sourceRequirements();
  const { evidence } = rubricCore();
  const rows = manifest.map((source) => finalizeRequirementRow(fitResponse(source), source));
  assert.equal(rows[0].status, 'Covered');
  assert.equal(rows[0].sourceLocator, 'Requirements, row 2');
  assert.deepEqual(validateRequirementRows(rows, manifest, evidence), []);
  const alias = finalizeRequirementRow({ ...fitResponse(manifest[0]), fit: 'ootb', priority: 'M' }, manifest[0]);
  assert.equal(alias.fit, 'Out of the box');
  assert.equal(alias.priority, 'Unclassified', 'The source owns the priority');
  [
    (row) => { row.fit = 'Mostly'; },
    (row) => { row.status = 'Gap'; },
    (row) => { row.response = ''; },
    (row) => { row.evidenceRefs = ['invented']; },
  ].forEach((mutate) => {
    const changed = structuredClone(rows);
    mutate(changed[0]);
    assert.ok(validateRequirementRows(changed, manifest, evidence).length, mutate.toString());
  });
  const unsourced = structuredClone(rows);
  unsourced[0].evidenceRefs = [];
  assert.deepEqual(validateRequirementRows(unsourced, manifest, evidence), []);
});

test('workbook links are normalized so quotes cannot break out of rendered attributes', () => {
  const [row] = requirementsFromRows([
    ['Question ID', 'Priority', 'Question', 'Adobe Response', 'Reference URL', 'Reference Title'],
    ['REQ-1', 'M', 'Can content be reused?', 'Yes', 'https://docs.example.com/a"onmouseover="alert(1)', 'Guide" onfocus="alert(1)'],
    ['REQ-2', 'M', 'Can assets be reused?', 'Yes', ['javascript', 'alert(1)'].join(':'), 'Bad'],
  ], 'rfp.xlsx', 'Answers');
  assert.equal(row.draft.links[0].url, 'https://docs.example.com/a%22onmouseover=%22alert(1)');
  const { evidence } = sourceCitationEvidence([
    row, { id: 'REQ-3', draft: { links: [{ url: 'https://x.test/a b' }] } },
  ]);
  assert.deepEqual(evidence.map((item) => item.locator), ['https://docs.example.com/a%22onmouseover=%22alert(1)']);
  const session = readFileSync(new URL('../blocks/nash-session/nash-session.js', import.meta.url), 'utf8');
  const [escape] = session.match(/function escapeHtml\(s\) \{[\s\S]*?\n\}/);
  const escapeHtml = runInNewContext(`(${escape})`);
  assert.equal(escapeHtml('Guide" onfocus=\'x\' <b>&'), 'Guide&quot; onfocus=&#39;x&#39; &lt;b&gt;&amp;');
  assert.equal(escapeHtml(undefined), '');
});

test('draft answers, notes and links are captured only from one unambiguous answer column', () => {
  const drafted = requirementsFromRows([
    ['Requirement ID', 'Priority', 'Category', 'Question', 'Adobe answer', 'Evidence / qualification', 'Source 1 title', 'Source 1 URL'],
    ['CMS-1', 'M', 'Content', 'Can content be reused?', 'Yes', 'Content Fragments are reusable.', 'Headless intro', DOC_URL],
  ], 'gbi.xlsx', 'Adobe Evidence');
  assert.deepEqual(drafted[0].draft, {
    answer: 'Yes',
    note: 'Content Fragments are reusable.',
    links: [{ url: DOC_URL, title: 'Headless intro' }],
    locator: 'Adobe Evidence, row 2',
  });
  assert.equal(drafted[0].category, 'Content');
  const ambiguous = requirementsFromRows([
    ['Question ID', 'Priority', 'Closed Yes/No question', 'Yes / No', 'Vendor evidence', 'Yes / No', 'Vendor evidence'],
    ['CMS-1', 'M', 'Can content be reused?', 'Yes', 'Vendor one', 'No', 'Vendor two'],
  ], 'gbi.xlsx', 'Comparison');
  assert.equal(ambiguous[0].draft, undefined, 'Several vendor columns are never guessed');
  const merged = requirementManifestForFiles([{ name: 'gbi.xlsx', requirements: [...ambiguous, ...drafted] }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].draft.answer, 'Yes');
  assert.equal(merged[0].category, 'Content');
});

test('draft links become one citation per URL; only agreeing answers inherit them', () => {
  const requirements = [...draftedRequirements(2), { ...draftedRequirements(1)[0], id: 'REQ-9' }];
  const { evidence, refs } = sourceCitationEvidence(requirements, [{ id: 'E1' }, { id: 'C1' }]);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].id, 'C2', 'Existing evidence IDs are never reused');
  assert.equal(evidence[0].type, 'source-citation');
  assert.equal(evidence[0].locator, DOC_URL);
  assert.match(evidence[0].claim, /REQ-1, REQ-9/);
  assert.deepEqual(refs.get('req-1'), ['C2']);
  assert.equal(refs.get('req-2'), undefined);
  const [source] = requirements;
  const agreeing = finalizeRequirementRow(fitResponse(source), source, refs.get('req-1'));
  assert.deepEqual(agreeing.evidenceRefs, ['E1', 'C2']);
  assert.deepEqual(agreeing.draft, { answer: 'Yes' });
  const downgraded = finalizeRequirementRow(fitResponse(source, 'Not supported'), source, refs.get('req-1'));
  assert.deepEqual(downgraded.evidenceRefs, ['E1'], 'A changed answer does not borrow the draft sources');
  const view = rubricAssessment();
  view.evidence.push({ ...evidence[0] });
  view.publicReferences.push({
    id: 'C2', title: 'Introduction to AEM headless', url: DOC_URL, kind: 'product-documentation', relevance: 'Headless delivery', limitation: 'Product documentation only.', verification: 'Cited in the source workbook.',
  });
  assert.deepEqual(validateAssessmentView(view, { requirements: sourceRequirements() }), []);
});

test('model rows are normalized and the extraction manifest can be stripped from prompts', () => {
  const core = rubricCore();
  core.requirements = sourceRequirements().map((source) => ({ ...fitResponse(source, 'config'), priority: source.priority }));
  const parsed = parseAssessmentResponse(responseText(core), {
    requirements: sourceRequirements(),
  });
  assert.deepEqual(parsed.requirements.map((row) => [row.fit, row.status]), [
    ['Configuration', 'Covered'], ['Configuration', 'Covered'],
  ]);
  assert.equal(parsed.dimensionDetails[2].scoreBasis, 'computed');
  const text = 'CSV text\nNASH_SOURCE_REQUIREMENTS:\n[{"id":"REQ-1"}]\nNASH_SOURCE_REQUIREMENTS_END\nAfter';
  assert.doesNotMatch(stripRequirementManifest(text), /NASH_SOURCE_REQUIREMENTS|REQ-1/);
  assert.match(stripRequirementManifest(text), /CSV text/);
});
