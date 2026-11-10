import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessmentViewFor, referenceKind, reportSubsection, scoreBreakdownFor, solutionSelection,
} from '../scripts/nash-assessment-view.js';

const sections = {
  Overview: `- **Overall qualification:** 62/100, Conditional-Go.
- **AEM Sites fit: High.** Reusable content and review workflows fit the documented needs.
- **Decision posture:** Advance discovery, not a production commitment. Close the service gates first.`,
  Architecture: `- **Recommended pattern:** Govern content in AEM and deliver it to the existing applications through APIs.
- **Deployment:** AEM as a Cloud Service, subject to security approval.
- **Delivery-model boundaries:** The applications retain identity and transaction processing.`,
  Business: `| Requirement ID | Short requirement | Covered / Partially covered / Needs clarification / Gap | Adobe response | Product / deployment model | Caveat / dependency |
|---|---|---|---|---|---|
| CMS-01 | Reuse approved content | Covered | Content Fragments and APIs | AEM Sites headless | API agreement |
| CMS-02 | Send transaction messages | Gap | Use a separate messaging service | External | Owner unknown |`,
  Competition: `| Competitor and status | Where Adobe can win | Where Adobe may lose | Proof needed |
|---|---|---|---|
| Confirmed CMS alternative | Integrated governance | Narrower API-only scope | Comparable customer proof |`,
  Recommendation: `- **Next steps:** Agree the content API and resolve the messaging owner.

| Phase | Work | Entry gate | Exit gate |
|---|---|---|---|
| Crawl | Verify scope; prove the API | Named owners | Accepted API contract |`,
  Rationale: `**1. Customer Context**

The customer needs reusable approved content for two applications.

The customer's applications retain identity, transaction data and messaging execution.

**2. Core Capability Needs**

| Capability need | What the customer needs to do | Relevance |
|---|---|---|
| Reuse | Author once | HIGH |

**3. Proposed Solution & Deployment Rationale**

| Adobe product / capability | Deployment model | Role | Why proposed | Requirement IDs | Dependencies / unresolved decisions |
|---|---|---|---|---|---|
| AEM Sites | AEM as a Cloud Service | Governed authoring | Approved, reusable content [[E1]] | CMS-01 | Security approval; API contract |
| Headless APIs | Content Fragment APIs | Deliver content to both applications | Channel-neutral reuse | CMS-01 | Application ownership |
| Edge Delivery Services | Conditional option, not baseline | Separate public web estate only | Evaluate only if that channel is in scope | None | Confirm the channel |
| AEM Assets | AEM Assets as a Cloud Service | Metadata \\| rights controls | Governed media | DAM-01 | Asset inventory |

**4. Priority Use Cases**

| Use case | Persona | Trigger | Journey | Adobe products/deployment | Requirement IDs | Expected outcome | Proof required | Prerequisites |
|---|---|---|---|---|---|---|---|---|
| Approved content reuse | Content owner | Content update | Author, review, retrieve from both apps | AEM Sites; Content Fragment APIs | CMS-01 | Less duplicate maintenance | Both apps retrieve the approved version | API contract |

**5. Recommendation Summary**

Prefer the integrated content foundation, subject to the security and API gates.`,
};

function assessment() {
  return {
    score: 62,
    verdict: 'Conditional-Go',
    dimensions: [{
      dimension: 'Technical Fit',
      scored: 10,
      max: 18,
      notes: 'API delivery fits; security approval remains open.',
      evidenceRefs: ['E1'],
    }],
    evidence: [{
      id: 'E1',
      type: 'customer-document',
      source: 'Customer requirements',
      claim: 'Both applications need the same approved content. [[E1]]',
    }],
    confidence: [{
      dimension: 'Technical Fit',
      factRefs: ['E1'],
      assumptions: 'Application teams own rendering',
      unknowns: 'Security approval; API ownership',
      scoreChanger: 'Prove the agreed API with both applications.',
    }],
  };
}

