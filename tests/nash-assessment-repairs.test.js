import assert from 'node:assert/strict';
import test from 'node:test';
import {
  finalizeRequirementRow, normalizeCompetitorStatus, normalizeConfidenceBasis,
  parseAssessmentResponse, parseCsvRows, promptDocumentText, repairAssessmentView,
  requirementsFromRows, validateAssessmentView, validateRequirementRows,
} from '../scripts/nash-assessment-contract.js';
import { separatePolicy, solutionGuidanceText } from '../scripts/nash-assessment-guidance.js';
import {
  buildQualPrompt, buildRequirementReviewPrompt, requirementDigest,
} from '../scripts/nash-assessment-prompts.js';
import {
  applyAssessmentReview, buildAssessmentReviewMessages,
} from '../scripts/nash-assessment-review.js';
import {
  applyAssessmentRubric, coverageShares, functionalCoverage, normalizeOffer,
  ratingsWithoutEvidence,
} from '../scripts/nash-rubric.js';
import {
  draftedRequirements, fitResponse, responseText, rubricAssessment, rubricCore,
  sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

const pending = () => ({ requirements: sourceRequirements(), pendingRequirements: true });

test('every requirement row names one offer, and add-ons are listed for the proposal', () => {
  [
    ['Included', 'Included'], ['add on', 'Add-on'], ['ADD_ON', 'Add-on'], ['addon', 'Add-on'],
    ['separately licensed', 'Add-on'], ['out of scope', 'Not included'], ['TBD', 'Unknown'],
    ['maybe', null], ['', null],
  ].forEach(([value, offer]) => assert.equal(normalizeOffer(value), offer, value));
  const sources = sourceRequirements(3);
  const { evidence } = rubricCore();
  const rows = sources.map((source, index) => finalizeRequirementRow(
    fitResponse(source, 'Configuration', ['Included', 'add-on', 'Unknown'][index]),
    source,
  ));
  assert.deepEqual(rows.map((row) => row.offer), ['Included', 'Add-on', 'Unknown']);
  assert.deepEqual(validateRequirementRows(rows, sources, evidence), []);
  const missing = rows.map(({ offer, ...row }) => row);
  assert.match(
    validateRequirementRows(missing, sources, evidence).join(' '),
    /REQ-1 needs one offer value: Included, Add-on, Not included, Unknown/,
  );
  assert.deepEqual(validateRequirementRows(missing, sources, evidence, { version: 4 }), []);
  assert.deepEqual(functionalCoverage(rows).offers, {
    counts: {
      Included: 1, 'Add-on': 1, 'Not included': 0, Unknown: 1,
    },
    addOns: ['REQ-2'],
  });
});

test('coverage splits into four whole-number parts by priority weight that sum to 100', () => {
  const thirds = functionalCoverage(['Out of the box', 'Custom build', 'Needs clarification']
    .map((fit, index) => ({
      id: `P-${index}`, priority: 'S', fit, evidenceRefs: ['E1'],
    })));
  assert.deepEqual(Object.values(thirds.parts).map((part) => part.percent), [34, 33, 33, 0]);
  assert.equal(
    coverageShares(thirds.parts),
    '34% is met as standard or by configuration, 33% needs custom work or a partner and 33% is still open',
  );
  const fits = ['Out of the box', 'Configuration', 'Custom build', 'Partner or third party',
    'Not supported', 'Needs clarification'];
  const priorities = ['M', 'S', 'C', 'Unclassified'];
  let seed = 7;
  const next = (limit) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % limit;
  };
  for (let run = 0; run < 200; run += 1) {
    const rows = Array.from({ length: 1 + next(40) }, (_, index) => ({
      id: `R-${index}`, priority: priorities[next(4)], fit: fits[next(6)], evidenceRefs: [],
    }));
    const { parts } = functionalCoverage(rows);
    const total = Object.values(parts).reduce((sum, part) => sum + part.percent, 0);
    assert.equal(total, 100, JSON.stringify(parts));
    assert.equal(Object.values(parts).reduce((sum, part) => sum + part.rows, 0), rows.length);
  }
});

