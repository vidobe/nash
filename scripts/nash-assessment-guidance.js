/**
 * The shared assessment policy: one rulebook for every solution, stage and prompt. Stage prompts
 * add only stage-specific instructions and output shapes.
 */
const ASSESSMENT_POLICY = [
  {
    title: 'Purpose and one answer format',
    text: 'Show the Adobe account team how well the selected Adobe solutions fit this opportunity across Strategic Fit, Technical Fit, Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk and AI & Agentic Fit, why, and what would change the picture. Use the same schema and explanation format for every solution and mixed-solution assessment. Map the criteria of ALL selected solution skills into the seven dimensions; do not silently replace another product\'s criteria with AEM criteria. Use the fetched DA-authored solution knowledge, but current official documentation takes precedence over stale capability claims or default stack advice. Rate every dimension against the Nash rubric anchors; weights or blank scorecards in a customer template belong to the buyer and are not ratings. Identify material source conflicts rather than silently treating old claims as product proof.',
  },
  {
    title: 'Keep six questions apart',
    text: 'For every requirement and conclusion, keep these questions apart: does the product have the capability; how well does it meet this exact requirement (fit); is it part of the Adobe offer being proposed (offer); is the customer ready to adopt it; does the customer still have to accept it through their own tests, security review or contract; and how strong is the evidence (confidence). Customer-specific acceptance is normal procurement work, not a product weakness, and a customer approval that has not happened yet is not a product deficiency. A choice the customer has not made yet, such as an add-on, edition, plan or deployment option, is an item for the proposal, not a capability gap. A bank or other regulated buyer is not a negative signal: Adobe serves many regulated customers, so check the specific controls asked for instead of assuming a gap. An unknown is neither a zero nor a proven weakness.',
  },
  {
    title: 'Evidence and customer-shareable references',
    text: 'Cite only sources actually read, and say what was cut off or not read. Separate documented capabilities, customer-specific acceptance, proven limitations and unknowns; support capability claims and limitations with traceable evidence and never turn an unknown into an asserted gap. A published standard that is weaker than a stricter customer requirement does not meet it: state what Adobe documents and treat the difference as a contract point to confirm. Never invent certifications, SLAs, prices, benchmarks, ROI, customer approvals, customer stories, page or sheet locations, dates or roadmap commitments. Customer-shareable references use the exact public https URL of the page itself, never a search or redirect link, and are grouped as customer stories, product documentation and trust/compliance, with other only when none fits. Product documentation is not a customer story, and a customer story shows relevant experience, not proof of a contract requirement. Never invent sector references; an empty group is honest. Internal Highspot, SharePoint, wiki and Fluffy sources stay internal; NEVER place them in customer-shareable references. Keep product-specific compliance facts within their product and scope, and never put confidential customer details into web searches.',
  },
  {
    title: 'One supported architecture baseline',
    text: 'Evaluate current generally available, supported approaches first and verify version, availability, entitlement and constraints from current official sources. Latest, preview, beta and early access are not proof of production readiness, and product age alone does not make a product legacy. Recommend ONE baseline with only the components the requirements need, and give every solution or component a selection: recommended, conditional (with its precise trigger), alternative, excluded or external. Customer-owned identity, applications, data and transactions are external integration boundaries, not Adobe recommendations. Only recommended entries form the baseline; keep alternatives and exclusions out of the recommended architecture. Required capability is not optional just because its specific offering/entitlement is undecided. An older stack may be appropriate, but each exception records the exact requirement, the modern approach evaluated, the older approach required, why the modern approach cannot meet it, the evidence and the trade-off; preference or industry stereotypes are not blockers. Link recommended components and use cases to real source requirement IDs.',
  },
  {
    title: 'Conclusions, headline and acceptance gates',
    text: 'Each dimension explains why it has this rating and not one higher or lower, with customer-specific criteria, evidence, unknowns and what would move the rating. A dimension without customer-specific evidence is rated 3 with Low confidence and marked as having no evidence yet; say exactly what to find out. Explain the actual reasons for each dimension. Do not repeat "what matters/how Adobe should respond" or action templates in every dimension. The executive headline is a short solution-and-customer title of about 6-10 words, for example "Unified CMS and DAM for Acme Bank" or "Customer journey orchestration for Acme"; adapt the scope to the selected solutions, because these are examples, not defaults. Never put fit judgments, risk statements, evidence caveats or approval/discovery instructions in the title. Put the fit conclusion in executive.summary, caveats in executive.conditions and one best next action in executive.nextAction. Keep one acceptance-gate register for the genuinely open items, refer to gates by ID instead of repeating lists, and make sure every cited gate exists. Supporting Markdown must not duplicate the structured matrices.',
  },
  {
    title: 'Competitors',
    text: 'Mark each competitor as incumbent (the customer\'s current vendor for this scope), named (named by the customer in its documents or conversations) or typical (a common alternative the customer has not named). A vendor list in an evaluation template is not proof of an active bid or ranking. Explain where Adobe wins or loses against THIS customer\'s requirements, using the competitive knowledge provided. Do not claim competitor prices or weaknesses without evidence. Blank scorecards and prices are unknown, not zero.',
  },
  {
    title: 'AI and agentic upside',
    text: 'AI & Agentic Fit is upside: it is rated and shown but not counted in the total. Rate the realistic value of native product AI, named product agents, Adobe Coworker and MCP for this customer\'s workflows, including value beyond literal RFI wording, without inventing buyer demand. Check availability, exact entitlement, regional scope, governance, human review and sensitive-data boundaries, and mark unavailable or unverified agents honestly. AI purchase or adoption is never a prerequisite for the core project.',
  },
  {
    title: 'Build on draft answers and keep traceability',
    text: 'Answers already drafted in the customer workbook are prior work by the account team: keep them when the evidence and product knowledge support them and change them only with a stated reason. Preserve source question IDs, wording, priorities and unclassified priorities; repeated questions with distinct IDs stay distinct, without a double penalty. Procurement implications need buyer confirmation; never invent automatic disqualification. RTO/RPO, cache freshness, throughput and support terms keep their exact documented scope and measurement boundaries.',
  },
];

