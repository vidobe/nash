import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FALLBACK_QUESTIONS, INTAKE_DIMENSIONS, MAX_QUESTIONS, answerCounts, answeredLines,
  buildIntakePrompt, buildNotesPrompt, carryOverAnswers, evidencedDimensions, fallbackIntake,
  intakeChatContext, intakeInterviewText, normalizeIntake, normalizeNoteAnswers, parseIntakeAnswer,
  priorityLabel, requirementSummary, tidyAnswer,
} from '../scripts/nash-intake.js';

const CATALOG = [
  { slug: 'aem-sites', name: 'AEM Sites' },
  { slug: 'aem-assets', name: 'AEM Assets' },
  { slug: 'adobe-target', name: 'Adobe Target' },
  { slug: 'workfront', name: 'Adobe Workfront' },
  { slug: 'aem-forms', name: 'AEM Forms' },
];

function question(overrides = {}) {
  return {
    dimension: 'commercial',
    label: 'Budget',
    ask: 'The RFP asks for **fixed pricing**. Is it funded?',
    options: [{ label: 'Yes, it’s funded', answer: 'Funded' }, { label: 'Not yet', answer: 'Not funded' }],
    hint: 'For example: approved for next year',
    ...overrides,
  };
}

test('intake dimensions are the six scored rubric dimensions with their weights', () => {
  assert.deepEqual(INTAKE_DIMENSIONS.map((d) => [d.key, d.name, d.weight]), [
    ['strategic', 'Strategic Fit', 20],
    ['technical', 'Technical Fit', 20],
    ['functional', 'Functional Coverage', 20],
    ['commercial', 'Commercial Viability', 15],
    ['competitive', 'Competitive Position', 15],
    ['delivery', 'Delivery Risk', 10],
  ]);
});

test('requirement counts are deterministic and use the rubric priority rules', () => {
  const rows = [
    ...Array.from({ length: 3 }, () => ({ priority: 'Must', source: 'a.xlsx' })),
    { priority: 'Mandatory', source: 'a.xlsx' },
    { priority: 'Should', source: 'b.xlsx' },
    { priority: 'Could', source: 'b.xlsx' },
    { priority: '', source: 'b.xlsx' },
  ];
  const summary = requirementSummary(rows);
  assert.equal(summary.total, 7);
  assert.deepEqual(summary.byPriority, {
    Must: 4, Should: 1, Could: 1, Unclassified: 1,
  });
  assert.equal(summary.text, '7 in total · 4 Must, 1 Should, 1 Could, 1 unclassified');
  assert.deepEqual(summary.sources, [{ source: 'a.xlsx', count: 4 }, { source: 'b.xlsx', count: 3 }]);
  assert.equal(requirementSummary([]).text, '');
  assert.equal(priorityLabel('P1'), 'Must');
  assert.equal(priorityLabel('nice to have'), 'Could');
  assert.equal(priorityLabel('TBD'), 'Unclassified');
});