test('competitor status is incumbent, named or typical, and free text is never guessed', () => {
  [
    ['incumbent', 'incumbent'], ['Current vendor', 'incumbent'], ['named by the customer', 'named'],
    ['Shortlisted', 'named'], ['typical-alternative', 'typical'], ['Not named', 'typical'],
    ['Listed in vendor register; incumbent status unverified', null], ['', null],
  ].forEach(([value, status]) => assert.equal(normalizeCompetitorStatus(value), status, value));
  const core = rubricCore();
  core.competitors = [
    { ...core.competitors[0], name: 'Contentful', status: 'Current vendor' },
    { ...core.competitors[0], name: 'Bynder', status: 'Listed in vendor register; incumbent status unverified' },
  ];
  assert.throws(
    () => parseAssessmentResponse(responseText(core), pending()),
    /Bynder needs a name and one status: incumbent, named, typical/,
  );
  core.competitors[1].status = 'shortlisted';
  const view = parseAssessmentResponse(responseText(core), pending());
  assert.deepEqual(view.competitors.map((item) => item.status), ['incumbent', 'named']);
});

test('a dimension without customer-specific evidence is a Low-confidence 3, and contradictions are repaired', () => {
  [['evidence', 'evidence'], ['No evidence', 'default'], ['default_rating', 'default'], ['guess', null]]
    .forEach(([value, basis]) => assert.equal(normalizeConfidenceBasis(value), basis, value));
  const core = rubricCore();
  const set = (dimension, values) => Object.assign(
    core.confidence.find((item) => item.dimension === dimension),
    values,
  );
  set('Commercial Viability', { basis: 'no evidence', level: 'Medium' });
  set('Competitive Position', { basis: 'default', level: 'Low' });
  set('Strategic Fit', { basis: 'default' });
  const repairs = [];
  const view = parseAssessmentResponse(responseText(core), {
    ...pending(), onRepair: (item) => repairs.push(item),
  });
  const confidence = Object.fromEntries(view.confidence
    .map((item) => [item.dimension, [item.basis, item.level]]));
  assert.deepEqual(confidence['Commercial Viability'], ['default', 'Low']);
  assert.deepEqual(confidence['Competitive Position'], ['default', 'Low']);
  assert.deepEqual(confidence['Strategic Fit'], ['evidence', 'Medium'], 'A rating of 4 rests on evidence');
  assert.deepEqual(repairs.map((item) => item.type).sort(), [
    'confidence-basis-corrected', 'confidence-level-corrected',
  ]);
  assert.deepEqual(ratingsWithoutEvidence(view), [
    { dimension: 'Commercial Viability', weight: 15 },
    { dimension: 'Competitive Position', weight: 15 },
  ]);
  const stored = rubricAssessment();
  stored.confidence.find((item) => item.dimension === 'Functional Coverage').basis = 'default';
  assert.deepEqual(ratingsWithoutEvidence(stored), [], 'Computed coverage always rests on the matrix');
  const missing = rubricCore();
  delete missing.confidence[0].basis;
  assert.throws(
    () => parseAssessmentResponse(responseText(missing), pending()),
    /Strategic Fit confidence needs a basis: evidence or default/,
  );
});

test('saved v4 assessments without offers, statuses, bases or coverage parts stay valid', () => {
  const requirements = sourceRequirements();
  const legacy = rubricAssessment(requirements, 'Configuration', 4);
  assert.equal(legacy.contractVersion, 4);
  assert.equal(legacy.requirements[0].offer, undefined);
  assert.equal(legacy.confidence[0].basis, undefined);
  assert.deepEqual(validateAssessmentView(legacy, { requirements }), []);
  const { parts, ...original } = legacy.scoring.functionalCoverage;
  const before = { ...legacy, scoring: { ...legacy.scoring, functionalCoverage: original } };
  assert.deepEqual(validateAssessmentView(before, { requirements }), []);
  const current = rubricAssessment(requirements);
  delete current.scoring.functionalCoverage.parts;
  assert.match(validateAssessmentView(current, { requirements }).join(' '), /Nash rubric/);
});

test('gate IDs, criterion synonyms and unshareable references are repaired, not regenerated', () => {
  const core = rubricCore();
  core.dimensions[0].evidenceRefs = [...core.dimensions[0].evidenceRefs, 'G1'];
  core.dimensionDetails[0].criteria[0].status = 'Partially covered';
  core.evidence.push({
    id: 'E3',
    type: 'public-source',
    source: 'Search result',
    locator: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc',
    claim: 'A redirect, not the page.',
  });
  core.publicReferences.push({
    ...core.publicReferences[0], id: 'E3', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc',
  });
  const repairs = [];
  const view = repairAssessmentView(core, (item) => repairs.push(item));
  assert.deepEqual(repairs.map((item) => item.type), [
    'gate-reference-removed', 'criterion-status-normalized', 'public-reference-removed',
  ]);
  assert.equal(view.dimensions[0].evidenceRefs.includes('G1'), false);
  assert.equal(view.dimensionDetails[0].criteria[0].status, 'conditional');
  assert.deepEqual(view.publicReferences.map((item) => item.id), ['E2']);
  assert.ok(core.dimensions[0].evidenceRefs.includes('G1'), 'The input view is not mutated');
});