test('reads numbered bold subsections without including subsequent sections', () => {
  const result = reportSubsection(sections.Rationale, /proposed solution.*deployment rationale/i);
  assert.match(result, /AEM Assets/);
  assert.doesNotMatch(result, /Priority Use Cases|Recommendation Summary/);
});

test('reads heading-based subsections and retains nested headings', () => {
  const markdown = `## 3. Proposed Solution & Deployment Rationale
### API contract
Keep this detail.
## 4. Priority Use Cases
Do not include this.`;
  const result = reportSubsection(markdown, /deployment rationale/i);
  assert.match(result, /API contract\nKeep this detail/);
  assert.doesNotMatch(result, /Priority Use Cases|Do not include/);
  assert.equal(reportSubsection(markdown, /missing subsection/i), '');
});

test('turns the existing solution table into complete cards without promoting options', () => {
  const view = assessmentViewFor(assessment(), sections);
  assert.equal(view.solutions.length, 4);
  assert.equal(view.solutions[0].product, 'AEM Sites');
  assert.equal(view.solutions[0].deployment, 'AEM as a Cloud Service');
  assert.equal(view.solutions[0].rationale, 'Approved, reusable content');
  assert.deepEqual(view.solutions[0].requirements, ['CMS-01']);
  assert.deepEqual(view.solutions[0].dependencies, ['Security approval', 'API contract']);
  assert.equal(view.solutions[2].deployment, 'Conditional option, not baseline');
  assert.equal(solutionSelection(view.solutions[2]), 'excluded');
  assert.equal(view.solutions[3].role, 'Metadata | rights controls');
});

test('accepts table rows without outer pipes and does not mistake other tables for solutions', () => {
  const view = assessmentViewFor({}, {
    Rationale: `Adobe product / capability | Deployment model | Role | Why proposed
--- | --- | --- | ---
AEM Sites | Cloud Service | Authoring | Governed reuse

Capability need | What the customer needs to do | Relevance
--- | --- | ---
Reuse | Author once | HIGH`,
  });
  assert.equal(view.solutions.length, 1);
  assert.equal(view.solutions[0].product, 'AEM Sites');
});

test('uses actual architecture recommendations and boundaries, not generic score-based copy', () => {
  const view = assessmentViewFor(assessment(), sections);
  assert.equal(view.executive.headline, 'Reusable content and review workflows fit the documented needs.');
  assert.doesNotMatch(view.executive.headline, /discovery|production commitment/i);
  assert.match(view.executive.summary, /Reusable content and review workflows/);
  assert.equal(view.executive.nextAction, 'Agree the content API and resolve the messaging owner.');
  assert.equal(view.architecture.status, 'Provisional architecture');
  assert.equal(view.architecture.headline, 'Govern content in AEM and deliver it to the existing applications through APIs.');
  assert.match(view.architecture.recommendation, /subject to security approval/);
  assert.match(view.architecture.recommendation, /retain identity and transaction processing/);
  assert.equal(view.architecture.summary, 'The customer needs reusable approved content for two applications.');
  assert.match(view.architectureBoundary, /retain identity, transaction data and messaging execution/);
});

test('retains the actual use-case journey, outcome, proof and prerequisites', () => {
  const [useCase] = assessmentViewFor(assessment(), sections).useCases;
  assert.equal(useCase.name, 'Approved content reuse');
  assert.equal(useCase.persona, 'Content owner');
  assert.equal(useCase.journey, 'Author, review, retrieve from both apps');
  assert.deepEqual(useCase.products, ['AEM Sites', 'Content Fragment APIs']);
  assert.equal(useCase.outcome, 'Less duplicate maintenance');
  assert.equal(useCase.proof, 'Both apps retrieve the approved version');
  assert.deepEqual(useCase.prerequisites, ['API contract']);
  assert.equal(useCase.priority, '');
});

