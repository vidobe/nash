const COMMON_GUIDANCE = [
  {
    title: 'One answer format, authored solution knowledge',
    text: 'Use the same assessment schema and reason-explanation format for every solution and mixed-solution assessment, with domain-specific criteria inside that schema. Review Strategic Fit, Technical Fit, Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk and AI & Agentic Fit explicitly. Use fetched DA-authored solution knowledge and domain criteria, but current official documentation takes precedence over stale capability claims or default stack advice. Illustrative weights and unsupported score bands are not an approved calibrated rubric. Never force an AI weight or purchase. Identify material source conflicts rather than silently treating old claims as product proof.',
  },
  {
    title: 'Modern-first, supported architecture',
    text: 'Evaluate current generally available, supported approaches first. Verify the applicable version, availability, entitlement and constraints from current official sources. Latest, preview, beta and early access do not imply safe production availability. Product age alone does not make a product legacy. Recommend only components needed for the customer requirements; do not add every possible deployment mode or adjacent product.',
  },
  {
    title: 'Explicit architecture choices and older-stack exceptions',
    text: 'Classify every solution or component as recommended, conditional, alternative, excluded or external. Only recommended components form the proposed baseline; name the condition for conditional components and keep alternatives and exclusions out of recommended architecture cards and diagrams. External customer systems are integration boundaries, not Adobe recommendations. An older stack may be appropriate, but every exception must record the exact requirement, modern approach evaluated, older approach required, why the modern approach cannot meet it, evidence and trade-off. Unsupported preference or industry stereotypes are not blockers.',
  },
  {
    title: 'Explain conclusions, not repeated sales narratives',
    text: 'For each dimension, explain the actual conclusion through scoreRationale and concrete criteria with rationale and evidenceRefs. Keep product fit, implementation readiness, evidence confidence and commercial qualification distinct. Do not invent a neutral 50 from missing budget or treat absent customer-specific approval as demonstrated product deficiency. Without an approved calibrated rubric, keep score, weight and point values null, set scoreBasis to unscored and explain why; an unknown is not a zero or an unfavorable risk rating. Preserve historical recorded scores without recomputing them. Record unknowns separately in unknowns. Banking use is not itself a negative signal. Keep the decision and next action at overview level rather than repeating matters, response, verification and next-action templates in every dimension.',
  },
  {
    title: 'Evidence, uncertainty and public reference kinds',
    text: 'Separate documented product capabilities, customer-specific integration/security/contract acceptance, actual proven limitations and unknowns. Support capability claims and limitations with traceable evidence; do not turn an unknown into an asserted capability gap. Use only sourced, public, customer-shareable URLs and classify each reference as customer-story, product-documentation, trust-compliance or other. Product documentation is not a customer story. Customer stories demonstrate relevant experience, not proof of every customer contract requirement. Do not invent sector references; categories without verified references may remain empty. Keep product-specific compliance facts within the relevant product and scope.',
  },
  {
    title: 'Customer-specific decision and supporting analysis',
    text: 'The executive headline is a customer-specific fit thesis, never an instruction to discover, approve or validate something. Put material conditions and the single best next action in the overview. Dimension details explain their conclusions and criteria. Deep Markdown supports source analysis and must not duplicate complete structured requirement, competitor, delivery or scoring matrices. Use one linked acceptance-gate register. AI review must distinguish native AI, named product agents, Coworker/MCP, availability, entitlement, sensitive-data controls and measurable workflow value; optional AI must not become a core-production prerequisite.',
  },
  {
    title: 'Reassess source claims and preserve requirement traceability',
    text: 'A preliminary vendor answer is a hypothesis, not a capability verdict: reassess both Yes and No against the actual question and applicable evidence. Do not copy a draft No into a Gap without establishing the precise unsupported responsibility. Keep required capabilities in the baseline even when the particular offering, license or implementation route remains conditional. Link recommended components and use cases to real source requirement IDs when a manifest exists. Every cited acceptance-gate ID, including references in prose and dependencies, must exist in the single gate register.',
  },
];