test('requirement tables reach the model once; listed rows keep only the cells not in SOURCE REQUIREMENTS', () => {
  assert.deepEqual(parseCsvRows('a,"b, c","say ""hi"""\r\n"multi\nline",,x\n'), [
    ['a', 'b, c', 'say "hi"'], ['multi\nline', '', 'x'],
  ]);
  const csv = [
    'Question ID,Priority,Category,Question,Adobe answer,Adobe evidence,Vendor score',
    'REQ-1,M,Content,Can approved content be reused?,Yes,Content Fragments provide governed reuse.,4',
    'REQ-2,S,Integration,Can the app read content?,OPEN,Depends on the app contract.,2',
    'Scoring guidance for reviewers',
  ].join('\n');
  const requirements = requirementsFromRows(parseCsvRows(csv), 'rfp.xlsx', 'Requirements');
  assert.deepEqual(requirements.map((row) => row.draft.answer), ['Yes', 'OPEN']);
  const text = `### Sheet: Requirements\n${csv}\n\n### Sheet: Pricing\nItem,Cost\nLicence,TBD\n`
    + 'NASH_SOURCE_REQUIREMENTS:{"requirements":[]}NASH_SOURCE_REQUIREMENTS_END'
    + '\n[NASH: rfp.xlsx truncated after 2 sheets]';
  const prompt = promptDocumentText([{ name: 'rfp.xlsx', text }], requirements);
  assert.equal(prompt, [
    '--- rfp.xlsx ---',
    '### Sheet: Requirements',
    'Question ID,Priority,Category,Question,Adobe answer,Adobe evidence,Vendor score',
    '[Nash: the 2 requirement rows of this table (REQ-1 … REQ-2) are listed once under SOURCE REQUIREMENTS with their ID, priority, category, question and any draft answer and note; links cited in the drafts become evidence for the requirement answers. Only the cell values not repeated there follow.]',
    'REQ-1 · Vendor score: 4',
    'REQ-2 · Vendor score: 2',
    'Scoring guidance for reviewers',
    '',
    '### Sheet: Pricing',
    'Item,Cost',
    'Licence,TBD',
    '[NASH: rfp.xlsx truncated after 2 sheets]',
  ].join('\n'));
  assert.equal(
    promptDocumentText([{ name: 'rfp.xlsx', text }]),
    `--- rfp.xlsx ---\n${text.replace(/\nNASH_SOURCE_REQUIREMENTS:[\s\S]*?NASH_SOURCE_REQUIREMENTS_END/, '')}`,
    'Without a manifest the document is only stripped of the machine-readable block',
  );
  const unlisted = requirements.slice(0, 1);
  assert.match(promptDocumentText([{ name: 'rfp.xlsx', text }], unlisted), /Can the app read content\?/, 'A table with an unlisted row is kept whole');
});

test('the requirement digest carries each draft answer and note on one line', () => {
  const lines = requirementDigest([
    ...draftedRequirements(),
    {
      id: 'REQ-3', priority: 'S', question: 'Multi\n  line?', draft: { note: 'Only a note.' },
    },
  ]).split('\n');
  assert.deepEqual(lines, [
    'REQ-1 [Unclassified] Content: Can approved example content support workflow 1? | draft: Yes | note: Content Fragments provide governed reusable content.',
    'REQ-2 [M] Integration: Can approved example content support workflow 2? | draft: OPEN | note: Depends on the consuming application contract.',
    'REQ-3 [S] Multi line? | draft note: Only a note.',
  ]);
});

test('the shared policy and fit rules are stated once, ahead of the solution knowledge', () => {
  const skills = `Actual AEM capability facts.\n\n${solutionGuidanceText(['aem'])}`;
  const { policy, knowledge } = separatePolicy(skills);
  assert.equal(policy, solutionGuidanceText());
  assert.ok(knowledge.startsWith('Actual AEM capability facts.'));
  assert.ok(!knowledge.includes('Keep six questions apart'));
  assert.ok(knowledge.includes('AEM Sites: authoring and delivery are separate choices'));
  assert.deepEqual(separatePolicy('Only knowledge.'), { policy, knowledge: 'Only knowledge.' });
  const core = buildQualPrompt({
    company: 'Acme',
    solutionNames: 'AEM Sites',
    skills,
    docText: 'RFP text',
    requirements: draftedRequirements(),
    deferRequirements: true,
  });
  const batch = buildRequirementReviewPrompt(rubricCore(), draftedRequirements(), { skills });
  [core, batch].forEach((prompt) => {
    ['Keep six questions apart', 'REQUIREMENT FIT AND OFFER',
      'AEM Sites: authoring and delivery are separate choices'].forEach((text) => {
      assert.equal(prompt.split(text).length - 1, 1, text);
    });
    assert.ok(prompt.indexOf('REQUIREMENT FIT AND OFFER') < prompt.indexOf('Actual AEM capability facts.'));
  });
});