/** How each requirement row is judged: one fit and one offer value. Shared by every stage. */
export const FIT_POLICY = `REQUIREMENT FIT AND OFFER
Judge each requirement on capability: can the proposed Adobe solutions meet it, and how? Choose exactly one fit:
- Out of the box: a standard capability of the proposed product, available without custom work.
- Configuration: delivered by configuring the product (settings, workflows, templates, permissions, metadata, supported integrations).
- Custom build: achievable on the platform with custom code or significant implementation work; name the route in solution.
- Partner or third party: needs a named partner solution, marketplace extension or product outside the proposed scope.
- Not supported: the proposed products cannot reasonably deliver it.
- Needs clarification: the question is genuinely ambiguous or depends on a fact about the customer that you cannot infer; name what is missing in caveat. Use it rarely.
Then choose exactly one offer:
- Included: part of the Adobe offer being proposed.
- Add-on: needs an Adobe add-on, edition, plan or option that the proposal must include.
- Not included: delivered outside the Adobe offer (by a partner, a third party or the customer), or not delivered at all.
- Unknown: the evidence does not show which.
Rules:
- When an add-on, edition, plan or option delivers the requirement, give the fit of that capability and set offer to Add-on. An undecided purchase is never a reason for Needs clarification.
- Customer-specific acceptance (their tests, security review or contract) is normal procurement work, not a reason for Needs clarification or a lower fit.
- When a row has a draft, start from its answer, note and evidence. Keep it when the evidence and the solution knowledge support it, and change it only with the reason stated in response. A documented draft "Yes" is normally Out of the box or Configuration; choose Custom build or Partner or third party when the note shows implementation work or another product. A draft "No" is Not supported only when the product genuinely lacks the capability; if customization, a partner or another Adobe product can deliver it, choose that fit and say which.
- Service terms (security, privacy, availability, recovery, performance, support and exit): when Adobe's documented standard meets the request, choose Out of the box and name any plan or option condition. When the request asks for more than Adobe documents, give what Adobe documents and put the difference in caveat as a contract point to confirm; the fit is then Needs clarification, or Not supported when Adobe states that the term is not offered.
- Answer the exact responsibility asked. Authoring, storage, delivery and sending are different capabilities: a product that does not send messages can still author and govern their content.`;

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
    ...ASSESSMENT_POLICY,
    ...FAMILY_GUIDANCE.filter((family) => family.slugs.some((slug) => selected.has(slug))),
  ].map(({ title, text }) => ({ title, text }));
}

export function solutionGuidanceText(slugs = []) {
  return solutionGuidance(slugs).map(({ title, text }) => `${title}\n${text}`).join('\n\n');
}

/**
 * Splits the shared policy out of fetched skills text, so a prompt can state it once, ahead of
 * the solution knowledge, whether or not the skills text already carries it.
 */
export function separatePolicy(skills = '') {
  const policy = solutionGuidanceText();
  const index = skills.indexOf(policy);
  if (index < 0) return { policy, knowledge: skills };
  const before = skills.slice(0, index).trimEnd();
  const after = skills.slice(index + policy.length).trimStart();
  return { policy, knowledge: [before, after].filter(Boolean).join('\n\n') };
}
