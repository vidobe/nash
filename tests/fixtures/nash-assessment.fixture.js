import { ASSESSMENT_DIMENSIONS } from '../../scripts/nash-assessment-contract.js';

export function sourceRequirements(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    id: `REQ-${index + 1}`,
    priority: index % 3 ? 'M' : 'Unclassified',
    question: `Can approved example content support workflow ${index + 1}?`,
    source: 'Example requirements.xlsx',
    locator: `Requirements, row ${index + 2}`,
  }));
}

export function requirementResponse(source) {
  return {
    id: source.id,
    priority: source.priority,
    requirement: `Approved content for workflow ${source.id}`,
    status: 'Needs clarification',
    response: 'The documented governance capability fits; the consumer contract remains to be agreed.',
    solution: 'Adobe Experience Manager Sites',
    caveat: 'Customer implementation is not yet demonstrated.',
    owner: 'Customer application architect',
    validation: 'Demonstrate the approved content in the named consuming application.',
    evidenceRefs: ['E1', 'E2'],
  };
}

export function canonicalAssessment() {
  const view = {
    version: 2,
    contractVersion: 3,
    meta: { score: null, verdict: 'Conditional-Go', cms: 'n/a' },
    scoring: { status: 'not-calibrated', reason: 'No approved numerical rubric was provided.' },
    executive: {
      headline: 'Unified content services for Example Organization',
      summary: 'The supported authoring capability fits. Customer acceptance remains open.',
      conditions: ['Agree the consuming application contract.'],
      nextAction: 'Demonstrate a reviewed content update in the application.',
    },
    context: {
      objectives: 'Reuse approved content',
      challenges: 'Duplicated updates',
      tech_stack: 'Existing customer application',
      success: 'One approved update is reusable',
      use_cases: 'Reviewed content reuse',
    },
    architecture: {
      headline: 'Govern content centrally and preserve the application boundary',
      summary: 'A new page-rendering tier is not assumed.',
      recommendation: 'Use governed authoring and the supported delivery API.',
      legacyExceptions: [],
    },
    architectureBoundary: 'The customer retains identity, transactions and channel rendering.',
    solutions: [{
      product: 'Adobe Experience Manager Sites',
      deployment: 'Cloud Service',
      selection: 'recommended',
      role: 'Governed content authoring',
      rationale: 'Reusable approved content addresses the documented workflow.',
      requirements: ['REQ-1'],
      dependencies: ['Agreed API contract'],
      evidenceRefs: ['E1', 'E2'],
    }],
    valueMappings: [{
      customerNeed: 'Reduce duplicate maintenance',
      adobeCapability: 'Governed reusable content',
      outcome: 'One reviewed content change serves the application.',
    }],
    useCases: [{
      name: 'Reviewed content reuse',
      journey: 'Author, approve, retrieve and render.',
      products: ['Adobe Experience Manager Sites'],
      requirements: ['REQ-1'],
      outcome: 'Less duplicate maintenance',
      proof: 'The application retrieves the approved version.',
      prerequisites: ['An agreed application API contract'],
      evidenceRefs: ['E1', 'E2'],
    }],
    dimensions: ASSESSMENT_DIMENSIONS.map((dimension) => ({
      dimension,
      scored: null,
      max: null,
      weight: null,
      notes: `${dimension} needs the documented capability and customer acceptance to be distinguished.`,
      evidenceRefs: ['E1', 'E2'],
    })),
    dimensionDetails: ASSESSMENT_DIMENSIONS.map((name) => ({
      name,
      takeaway: `${name} remains a qualitative conclusion.`,
      scoreRationale: 'The requirement has supporting capability evidence; acceptance is not yet demonstrated.',
      scoreBasis: 'unscored',
      criteria: [{
        criterion: 'Documented capability versus customer acceptance',
        status: 'conditional',
        scored: null,
        max: null,
        rationale: 'Supported capability is not the same as a completed customer implementation.',
        evidenceRefs: ['E1', 'E2'],
      }],
      unknowns: ['The application contract is not approved.'],
      sections: [],
      gateRefs: ['G1'],
      evidenceRefs: ['E1', 'E2'],
    })),
    requirements: sourceRequirements().map(requirementResponse),
    competitors: [{
      name: 'Example alternative',
      status: 'Listed; not assessed',
      win: 'An integrated governance demonstration may differentiate.',
      lose: 'Commercial comparison is unknown.',
      proof: 'Run the same accepted workflow.',
    }],
    deliveryPath: [{
      phase: 'Crawl',
      objective: 'Agree the contract',
      entryGate: 'G1 review is staffed',
      exitGate: 'G1 accepted',
      work: ['Demonstrate approved content retrieval'],
      agent: 'Not required',
    }],
    verificationGates: [{
      id: 'G1',
      title: 'Application contract',
      status: 'open',
      owner: 'Customer application architect',
      acceptance: 'The application retrieves and renders an approved version.',
      requirements: ['REQ-1'],
      evidenceRefs: ['E1', 'E2'],
    }],
    evidence: [{
      id: 'E1',
      type: 'customer-document',
      source: 'Example requirements.xlsx',
      locator: 'Requirements, A2:E3',
      claim: 'The application needs reviewed reusable content.',
    }, {
      id: 'E2',
      type: 'public-source',
      source: 'Official AEM architecture documentation',
      locator: 'https://www.aem.live/docs/architecture',
      claim: 'Supported delivery architecture must match the channel requirements.',
    }],
    confidence: ASSESSMENT_DIMENSIONS.map((dimension) => ({
      dimension,
      level: 'Medium',
      factRefs: ['E1', 'E2'],
      assumptions: 'None',
      unknowns: 'Customer acceptance is not documented.',
      scoreChanger: 'An accepted application contract would improve this conclusion.',
    })),
    publicReferences: [{
      id: 'E2',
      title: 'Official AEM architecture documentation',
      url: 'https://www.aem.live/docs/architecture',
      kind: 'product-documentation',
      relevance: 'Delivery architecture',
      limitation: 'Does not establish customer acceptance.',
      verification: 'Available in the supplied test evidence register.',
    }],
    reportMarkdown: '# 1. Executive Overview\nThe example workflow has a conditional fit.',
  };
  view.dimensionDetails.at(-1).sections = [
    'Native product AI', 'Product agents', 'Coworker and MCP', 'Readiness and governance',
  ].map((title) => ({
    title,
    paragraphs: ['Applicability and entitlement require customer-specific verification.'],
    evidenceRefs: ['E1'],
  }));
  return view;
}

export function responseText(view = canonicalAssessment()) {
  return `NASH_ASSESSMENT_V2:\n${JSON.stringify(view)}\nNASH_ASSESSMENT_V2_END`;
}