test('the review sees computed facts; duplicate corrections, omitted offers and bases are repaired', () => {
  const requirements = sourceRequirements(3);
  const fits = [['Configuration', 'Included'], ['Needs clarification', 'Included'], ['Configuration', 'Add-on']];
  const view = applyAssessmentRubric({
    ...rubricCore(),
    requirements: requirements.map((source, index) => finalizeRequirementRow(
      fitResponse(source, ...fits[index]),
      source,
    )),
  });
  const [message] = buildAssessmentReviewMessages({
    view, requirements, sourceContext: 'Source', solutionSlugs: ['aem'],
  });
  assert.match(message.content, /COMPUTED FACTS/);
  assert.match(message.content, /Add-ons the proposal must include \(1\): REQ-3/);
  assert.match(message.content, /Open Must requirements \(1\): REQ-2/);
  assert.match(message.content, /REQUIREMENT FIT AND OFFER/);

  const { offer, ...withoutOffer } = view.requirements[2];
  const correction = { ...withoutOffer, fit: 'Out of the box', response: 'Dynamic Media renditions are standard.' };
  const review = {
    reviewedRequirementIds: view.requirements.map((row) => row.id),
    coreUpdates: { confidence: view.confidence.map(({ basis, ...item }) => item) },
    requirementCorrections: [correction, { ...correction }],
  };
  const repairs = [];
  const result = applyAssessmentReview(view, JSON.stringify(review), requirements, new Map(), {
    onRepair: (item) => repairs.push(item),
  });
  assert.deepEqual([result.requirements[2].fit, result.requirements[2].offer], ['Out of the box', 'Add-on']);
  assert.ok(result.confidence.every((item) => item.basis === 'evidence'));
  assert.deepEqual([...new Set(repairs.map((item) => item.type))].sort(), [
    'confidence-basis-kept', 'duplicate-correction-removed', 'offer-kept',
  ]);
  review.requirementCorrections = [correction, { ...correction, response: 'Different.' }];
  assert.throws(
    () => applyAssessmentReview(view, JSON.stringify(review), requirements),
    /changed or duplicated/,
  );
});

test('a review that closes early and then sends a core update keeps that update', () => {
  const requirements = sourceRequirements(2);
  const view = applyAssessmentRubric({
    ...rubricCore(),
    requirements: requirements.map((source) => finalizeRequirementRow(
      fitResponse(source, 'Configuration', 'Included'),
      source,
    )),
  });
  const confidence = view.confidence.map((item) => (item.dimension === 'Commercial Viability'
    ? { ...item, level: 'Low', basis: 'default' } : item));
  const head = JSON.stringify({
    reviewedRequirementIds: view.requirements.map((row) => row.id),
    coreUpdates: { meta: { cms: 'n/a' } },
    dimensionUpdates: [],
    requirementCorrections: [],
  });
  // The shape seen live: the root closes, the field follows, then the closers it expected.
  const answer = `${head},"confidence":${JSON.stringify(confidence)}}}`;
  const repairs = [];
  const result = applyAssessmentReview(view, answer, requirements, new Map(), {
    onRepair: (item) => repairs.push(item),
  });
  assert.equal(result.meta.cms, 'n/a');
  assert.deepEqual(
    result.confidence.find((item) => item.dimension === 'Commercial Viability'),
    confidence.find((item) => item.dimension === 'Commercial Viability'),
  );
  assert.deepEqual(repairs.map((item) => item.type), ['json-brackets-repaired', 'review-field-moved']);

  const both = JSON.parse(head);
  both.coreUpdates.confidence = confidence;
  both.confidence = view.confidence;
  assert.throws(
    () => applyAssessmentReview(view, JSON.stringify(both), requirements),
    /unknown top-level fields \(confidence\)/,
    'A field sent both inside and outside coreUpdates is ambiguous',
  );
});