test('preserves every requirement including gaps and existing competitor and delivery analysis', () => {
  const view = assessmentViewFor(assessment(), sections);
  assert.deepEqual(view.requirements.map((item) => item.id), ['CMS-01', 'CMS-02']);
  assert.equal(view.requirements[1].status, 'Gap');
  assert.equal(view.requirements[1].response, 'Use a separate messaging service');
  assert.equal(view.competitors[0].name, 'Confirmed CMS alternative');
  assert.equal(view.competitors[0].proof, 'Comparable customer proof');
  assert.equal(view.deliveryPath[0].phase, 'Crawl');
  assert.deepEqual(view.deliveryPath[0].work, ['Verify scope', 'prove the API']);
  assert.equal(view.deliveryPath[0].exitGate, 'Accepted API contract');
});

test('recognizes older named-competitor and delivery-scope headers', () => {
  const view = assessmentViewFor({}, {
    Competition: sections.Competition.replace('Competitor and status', 'Named competitor'),
    Recommendation: sections.Recommendation.replace('| Work |', '| Scope |'),
  });
  assert.equal(view.competitors[0].name, 'Confirmed CMS alternative');
  assert.equal(view.deliveryPath[0].phase, 'Crawl');
});

test('does not turn explicitly unconfirmed market references into deal competitors', () => {
  const view = assessmentViewFor({}, {
    Competition: `${sections.Competition}
| Market example - reference alternative; not confirmed in customer shortlist | Broad platform | Narrow purchase | Confirm roster |`,
  });
  assert.equal(view.competitors.length, 1);
  assert.equal(view.competitors[0].name, 'Confirmed CMS alternative');
});

test('fills legacy dimension briefs with customer evidence and recorded validation work', () => {
  const [detail] = assessmentViewFor(assessment(), sections).dimensionDetails;
  assert.equal(detail.takeaway, 'API delivery fits; security approval remains open.');
  assert.deepEqual(detail.matters, [{
    label: 'Customer requirements',
    text: 'Both applications need the same approved content.',
  }]);
  assert.deepEqual(detail.unknowns, ['Security approval', 'API ownership']);
  assert.deepEqual(detail.assumptions, ['Application teams own rendering']);
  assert.equal(detail.response, undefined);
  assert.deepEqual(detail.verification, [
    'Prove the agreed API with both applications.',
    'Security approval',
    'API ownership',
    'Application teams own rendering',
  ]);
  assert.equal(detail.nextActions.length, 3);
  assert.deepEqual(detail.evidenceRefs, ['E1']);
});

test('treats structured V2 content, including deliberately empty arrays, as authoritative', () => {
  const a = assessment();
  a.assessmentView = {
    version: 2,
    executive: { headline: 'The current structured decision.', conditions: [] },
    architecture: { headline: 'A new architecture decision.' },
    solutions: [],
    useCases: [],
    requirements: [],
    dimensionDetails: [{
      name: 'Technical Fit',
      takeaway: 'A more recent technical finding.',
      response: [],
    }],
  };
  const view = assessmentViewFor(a, sections);
  assert.equal(view.executive.headline, 'The current structured decision.');
  assert.deepEqual(view.executive.conditions, []);
  assert.equal(view.architecture.headline, 'A new architecture decision.');
  assert.deepEqual(view.solutions, []);
  assert.deepEqual(view.useCases, []);
  assert.deepEqual(view.requirements, []);
  assert.equal(view.dimensionDetails[0].takeaway, 'A more recent technical finding.');
  assert.deepEqual(view.dimensionDetails[0].response, []);
});

test('does not mutate or republish the stored assessment', () => {
  const a = assessment();
  const before = JSON.parse(JSON.stringify(a));
  assessmentViewFor(a, sections);
  assert.deepEqual(a, before);
  assert.equal(a.assessmentView, undefined);
  assert.equal(a.score, 62);
});

test('uses recorded context use cases only when the legacy report has no use-case table', () => {
  const a = { context: { use_cases: 'Approved content reuse; Asset discovery' } };
  assert.deepEqual(assessmentViewFor(a).useCases, [
    { name: 'Approved content reuse' },
    { name: 'Asset discovery' },
  ]);
  a.assessmentView = { useCases: [] };
  assert.deepEqual(assessmentViewFor(a).useCases, []);
});

