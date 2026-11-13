import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rerunDraftFrom } from '../scripts/nash-assessments.js';

const published = {
  id: 'a-mabc123-x1y2z',
  published: true,
  company: 'Garanti BBVA International',
  opportunity: 'Garanti Bank NV',
  dr: '1234567',
  solutions: [
    { slug: 'aem-sites', name: 'Adobe Experience Manager Sites' },
    { slug: 'aem-assets', name: 'Adobe Experience Manager Assets' },
  ],
  files: [{ name: 'RFP.pdf', text: 'old contents' }],
  intake: { version: 2, questions: [{ id: 'q1' }] },
  interview: { version: 2, answers: { q1: 'yes' } },
  messages: [{ role: 'user', content: 'old chat' }],
  reportMarkdown: '# Old report',
  assessmentView: { scoring: {} },
  score: 72,
  verdict: 'Go',
  opp: { salesStage: 'Qualify' },
};

test('a published re-run carries the customer, DR and solutions into a new draft', () => {
  const draft = rerunDraftFrom(published, { id: 'a-new', now: 1000, url: 'https://x.test/qualifications/gbi' });
  assert.deepEqual(draft, {
    id: 'a-new',
    company: 'Garanti BBVA International',
    opportunity: 'Garanti Bank NV',
    dr: '1234567',
    solutions: [
      { slug: 'aem-sites', name: 'Adobe Experience Manager Sites' },
      { slug: 'aem-assets', name: 'Adobe Experience Manager Assets' },
    ],
    status: 'draft',
    createdAt: 1000,
    files: [],
    messages: [],
    rerunOf: { id: 'a-mabc123-x1y2z', url: 'https://x.test/qualifications/gbi' },
  });
});

test('a published re-run never reuses documents, answers, chat, scores or the old report', () => {
  const draft = rerunDraftFrom(published, { id: 'a-new' });
  ['intake', 'interview', 'reportMarkdown', 'assessmentView', 'score', 'verdict', 'opp', 'published']
    .forEach((key) => assert.equal(key in draft, false, `${key} must not carry over`));
  assert.deepEqual(draft.files, []);
  assert.deepEqual(draft.messages, []);
  assert.notEqual(draft.id, published.id, 'a new id publishes a new page instead of overwriting');
});

test('a published re-run tolerates sparse or legacy reports', () => {
  const draft = rerunDraftFrom({
    company: '  Acme  ', solutions: ['aem-sites', { name: 'No slug' }, null],
  }, { id: 'a-new', now: 1 });
  assert.equal(draft.company, 'Acme');
  assert.equal(draft.opportunity, 'Acme');
  assert.equal('dr' in draft, false);
  assert.deepEqual(draft.solutions, [{ slug: 'aem-sites', name: 'aem-sites' }]);
  assert.match(rerunDraftFrom(null).id, /^a-/);
});

test('every Re-run control is driven together and a re-run request is not lost to reattachment', () => {
  const source = readFileSync(new URL('../blocks/nash-session/nash-session.js', import.meta.url), 'utf8');
  const run = source.slice(source.indexOf('async function runAssessment('), source.indexOf('async function runExperimentalAssessment('));
  assert.doesNotMatch(run, /querySelector\('\.nash-session-rerun'\)/, 'runAssessment must not disable only the first Re-run control');
  assert.match(run, /setRerunBusy\(block, true\)/);
  assert.match(run, /rerunAfterReattach = true/);
  const consumesFlag = /if \(params\.get\('rerun'\) === '1'\) \{\s+const url = new URL\(window\.location\.href\);\s+url\.searchParams\.delete\('rerun'\);/;
  // The published hand-off flag is consumed before the run starts, so a reload doesn't re-run.
  assert.match(source, consumesFlag);
});
