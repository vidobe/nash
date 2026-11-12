/* eslint-env node */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { SOLUTION_PILLARS } from '../blocks/nash-solutions/nash-solutions.js';
import { solutionGuidance, solutionGuidanceText } from '../scripts/nash-assessment-guidance.js';
import {
  ASSESSMENT_CONTRACT_VERSION, ASSESSMENT_DIMENSIONS, sourceCitationEvidence,
} from '../scripts/nash-assessment-contract.js';
import { buildQualPrompt, buildRequirementReviewPrompt } from '../scripts/nash-assessment-prompts.js';
import {
  DOC_URL, draftedRequirements, rubricCore, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

const sessionSource = readFileSync(new URL('../blocks/nash-session/nash-session.js', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../scripts/nash-assessment-workflow.js', import.meta.url), 'utf8');
const promptFor = (options = {}) => buildQualPrompt({
  company: 'Example Organization',
  fileName: 'requirements.txt',
  solutionNames: 'Adobe Experience Manager Sites',
  skills: 'Authored product facts and domain criteria.',
  docText: 'REQ-1: governed multilingual content and mobile reuse.',
  ...options,
});
const schemaFor = (prompt) => JSON.parse(prompt.match(/^NASH_ASSESSMENT_V2:\n([\s\S]*?)\nNASH_ASSESSMENT_V2_END$/m)[1]);

function loaderFor(responses) {
  const [source] = workflowSource.match(/async function fetchSkillsText\(slugs\) \{[\s\S]*?\n\}/) || [];
  assert.ok(source, 'exercise the production loader');
  const requests = [];
  const load = runInNewContext(`${source}\nfetchSkillsText;`, {
    solutionGuidanceText,
    fetch: async (path) => {
      requests.push(path);
      const response = responses[path];
      if (response instanceof Error) throw response;
      return {
        ok: response?.status === undefined || response.status === 200,
        status: response?.status || 200,
        text: async () => response?.html || '',
      };
    },
    document: {
      createElement: () => ({
        innerHTML: '',
        get textContent() { return this.innerHTML.replace(/<[^>]*>/g, ''); },
      }),
    },
  });
  return { load, requests };
}

test('all registered solutions share one schema while retaining their actual domain knowledge', () => {
  const expected = schemaFor(promptFor());
  Object.keys(SOLUTION_PILLARS).forEach((slug) => {
    const facts = `Actual ${slug} capabilities and domain criteria (illustrative weight 60%).`;
    const prompt = promptFor({ skills: `${facts}\n\n${solutionGuidanceText([slug])}` });
    assert.deepEqual(schemaFor(prompt), expected, slug);
    assert.ok(prompt.includes(facts), slug);
    ASSESSMENT_DIMENSIONS.forEach((name) => assert.ok(prompt.includes(name), `${slug}: ${name}`));
  });
  assert.equal(expected.contractVersion, ASSESSMENT_CONTRACT_VERSION);
  assert.equal(expected.competitors[0].status, '<incumbent|named|typical>');
  assert.equal(expected.confidence[0].basis, '<evidence|default>');
  assert.deepEqual(Object.keys(expected.meta), ['cms'], 'Nash computes the score and verdict');
  assert.match(expected.dimensions[0].rating, /integer 1-5/);
  assert.equal(expected.dimensions[0].scored, undefined);
  assert.equal(expected.dimensionDetails[0].scoreBasis, undefined);
  assert.equal(expected.dimensionDetails[0].criteria[0].scored, undefined);
});

test('one authoritative canonical object replaces contradictory independently generated headers', () => {
  const prompt = promptFor();
  assert.equal((prompt.match(/^NASH_ASSESSMENT_V2:$/gm) || []).length, 1);
  assert.doesNotMatch(prompt, /^NASH_(?:META|DIMS|EVIDENCE|CONFIDENCE|CONTEXT):/m);
  assert.match(prompt, /RATING RUBRIC\nStrategic Fit \(weight 20\)/);
  assert.match(prompt, /Missing information is not a weakness: rate 3/);
  assert.match(prompt, /Never use 1 or 5 because information is missing/);
  assert.match(prompt, /Do not state a total score or verdict/);
  assert.doesNotMatch(prompt, /NO approved calibrated numerical rubric|MUST be null|not-calibrated|scoreBasis MUST/);
  assert.doesNotMatch(prompt, /Re-balance the other weights|weight ~10-15%|finite numeric raw dimension point/);
});

test('every dimension needs its reasons, criteria and evidence rather than repeated sales templates', () => {
  const prompt = promptFor();
  assert.match(prompt, /criteria of ALL selected solution skills/);
  assert.match(prompt, /keep these questions apart: does the product have the capability; how well does it meet this exact requirement \(fit\); is it part of the Adobe offer/);
  assert.match(prompt, /A bank or other regulated buyer is not a negative signal/);
  assert.match(prompt, /Do not repeat "what matters\/how Adobe should respond"/);
  assert.match(schemaFor(prompt).dimensionDetails[0].scoreRationale, /why this rating and not one higher or lower/);
  assert.match(schemaFor(prompt).confidence[0].scoreChanger, /move this rating/);
  assert.deepEqual(schemaFor(prompt).dimensionDetails[0].gateRefs, ['G1']);
});

test('executive headings name the solution and customer instead of judging fit or listing caveats', () => {
  const prompt = promptFor();
  const { headline } = schemaFor(prompt).executive;
  assert.match(headline, /short solution-and-customer title/);
  assert.match(prompt, /Unified CMS and DAM for Acme Bank/);
  assert.match(prompt, /Customer journey orchestration for Acme/);
  assert.match(prompt, /examples, not defaults/);
  assert.match(prompt, /Never put fit judgments, risk statements, evidence caveats/);
  assert.match(prompt, /fit conclusion in executive\.summary, caveats in executive\.conditions/);
  assert.doesNotMatch(prompt, /customer-specific fit thesis|customer-fit thesis/);
});

test('AI is rated as upside without forcing adoption or unsupported availability', () => {
  const prompt = promptFor();
  [
    'native product AI', 'named product agents', 'Adobe Coworker and MCP', 'exact entitlement',
    'sensitive-data boundaries', 'AI availability and entitlement table',
  ].forEach((text) => assert.ok(prompt.includes(text), text));
  assert.match(prompt, /AI & Agentic Fit is upside: it is rated and shown but not counted in the total/);
  assert.match(prompt, /AI purchase or adoption is never a prerequisite for the core project/);
  assert.match(prompt, /value beyond literal RFI wording, without inventing buyer demand/);
  assert.match(prompt, /AI & Agentic Fit \(upside: rated, shown, not counted in the total\)/);
});

test('modern-first AEM guidance does not force both traditional pages and EDS', () => {
  const guidance = solutionGuidanceText(['aem']);
  assert.match(guidance, /Edge Delivery Services first/);
  assert.match(guidance, /traditional Java\/JCR page delivery only for a documented blocker/);
  assert.match(guidance, /App-only content APIs need not add a page-rendering tier/);
  assert.match(guidance, /Do not claim EDS cannot serve regulated industries/);
  assert.match(guidance, /not blanket guarantees/);
  const prompt = promptFor({ skills: guidance });
  assert.match(prompt, /Only recommended entries form the baseline/);
  assert.match(prompt, /Required capability is not optional just because its specific offering\/entitlement is undecided/);
  assert.match(prompt, /legacyExceptions with requirement[^.]*\. Otherwise that array is empty/);
});

test('non-AEM guidance does not inherit Sites-specific compliance or agent claims', () => {
  ['analytics', 'commerce', 'aem-assets', 'aem-forms', 'aem-guides'].forEach((slug) => {
    assert.doesNotMatch(solutionGuidanceText([slug]), /regulated-industries|For AEM web delivery/);
    assert.doesNotMatch(promptFor({ skills: solutionGuidanceText([slug]) }), /Experience Modernization Agent|unified AEM MCP/);
  });
});

test('guidance is fresh, normalized, deterministic and not duplicated', () => {
  assert.deepEqual(solutionGuidance([' AEM ', 'analytics', 'aem']), solutionGuidance(['analytics', 'aem']));
  const entries = solutionGuidance();
  const original = entries[0].text;
  entries[0].text = 'Changed by consumer';
  assert.equal(solutionGuidance()[0].text, original);
  assert.deepEqual(solutionGuidance(['unregistered-product']), solutionGuidance());
  const commonTitle = solutionGuidance()[0].title;
  ['Authored knowledge', `Authored knowledge\n\n${solutionGuidanceText(['analytics'])}`].forEach((skills) => {
    assert.equal(promptFor({ skills }).split(commonTitle).length - 1, 1);
  });
});

test('input coverage, draft answers and unclassified priorities remain honest', () => {
  const prompt = promptFor({ requirements: sourceRequirements(166), deferRequirements: true });
  assert.match(prompt, /166 source requirements were extracted deterministically/);
  assert.match(prompt, /CORE review stage/);
  assert.match(prompt, /validates the complete matrix before saving/);
  assert.match(prompt, /prior work by the account team: build on them/);
  assert.match(prompt, /unclassified priorities/);
  assert.match(prompt, /=== SOURCE REQUIREMENTS[^\n]*===\nREQ-1 \[Unclassified\] Can approved example content/);
  assert.equal((prompt.match(/^REQ-\d+ \[/gm) || []).length, 166, 'The core stage sees every source ID');
  const drafted = promptFor({ requirements: draftedRequirements(), deferRequirements: true });
  assert.match(drafted, /REQ-1 \[Unclassified\] Content: Can approved example content support workflow 1\? \| draft: Yes/);
  assert.match(drafted, /REQ-2 \[M\] Integration: .* \| draft: OPEN/);
  assert.doesNotMatch(prompt, /full contents of the attached/);
  assert.match(promptFor({ fileName: 'brief.pdf', docText: '' }), /If they cannot be read, say which evidence is missing/);
  assert.match(promptFor({ fileName: '', docText: '' }), /No customer document was supplied/);
  assert.doesNotMatch(promptFor({ fileName: '', docText: '' }), /SOURCE REQUIREMENTS/);
});

test('bounded requirement review builds on drafts with explicit evidence and fit definitions', () => {
  const requirements = draftedRequirements();
  const view = rubricCore();
  const citations = sourceCitationEvidence(requirements, view.evidence);
  view.evidence.push(...citations.evidence);
  const prompt = buildRequirementReviewPrompt(view, requirements, {
    skills: 'Authored AEM knowledge.', citationRefs: citations.refs,
  });
  assert.match(prompt, /EXACTLY these 2 source IDs/);
  assert.match(prompt, /Do not research or call tools/);
  ['Out of the box', 'Configuration', 'Custom build', 'Partner or third party', 'Not supported', 'Needs clarification']
    .forEach((fit) => assert.match(prompt, new RegExp(`- ${fit}: `), fit));
  assert.match(prompt, /start from its answer, note and evidence/);
  assert.match(prompt, /Customer-specific acceptance \(their tests, security review or contract\) is normal procurement work/);
  assert.match(prompt, /Authored AEM knowledge\./);
  assert.match(prompt, /Application contract/);
  assert.match(prompt, /Official AEM architecture documentation/);
  const [, rows] = prompt.split('=== SOURCE ROWS (draft = answer already prepared in the customer\'s workbook) ===\n');
  const parsed = JSON.parse(rows);
  assert.deepEqual(parsed[0].draft, {
    answer: 'Yes',
    note: 'Content Fragments provide governed reusable content.',
    evidence: [`C1: Introduction to AEM headless (${DOC_URL})`],
  });
  assert.deepEqual(parsed[1].draft, { answer: 'OPEN', note: 'Depends on the consuming application contract.' });
  assert.equal(parsed[1].category, 'Integration');
  const [, shared] = prompt.match(/=== SHARED ASSESSMENT CONTEXT ===\n(.*)\n/);
  assert.ok(
    JSON.parse(shared).evidence.every((item) => item.type !== 'source-citation'),
    'Draft citations are offered per row, not in the shared register',
  );
});

test('typed public references and one linked acceptance register are explicit', () => {
  const prompt = promptFor();
  assert.match(prompt, /customer stories, product documentation and trust\/compliance/);
  assert.match(prompt, /NEVER place them in customer-shareable references/);
  assert.match(prompt, /must equal that evidence locator EXACTLY/);
  assert.match(prompt, /ONE verificationGates register/);
  assert.match(prompt, /not proof of an active bid or ranking/);
  assert.match(prompt, /Blank scorecards and prices are unknown, not zero/);
  assert.match(prompt, /relevant customer stories in the customer's industry or region/);
});

test('normal and private experimental formats share canonical seven-dimension validation', () => {
  const ordinary = promptFor();
  const experimental = promptFor({ format: 'experimental' });
  assert.deepEqual(schemaFor(ordinary), schemaFor(experimental));
  assert.equal((ordinary.match(/^# \d+\./gm) || []).length, 10);
  assert.equal((experimental.match(/^# \d+\./gm) || []).length, 5);
  assert.match(experimental, /# 3\. Demo Storyline/);
  assert.match(promptFor({ maxSearches: 3 }), /at most 3 web\/internal research calls/);
  assert.match(ordinary, /not a claim that the gateway technically enforces the limit/);
  assert.match(sessionSource, /generateAssessment\(\{/);
});

test('production skill loading enriches actual DA knowledge without replacing it', async () => {
  const { load, requests } = loaderFor({
    '/solutions/aem.plain.html': { html: '<h2>Scoring Dimensions</h2>\n<p>Web fit (60%)</p>' },
    '/solutions/analytics.plain.html': { html: '<p>Measurement maturity (40%)</p>' },
  });
  const skills = await load(['aem', 'analytics']);
  assert.deepEqual(requests, ['/solutions/aem.plain.html', '/solutions/analytics.plain.html']);
  assert.ok(skills.includes('## aem\nScoring Dimensions\nWeb fit (60%)'));
  assert.ok(skills.includes('## analytics\nMeasurement maturity (40%)'));
  assert.ok(skills.endsWith(solutionGuidanceText(['aem', 'analytics'])));
});

test('failed or partial skill loading never becomes guidance-only success', async () => {
  const { load } = loaderFor({
    '/solutions/aem.plain.html': { status: 404 },
    '/solutions/analytics.plain.html': { html: '<p>Valid authored facts</p>' },
    '/solutions/commerce.plain.html': new Error('Network unavailable'),
  });
  await assert.rejects(load(['aem']), /aem \(HTTP 404\)/);
  await assert.rejects(load(['analytics', 'aem', 'commerce']), /aem \(HTTP 404\).*commerce \(Network unavailable\)/);
  await assert.rejects(load([]), /No solution skills were selected/);
  await assert.rejects(load(['empty']), /empty \(empty authored content\)/);
});