test('handles sparse assessments without inventing products, actions or a low-fit conclusion', () => {
  const view = assessmentViewFor({});
  assert.equal(view.executive.headline, '');
  assert.equal(view.executive.summary, '');
  assert.equal(view.executive.nextAction, '');
  assert.equal(view.architecture.recommendation, '');
  assert.deepEqual(view.solutions, []);
  assert.deepEqual(view.requirements, []);
  assert.deepEqual(view.dimensionDetails, []);
});

test('does not present none or missing confidence values as validation work', () => {
  const a = assessment();
  a.confidence = [{
    dimension: 'Technical Fit',
    assumptions: 'None',
    unknowns: 'n/a',
  }];
  const [detail] = assessmentViewFor(a, sections).dimensionDetails;
  assert.deepEqual(detail.verification, []);
  assert.deepEqual(detail.nextActions, []);
  assert.deepEqual(detail.unknowns, []);
  assert.deepEqual(detail.assumptions, []);
});

test('separates chosen components, conditional options, excluded modes and customer systems', () => {
  assert.equal(solutionSelection({ product: 'Content APIs', role: 'Reusable app content' }), 'recommended');
  assert.equal(solutionSelection({ product: 'AEM Sites', dependencies: ['Security approval'] }), 'recommended');
  assert.equal(solutionSelection({ product: 'Traditional Sites', role: 'Not selected for app runtime' }), 'excluded');
  assert.equal(solutionSelection({ product: 'EDS', role: 'Not in baseline; possible future public site' }), 'excluded');
  assert.equal(solutionSelection({ product: 'Optional delivery', deployment: 'Conditional option' }), 'conditional');
  assert.equal(solutionSelection({ product: 'Another design', role: 'Alternative pattern' }), 'alternative');
  assert.equal(solutionSelection({ product: 'Banking application', deployment: 'Customer-owned runtime' }), 'external');
  assert.equal(solutionSelection({ product: 'Messaging', deployment: 'External customer service' }), 'external');
  assert.equal(solutionSelection({
    product: 'External customer systems', deployment: 'Customer-selected app and identity components',
  }), 'external');
  assert.equal(solutionSelection({
    product: 'Page delivery', rationale: 'Use only for a channel that needs authored pages.',
  }), 'conditional');
  assert.equal(solutionSelection({
    product: 'Hybrid delivery', dependencies: ['Preferred scenario pending channel validation.'],
  }), 'conditional');
});

test('honors explicit selection without silently promoting unknown selection values', () => {
  ['recommended', 'conditional', 'alternative', 'excluded', 'external'].forEach((selection) => {
    assert.equal(solutionSelection({ product: 'Product', selection }), selection);
  });
  assert.equal(solutionSelection({ product: 'Unknown', selection: 'future-production' }), 'unclassified');
  assert.equal(solutionSelection({ product: 'Missing status', selection: null }), 'unclassified');
});

test('does not interpret a pending customer decision as proof the selected capability is absent', () => {
  assert.equal(solutionSelection({
    product: 'AEM Sites',
    deployment: 'AEM as a Cloud Service',
    role: 'Governed content',
    rationale: 'Meet API and workflow needs, subject to customer security approval.',
    dependencies: ['Validate workload', 'Confirm security approval'],
  }), 'recommended');
});

test('distinguishes actual customer story URLs from capability and assurance documentation', () => {
  assert.equal(referenceKind({
    url: 'https://business.adobe.com/customer-success-stories/example-case-study.html',
  }), 'customer-story');
  assert.equal(referenceKind({
    url: 'https://business.adobe.com/uk/customer-success-stories/example-case-study.html',
  }), 'customer-story');
  assert.equal(referenceKind({
    title: 'Customer capabilities',
    url: 'https://business.adobe.com/products/experience-manager/sites.html',
  }), 'product-documentation');
  assert.equal(referenceKind({
    url: 'https://www.aem.live/docs/regulated-industries',
  }), 'product-documentation');
  assert.equal(referenceKind({
    url: 'https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/overview',
  }), 'product-documentation');
  assert.equal(referenceKind({
    url: 'https://www.adobe.com/trust/compliance.html',
  }), 'trust-compliance');
  assert.equal(referenceKind({
    url: 'https://www.adobe.com/trust.html',
  }), 'trust-compliance');
  assert.equal(referenceKind({
    title: 'A customer example without a verified story URL',
    url: 'https://news.example.com/article',
  }), 'other');
  assert.equal(referenceKind({
    title: 'Adobe public reference',
    url: 'https://search.example.com/source-redirect',
    relevance: 'The named customer story describes its governed content adoption.',
  }), 'customer-story');
  assert.equal(referenceKind({
    url: 'https://business.adobe.com/products/experience-manager/sites.html',
    relevance: 'Product capabilities used in a customer story.',
  }), 'product-documentation');
});