const FAMILY_GUIDANCE = [
  {
    slugs: ['aem'],
    title: 'AEM Sites: authoring and delivery are separate choices',
    text: 'For AEM web delivery, explicitly evaluate Edge Delivery Services first, headless or hybrid delivery only when channel needs warrant it, and traditional Java/JCR page delivery only for a documented blocker. App-only content APIs need not add a page-rendering tier. AEM Sites authoring, deployment, governance or Content Fragments do not imply traditional Java page rendering. Content Fragments can also publish as self-contained semantic HTML through EDS; APIs versus HTML is a channel decision. Do not list every AEM delivery mode in the proposed baseline. Official sources verified on 2026-11-09: https://www.aem.live/docs/architecture and https://www.aem.live/developer/content-fragment-overlay. Confirm current scope and applicability rather than treating this guidance as a substitute for source verification.',
  },
  {
    slugs: ['aem'],
    title: 'AEM Edge Delivery Services in regulated industries',
    text: 'Do not claim EDS cannot serve regulated industries or lower Technical Fit just because the customer is a bank. Official guidance documents regulated-industry use and customer-managed CDN, WAF, SSO, audit and approval patterns: https://www.aem.live/docs/regulated-industries, verified on 2026-11-09. Validate the specific controls, deployment boundaries, default residency and sovereign options against current documentation, scope and entitlement; these are not blanket guarantees. A customer acceptance decision still outstanding is an unknown, not a proven EDS limitation. Apply these AEM facts only to AEM, not other solutions.',
  },
  {
    slugs: ['aem'],
    title: 'AEM content APIs and template responsibilities',
    text: 'For a REST content-delivery requirement evaluate the current native Content Fragment Delivery with OpenAPI first, not an outdated GraphQL-only or custom JSON Exporter default. Select one primary route; GraphQL is an alternative only with a specific query need and an accepted API contract, not an unexplained and/or recommendation. Verify activation, caching, freshness, rate limits and authorization boundaries at https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/aem-content-fragment-delivery-with-openapi. Do not confuse an edge key or CORS with customer identity or repository ACL authorization. For SMS/email requirements separate authoring, storage, localization, placeholder syntax, preview, runtime resolution and sending. AEM not being a messaging execution platform does not prove that template content cannot be authored or governed; conversely generic content storage does not prove a specialized template editor or safe rendering. Identify the exact responsibility and missing proof instead of applying blanket Yes/No claims.',
  },
  {
    slugs: ['aem-assets', 'aem-forms', 'aem-guides'],
    title: 'AEM product boundaries',
    text: 'Qualify Assets, Forms or Guides against their own authored capabilities, dimensions, workflows and current supported deployment choices. Do not infer a Sites page-rendering requirement or import Sites/EDS compliance claims just because products share the AEM name. Propose media delivery, content APIs, forms processing or publishing components only when a traced requirement needs them.',
  },
  {
    slugs: ['analytics', 'cja', 'content-analytics', 'marketing-campaign-analytics'],
    title: 'Analytics and measurement',
    text: 'Evaluate current supported collection SDKs, APIs and measurement approaches against the authored solution criteria before older implementation patterns. Distinguish Adobe Analytics from Customer Journey Analytics and other measurement products; do not make a replatform or additional product mandatory without a requirement. Keep instrumentation, identity, consent, data quality, data coverage and analyst operating model distinct from demonstrated product limits. Verify edition, connector and data-source scope rather than assuming every analysis feature is included.',
  },
  {
    slugs: ['experience-platform', 'rtcdp', 'journey-optimizer', 'journey-optimizer-b2b', 'audience-manager'],
    title: 'Data, audiences and journey activation',
    text: 'Evaluate current supported data collection, identity, audience and activation approaches for the specific use case. Keep platform services, RTCDP, Journey Optimizer and adjacent products commercially and functionally distinct; do not include every application in the baseline. Verify consent, batch versus real-time needs, destinations, regional availability, edition entitlements and documented limits. Treat customer data readiness and integration acceptance separately from product capabilities.',
  },
  {
    slugs: ['campaign', 'marketo', 'journey-optimizer', 'journey-optimizer-b2b', 'marketo-measure', 'marketo-optimizer', 'marketo-qualifier'],
    title: 'Messaging and B2B orchestration',
    text: 'Compare current supported editions and approaches against the customer messaging, B2B lifecycle and operating-model requirements. Do not assume Journey Optimizer replaces Campaign or Marketo for every use case, or that a long-established supported product is legacy. Any required older edition or deployment must have the same requirement, modern comparison, evidence and trade-off explanation as other older-stack exceptions. Verify channel, integration, deliverability and licensing scope from official sources.',
  },
  {
    slugs: ['commerce', 'commerce-optimizer'],
    title: 'Commerce scope and delivery',
    text: 'Evaluate current supported commerce APIs, storefront and integration approaches before older custom-stack defaults, using the authored product boundaries. Do not assume a storefront, transaction platform or existing ERP/order-management system must all be replaced. Trace the required checkout, catalog, identity and transaction boundaries to customer evidence and verify extension compatibility, deployment support and entitlement before recommending an approach.',
  },
  {
    slugs: ['workfront', 'aem-assets', 'adobe-express', 'frame-io', 'firefly-services', 'firefly-creative-production', 'firefly-custom-models', 'firefly-foundry', 'firefly-graph'],
    title: 'Content supply chain and creative production',
    text: 'Use the authored workflow, asset and production criteria to choose supported native services and integrations before older custom orchestration. Keep work management, asset governance, creative production and distribution responsibilities explicit rather than proposing every adjacent product. Verify rights, data handling, review controls, integration availability and entitlements. AI and agentic accelerators remain optional unless their production availability, governance and requirement fit are confirmed.',
  },
  {
    slugs: ['target', 'sites-optimizer', 'llmo', 'llm-apps', 'advertising', 'brand-concierge'],
    title: 'Optimization, visibility and experience activation',
    text: 'Evaluate the current supported capabilities of the selected optimization, visibility or activation product against its authored criteria. Do not treat adjacent products as interchangeable or assume the solution needs an entire CMS, data platform or agent stack. Separate measurement and integration readiness from proven product constraints, and verify feature availability, channel support, consent and licensing before making a capability part of the production baseline.',
  },
];

export function solutionGuidance(slugs = []) {
  const selected = new Set((Array.isArray(slugs) ? slugs : [])
    .filter((slug) => typeof slug === 'string')
    .map((slug) => slug.trim().toLowerCase()));
  return [
    ...COMMON_GUIDANCE,
    ...FAMILY_GUIDANCE.filter((family) => family.slugs.some((slug) => selected.has(slug))),
  ].map(({ title, text }) => ({ title, text }));
}

export function solutionGuidanceText(slugs = []) {
  return solutionGuidance(slugs).map(({ title, text }) => `${title}\n${text}`).join('\n\n');
}
