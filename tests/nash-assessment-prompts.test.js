/* eslint-env node */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { SOLUTION_PILLARS } from '../blocks/nash-solutions/nash-solutions.js';
import { solutionGuidance, solutionGuidanceText } from '../scripts/nash-assessment-guidance.js';
import { ASSESSMENT_DIMENSIONS } from '../scripts/nash-assessment-contract.js';
import { buildQualPrompt, buildRequirementReviewPrompt } from '../scripts/nash-assessment-prompts.js';
import { canonicalAssessment, sourceRequirements } from './fixtures/nash-assessment.fixture.js';

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
  assert.equal(expected.contractVersion, 3);
  assert.equal(expected.meta.score, null);
  assert.equal(expected.dimensions[0].scored, null);
  assert.equal(expected.dimensionDetails[0].criteria[0].scored, null);
});

test('one authoritative canonical object replaces contradictory independently generated headers', () => {
  const prompt = promptFor();
  assert.equal((prompt.match(/^NASH_ASSESSMENT_V2:$/gm) || []).length, 1);
  assert.doesNotMatch(prompt, /^NASH_(?:META|DIMS|EVIDENCE|CONFIDENCE|CONTEXT):/m);
  assert.match(prompt, /NO approved calibrated numerical rubric/);
  assert.match(prompt, /Do not invent 0, 50, points, percentages, score swings, or AI weights/);
  assert.match(prompt, /Qualitative verdict is independent/);
  assert.doesNotMatch(prompt, /Re-balance the other weights|weight ~10-15%|finite numeric raw dimension point/);
});

test('every dimension needs its reasons, criteria and evidence rather than repeated sales templates', () => {
  const prompt = promptFor();
  assert.match(prompt, /criteria from ALL selected solution skills/);
  assert.match(prompt, /Keep product capability, requirement fit, customer readiness, commercial evidence and confidence distinct/);
  assert.match(prompt, /Do not repeat "what matters\/how Adobe should respond"/);
  assert.equal(schemaFor(prompt).dimensionDetails[0].scoreBasis, 'unscored');
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
  assert.match(prompt, /fit conclusion in executive.summary and caveats in executive.conditions/);
  assert.doesNotMatch(prompt, /customer-specific fit thesis|customer-fit thesis/);
});

test('AI is reviewed explicitly without forcing adoption, weighting or unsupported availability', () => {
  const prompt = promptFor();
  [
    'Native product AI', 'Product agents', 'Coworker and MCP', 'Readiness and governance',
    'availability/entitlement tables', 'exact entitlement/edition', 'sensitive-data boundaries',
  ].forEach((text) => assert.ok(prompt.includes(text), text));
  assert.match(prompt, /AI purchase, autonomous access and optional adoption are NOT mandatory/);
  assert.match(prompt, /value beyond literal RFI wording without inventing buyer demand/);
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
  assert.match(prompt, /legacyExceptions\. Otherwise that array is empty/);
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

test('input coverage, preliminary vendor answers and unclassified priorities remain honest', () => {
  const prompt = promptFor({ requirements: sourceRequirements(166), deferRequirements: true });
  assert.match(prompt, /166 unique questions/);
  assert.match(prompt, /CORE review stage/);
  assert.match(prompt, /validate the complete matrix before saving/);
  assert.match(prompt, /preliminary vendor answers are claims to reassess/);
  assert.match(prompt, /unclassified priorities/);
  assert.doesNotMatch(prompt, /full contents of the attached/);
  assert.match(promptFor({ fileName: 'brief.pdf', docText: '' }), /If they cannot be read, state the missing evidence explicitly/);
  assert.match(promptFor({ fileName: '', docText: '' }), /No customer document was supplied/);
});

test('bounded requirement review replays explicit evidence instead of relying on response IDs', () => {
  const prompt = buildRequirementReviewPrompt(canonicalAssessment(), sourceRequirements());
  assert.match(prompt, /EXACTLY these 2 source IDs/);
  assert.match(prompt, /No new research\/tool calls/);
  assert.match(prompt, /Needs clarification/);
  assert.match(prompt, /REQ-1/);
  assert.match(prompt, /Application contract/);
  assert.match(prompt, /Official AEM architecture documentation/);
});

test('typed public references and one linked acceptance register are explicit', () => {
  const prompt = promptFor();
  assert.match(prompt, /customer stories, product documentation and trust\/compliance/);
  assert.match(prompt, /NEVER place them in customer-shareable references/);
  assert.match(prompt, /matching public-source evidence locator EXACTLY/);
  assert.match(prompt, /ONE verificationGates register/);
  assert.match(prompt, /not proof of active bids or win rankings/);
  assert.match(prompt, /Blank scorecards\/prices are unknown, not zero/);
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