test('respects explicit reference kinds and intentionally empty reference collections', () => {
  assert.equal(referenceKind({
    url: 'https://www.aem.live/docs/architecture',
    kind: 'other',
  }), 'other');
  assert.equal(referenceKind({ kind: 'unsupported-category' }), 'other');
  const a = assessment();
  a.evidence.push({
    id: 'E2',
    type: 'public-source',
    source: 'Product documentation',
    locator: 'https://www.aem.live/docs/architecture',
    claim: 'Describes delivery architecture.',
  });
  assert.equal(assessmentViewFor(a).publicReferences.length, 1);
  a.assessmentView = { publicReferences: [] };
  assert.deepEqual(assessmentViewFor(a).publicReferences, []);
});

function scoreDetail() {
  return {
    criteria: [
      {
        criterion: 'Integration',
        scored: 6,
        max: 8,
        rationale: 'API capabilities fit; the customer contract is still unverified.',
        evidenceRefs: ['E1'],
      },
      {
        criterion: 'Operating constraints',
        scored: 4,
        max: 10,
        rationale: 'The available design evidence is incomplete; the estimate is provisional.',
        evidenceRefs: ['E2'],
      },
    ],
  };
}

test('only presents a point breakdown when its values reconcile to the recorded dimension', () => {
  const dimension = { scored: 10, max: 18 };
  const detail = scoreDetail();
  const before = structuredClone(detail);
  assert.deepEqual(scoreBreakdownFor(dimension, detail), {
    status: 'valid',
    criteria: detail.criteria,
    scored: 10,
    max: 18,
  });
  assert.deepEqual(detail, before);
  assert.deepEqual(scoreBreakdownFor(dimension), { status: 'missing', criteria: [] });
  assert.equal(scoreBreakdownFor(dimension, { criteria: [] }).status, 'missing');
});

test('rejects invented or mismatched score arithmetic instead of changing the assessment', () => {
  const dimension = { scored: 10, max: 18 };
  assert.equal(scoreBreakdownFor({ scored: 12, max: 18 }, scoreDetail()).status, 'mismatch');
  assert.equal(scoreBreakdownFor({ scored: 10, max: 20 }, scoreDetail()).status, 'mismatch');
  [
    { scored: -1 }, { scored: 9 }, { scored: '6' }, { scored: NaN }, { scored: Infinity },
    { max: 0 }, { rationale: '' }, { criterion: '' },
  ].forEach((changes) => {
    const detail = scoreDetail();
    Object.assign(detail.criteria[0], changes);
    assert.equal(scoreBreakdownFor(dimension, detail).status, 'invalid');
  });
  assert.equal(scoreBreakdownFor(dimension, { criteria: {} }).status, 'invalid');
  assert.equal(scoreBreakdownFor(dimension, { criteria: [null] }).status, 'invalid');
  assert.deepEqual(dimension, { scored: 10, max: 18 });
});

test('accepts fractional point totals without floating point mismatches', () => {
  const detail = {
    criteria: [
      {
        criterion: 'One', scored: 0.1, max: 0.3, rationale: 'First recorded criterion.',
      },
      {
        criterion: 'Two', scored: 0.2, max: 0.4, rationale: 'Second recorded criterion.',
      },
    ],
  };
  assert.equal(scoreBreakdownFor({ scored: 0.3, max: 0.7 }, detail).status, 'valid');
});