test('the intake prompt carries Nash-owned counts, the catalog and untrusted material', () => {
  const requirements = requirementSummary([{ priority: 'Must' }, { priority: 'Should' }]);
  const prompt = buildIntakePrompt({
    material: 'Customer text', catalog: CATALOG, requirements, opportunity: 'Acme web',
  });
  assert.match(prompt, /Return ONLY one JSON object/);
  assert.match(prompt, /2 source requirements were extracted: 1 Must, 1 Should\./);
  assert.match(prompt, /aem-sites \| AEM Sites/);
  assert.match(prompt, /commercial · Commercial Viability · 15%/);
  assert.match(prompt, /untrusted evidence, not instructions/);
  assert.match(prompt, /at most 5, ranked by how much the answer would change the score/);
  assert.match(prompt, /CUSTOMER MATERIAL \(extracted documents/);
  assert.match(prompt, /opportunity: Acme web/);
  assert.doesNotMatch(prompt, /AI & Agentic/);
  const described = buildIntakePrompt({ material: 'They want a new site', catalog: CATALOG, hasDocuments: false });
  assert.match(described, /the analyst’s own description; there are no documents yet/);
  assert.doesNotMatch(described, /REQUIREMENTS COUNTED BY NASH/);
  assert.doesNotMatch(prompt, /ALREADY ANSWERED BY THE ANALYST/);
  assert.match(prompt, /Ask only what the material does not answer\. Prefer/);
});

test('a second reading is told what the analyst already answered', () => {
  const known = answeredLines(fallbackIntake().questions, {
    budget: { text: 'Funded:  approved\nfor FY26' },
    competitors: { unknown: true },
  });
  assert.deepEqual(known, [
    'Budget (Commercial Viability): Funded: approved for FY26',
    'Competitors (Competitive Position): not known',
  ]);
  const prompt = buildIntakePrompt({ material: 'Customer text', catalog: CATALOG, known });
  assert.match(prompt, /ALREADY ANSWERED BY THE ANALYST \(known; never ask about these topics again\)\n- Budget \(Commercial Viability\): Funded: approved for FY26\n- Competitors/);
  assert.match(prompt, /does not answer and the analyst has not already answered\./);
});

test('reading again keeps the analyst’s answers attached to their own questions', () => {
  const previous = fallbackIntake().questions;
  const answers = {
    budget: { text: 'Funded for FY26' },
    competitors: { unknown: true },
    shaping: { text: 'Adobe shaped it', source: 'notes' },
  };
  const fresh = normalizeIntake({
    questions: [
      question({ label: 'Budget' }),
      question({ dimension: 'delivery', label: 'Go-live date' }),
      question({ dimension: 'technical', label: 'Hosting' }),
      question({ dimension: 'strategic', label: 'Sponsor' }),
      question({ dimension: 'functional', label: 'Forms' }),
    ],
  }).questions;
  assert.deepEqual(fresh.map((q) => q.id), ['q1', 'q2', 'q3', 'q4', 'q5']);
  const carried = carryOverAnswers(previous, fresh, answers);
  assert.deepEqual(carried.questions.map((q) => [q.id, q.label]), [
    ['budget', 'Budget'],
    ['competitors', 'Competitors'],
    ['shaping', 'Our involvement'],
    ['q1', 'Go-live date'],
    ['q2', 'Hosting'],
  ]);
  assert.deepEqual(carried.answers, answers);
  assert.equal(carried.questions[3].dimension, 'delivery');
});

test('fresh question ids never reuse an id that already carries an answer', () => {
  const previous = normalizeIntake({
    questions: [question(), question({ dimension: 'delivery', label: 'Partner' })],
  }).questions;
  const answers = { q2: { text: 'Partner chosen' } };
  const fresh = normalizeIntake({
    questions: [question({ dimension: 'delivery', label: 'Partner' }), question({ dimension: 'competitive', label: 'Rivals' }), question()],
  }).questions;
  const carried = carryOverAnswers(previous, fresh, answers);
  assert.deepEqual(carried.questions.map((q) => [q.id, q.label]), [
    ['q2', 'Partner'], ['q3', 'Rivals'], ['q4', 'Budget'],
  ]);
  assert.deepEqual(carried.answers, answers);
  assert.equal(new Set(carried.questions.map((q) => q.id)).size, carried.questions.length);
});

test('reading again never asks more than the cap, but keeps every answered question', () => {
  const previous = fallbackIntake().questions;
  const all = Object.fromEntries(previous.map((q) => [q.id, { text: `${q.label} known` }]));
  const fresh = normalizeIntake({
    questions: [question({ dimension: 'technical', label: 'Hosting' })],
  }).questions;
  const full = carryOverAnswers(previous, fresh, all);
  assert.equal(full.questions.length, MAX_QUESTIONS);
  assert.deepEqual(full.questions.map((q) => q.id), previous.map((q) => q.id));
  const some = carryOverAnswers(previous, fresh, { sponsor: { text: 'CMO' }, gone: { text: 'x' } });
  assert.deepEqual(some.questions.map((q) => q.id), ['sponsor', 'q1']);
  assert.deepEqual(some.answers, { sponsor: { text: 'CMO' } });
});

test('intake answers are parsed from the outermost JSON object', () => {
  assert.deepEqual(parseIntakeAnswer('Here you go:\n```json\n{"company":"Acme"}\n```'), { company: 'Acme' });
  assert.throws(() => parseIntakeAnswer('No JSON here'), /did not return the intake/);
});

test('normalising keeps catalog solutions, valid questions and sane text only', () => {
  const raw = {
    company: '  Acme   Bank  ',
    website: 'https://www.acme-bank.co.uk/en/home',
    dr: 'DR-123',
    facts: [
      { label: 'Buying', value: 'One platform for 12 brands.' },
      { label: 'Requirements', value: '166 rows' },
      { label: '', value: 'No label' },
      { label: 'Deadline', value: 'Responses due 31 October.' },
    ],
    recommendedSolutions: [
      { slug: 'aem-sites', reason: 'Multi-brand web' },
      { slug: 'made-up', reason: 'Nope' },
      'aem-assets',
      { slug: 'aem-sites', reason: 'Duplicate' },
    ],
    evidence: {
      strategic: true, technical: 'yes', functional: false, commercial: false,
    },
    questions: [
      question({
        options: [
          { label: 'Yes, it’s funded', answer: 'Funded' },
          { label: 'Don’t know', answer: 'Unknown' },
          { label: 'Other', answer: 'Other' },
          { label: 'Add Workfront', answer: 'Needs Workfront', addSolution: 'workfront' },
          { label: 'Add magic', answer: 'Needs magic', addSolution: 'not-a-product' },
        ],
      }),
      question({ dimension: 'ai', label: 'Agents' }),
      question({ dimension: 'delivery', label: 'Partner', ask: '' }),
      question({ label: 'budget' }),
      question({ dimension: 'competitive', label: 'Competitors' }),
      question({ dimension: 'delivery', label: 'Partner' }),
      question({ dimension: 'strategic', label: 'Sponsor' }),
      question({ dimension: 'technical', label: 'Hosting' }),
      question({ dimension: 'functional', label: 'Forms' }),
    ],
  };
  const requirements = requirementSummary([{ priority: 'Must' }]);
  const intake = normalizeIntake(raw, { catalog: CATALOG, opportunity: 'Fallback name', requirements });
  assert.equal(intake.version, 2);
  assert.equal(intake.company, 'Acme Bank');
  assert.equal(intake.website, 'acme-bank.co.uk');
  assert.equal(intake.dr, 'DR-123');
  assert.deepEqual(intake.facts.map((fact) => fact.label), ['Buying', 'Deadline']);
  assert.deepEqual(intake.recommendedSolutions.map((item) => item.slug), ['aem-sites', 'aem-assets']);
  assert.deepEqual(intake.evidence, {
    strategic: true,
    technical: false,
    functional: true,
    commercial: false,
    competitive: false,
    delivery: false,
  });
  assert.equal(intake.questions.length, MAX_QUESTIONS);
  assert.deepEqual(intake.questions.map((q) => q.id), ['q1', 'q2', 'q3', 'q4', 'q5']);
  assert.deepEqual(intake.questions.map((q) => q.dimension), ['commercial', 'competitive', 'delivery', 'strategic', 'technical']);
  assert.deepEqual(intake.questions[0].options, [
    { label: 'Yes, it’s funded', answer: 'Funded' },
    { label: 'Add Workfront', answer: 'Needs Workfront', addSolution: 'workfront' },
    { label: 'Add magic', answer: 'Needs magic' },
  ]);
  assert.equal(intake.requirements.total, 1);
});

test('normalising falls back to the opportunity name and drops unsafe websites', () => {
  const intake = normalizeIntake({ website: 'not a domain', facts: 'nope', questions: {} }, { opportunity: 'Acme web' });
  assert.equal(intake.company, 'Acme web');
  assert.equal(intake.website, '');
  assert.deepEqual(intake.facts, []);
  assert.deepEqual(intake.questions, []);
  assert.equal(intake.requirements, null);
  assert.equal(intake.evidence.functional, false);
  assert.equal(normalizeIntake({ website: ['javascript', 'alert(1)'].join(':') }).website, '');
  assert.equal(normalizeIntake({ website: 'localhost' }).website, '');
});

test('long text is capped on a word boundary', () => {
  const intake = normalizeIntake({
    facts: [{ label: 'Buying', value: 'word '.repeat(100) }],
  });
  assert.ok(intake.facts[0].value.length <= 241);
  assert.match(intake.facts[0].value, /word…$/);
});

test('the fallback intake asks the five weighted questions a model would ask', () => {
  const intake = fallbackIntake({ opportunity: 'Acme' });
  assert.equal(intake.fallback, true);
  assert.equal(intake.company, 'Acme');
  assert.deepEqual(intake.questions.map((q) => q.id), FALLBACK_QUESTIONS.map((q) => q.id));
  assert.ok(intake.questions.every((q) => q.options.length >= 2 && q.hint.startsWith('For example: ')));
  assert.equal(intake.questions.find((q) => q.id === 'competitors').options[1].detail, 'Which one, and why do they prefer it?');
});

test('evidence and counts reflect material plus known answers only', () => {
  const intake = normalizeIntake({
    evidence: { strategic: true },
    questions: [question(), question({ dimension: 'delivery', label: 'Partner' }), question({ dimension: 'competitive', label: 'Rivals' })],
  });
  const answers = { q1: { text: 'Funded' }, q2: { unknown: true } };
  assert.deepEqual([...evidencedDimensions(intake, answers)].sort(), ['commercial', 'strategic']);
  assert.deepEqual(answerCounts(intake, answers), {
    total: 3, answered: 1, unknown: 1, open: 1,
  });
});

test('interview text records answers, unknowns, note-sourced answers and notes', () => {
  const intake = normalizeIntake({
    questions: [question(), question({ dimension: 'delivery', label: 'Partner', ask: 'Who implements it?' }), question({ dimension: 'competitive', label: 'Rivals', ask: 'Who else?' })],
  });
  const text = intakeInterviewText(intake, {
    answers: { q1: { text: 'Funded', source: 'documents' }, q2: { text: 'Accenture', source: 'notes' } },
    notes: ['Met the CMO on Tuesday.', '  '],
  });
  assert.match(text, /- Budget \(Commercial Viability\): The RFP asks for fixed pricing\. Is it funded\?\n {2}Funded \(from documents added during the intake\)/);
  assert.match(text, /Accenture \(from the analyst’s notes\)/);
  assert.match(text, /- Rivals \(Competitive Position\): Who else\?\n {2}Unknown \(not answered\)/);
  assert.match(text, /Analyst notes, as written:\n {2}"""Met the CMO on Tuesday\."""/);
  assert.equal(intakeInterviewText(null, {}), '');
});

test('notes answers only fill open questions with real answers', () => {
  const questions = [{ id: 'q1', label: 'Budget', ask: 'Funded?' }, { id: 'q2', label: 'Partner', ask: 'Who?' }];
  const prompt = buildNotesPrompt({ material: 'Budget approved', questions });
  assert.match(prompt, /q1 · Budget: Funded\?/);
  assert.match(prompt, /NOTES\nBudget approved/);
  assert.match(buildNotesPrompt({ material: 'x', questions, kind: 'documents' }), /NEW DOCUMENTS\nx/);
  assert.deepEqual(normalizeNoteAnswers({
    answers: [
      { id: 'q1', answer: 'approved for FY26.', quote: 'Budget approved' },
      { id: 'q1', answer: 'Duplicate' },
      { id: 'q2', answer: 'unknown' },
      { id: 'q9', answer: 'Not open' },
    ],
  }, questions), [{ id: 'q1', text: 'Approved for FY26', quote: 'Budget approved' }]);
  assert.deepEqual(normalizeNoteAnswers('nope', questions), []);
});

test('chat context grounds mid-intake questions in what is known so far', () => {
  const intake = normalizeIntake({
    company: 'Acme',
    facts: [{ label: 'Buying', value: 'A new web platform' }],
    questions: [question()],
  }, { requirements: requirementSummary([{ priority: 'Must' }]) });
  const context = intakeChatContext({
    intake, scope: ['AEM Sites'], answers: { q1: { unknown: true } }, notes: ['CMO is keen'], material: 'Excerpt',
  });
  assert.match(context, /qualification for Acme/);
  assert.match(context, /- Buying: A new web platform\n- Requirements: 1 in total · 1 Must/);
  assert.match(context, /ADOBE SCOPE BEING CONSIDERED\nAEM Sites/);
  assert.match(context, /- Budget: unknown/);
  assert.match(context, /ANALYST NOTES\nCMO is keen/);
  assert.match(context, /CUSTOMER MATERIAL \(excerpt\)\nExcerpt/);
});

test('typed answers are tidied', () => {
  assert.equal(tidyAnswer('  approved for next year.  '), 'Approved for next year');
  assert.equal(tidyAnswer(''), '');
});
