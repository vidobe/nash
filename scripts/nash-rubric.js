/*
 * Nash qualification rubric. The model rates each dimension 1–5 against these anchors;
 * Nash computes the points, total and verdict so the arithmetic is never model-generated.
 */
export const RUBRIC_METHOD = 'nash-rubric-v1';

export const RUBRIC = [
  {
    dimension: 'Strategic Fit',
    weight: 20,
    anchors: [
      'The documented strategy points away from these solutions (another platform committed, or the need is outside their scope).',
      'Weak alignment: most of the core need sits outside the selected solutions.',
      'Plausible alignment, but business drivers, sponsor or timing are not evidenced.',
      'A documented initiative clearly matches what the selected solutions do; sponsor or timing partly evidenced.',
      'A sponsored, time-bound initiative maps directly onto the selected solutions and their strengths.',
    ],
  },
  {
    dimension: 'Technical Fit',
    weight: 20,
    anchors: [
      'A documented hard blocker (e.g. mandatory hosting, platform or integration the product cannot support).',
      'Material technical conflicts that need significant custom work or exceptions.',
      'Mixed or unknown: key integration, hosting, residency or non-functional facts are open, or several need custom work.',
      'Fits with standard integration and configuration; a few non-functional items need customer-specific confirmation.',
      'Architecture, integrations, security and non-functional requirements fit documented, supported capabilities with no material blocker.',
    ],
  },
  {
    dimension: 'Functional Coverage',
    weight: 20,
    anchors: [
      'Below 40% weighted coverage.',
      '40–59% weighted coverage.',
      '60–74% weighted coverage.',
      '75–89% weighted coverage.',
      '90% or more weighted coverage with out-of-the-box or configuration answers.',
    ],
  },
  {
    dimension: 'Commercial Viability',
    weight: 15,
    anchors: [
      'No funding, or a commercial disqualifier (e.g. a mandated no-licence-cost approach).',
      'Evidence of budget constraints well below the expected investment, or procurement barriers.',
      'Budget, timing or procurement path unknown or mixed.',
      'A funded project or budget is evidenced; the procurement path is plausible.',
      'Budget, timeline and procurement path are evidenced and match the expected Adobe investment, or an existing Adobe agreement applies.',
    ],
  },
  {
    dimension: 'Competitive Position',
    weight: 15,
    anchors: [
      'Evidence that the decision is effectively made for another vendor, or the requirements are written around a competitor.',
      'A competitor is incumbent or favoured, and Adobe differentiators matter less for the stated needs.',
      'Open field, or competitors and their standing are unknown.',
      'Adobe differentiators clearly align with the key requirements; credible against the named alternatives.',
      'Adobe is incumbent or preferred, and its differentiators map to the Must requirements where competitors are weak.',
    ],
  },
  {
    dimension: 'Delivery Risk',
    weight: 10,
    anchors: [
      'Very high risk: infeasible timeline or scope, or critical dependencies outside anyone\'s control.',
      'High risk: aggressive timeline, large migration, many custom integrations or skills gaps.',
      'Moderate or unknown: timeline, migration volume, team or partner not established.',
      'Manageable: a standard migration and integration effort with some open items.',
      'Low risk: clear scope, realistic timeline, experienced team or partner and proven patterns.',
    ],
  },
  {
    dimension: 'AI & Agentic Fit',
    weight: 0,
    upside: true,
    anchors: [
      'AI is explicitly out of scope or prohibited for this customer.',
      'Limited relevance, or significant policy or data constraints on AI use.',
      'Some potential; customer readiness, availability or governance are unknown.',
      'Clear opportunities in the customer\'s workflows that available Adobe AI can serve.',
      'Explicit AI or agentic requirements that map to available Adobe AI, with governance in place.',
    ],
  },
];

export const ASSESSMENT_DIMENSIONS = RUBRIC.map((rule) => rule.dimension);

export const FIT_LEVELS = [
  { fit: 'Out of the box', status: 'Covered', value: 1 },
  { fit: 'Configuration', status: 'Covered', value: 1 },
  { fit: 'Custom build', status: 'Partially covered', value: 0.5 },
  { fit: 'Partner or third party', status: 'Partially covered', value: 0.5 },
  { fit: 'Not supported', status: 'Gap', value: 0 },
  { fit: 'Needs clarification', status: 'Needs clarification', value: 0.5 },
];

const FIT_ALIASES = {
  ootb: 'Out of the box',
  'out-of-the-box': 'Out of the box',
  configurable: 'Configuration',
  config: 'Configuration',
  custom: 'Custom build',
  customization: 'Custom build',
  partner: 'Partner or third party',
  'third party': 'Partner or third party',
  'third-party': 'Partner or third party',
};

/** Whether the requirement is part of the Adobe offer being proposed, separate from its fit. */
export const OFFER_LEVELS = ['Included', 'Add-on', 'Not included', 'Unknown'];

const OFFER_ALIASES = {
  'in scope': 'Included',
  standard: 'Included',
  addon: 'Add-on',
  'add on': 'Add-on',
  'additional offering': 'Add-on',
  'separately licensed': 'Add-on',
  'not in scope': 'Not included',
  'out of scope': 'Not included',
  external: 'Not included',
  tbd: 'Unknown',
  unclear: 'Unknown',
};

/** The four parts of coverage, each grouping the fits that share a requirement status. */
const COVERAGE_PARTS = {
  Covered: 'standard',
  'Partially covered': 'custom',
  'Needs clarification': 'open',
  Gap: 'unsupported',
};

const COVERAGE_BANDS = [[90, 5], [75, 4], [60, 3], [40, 2]];

export function normalizeOffer(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  return OFFER_LEVELS.find((level) => level.toLowerCase().replace('-', ' ') === text)
    || OFFER_ALIASES[text] || null;
}

export function normalizeFit(value) {
  const text = String(value || '').trim().toLowerCase();
  const level = FIT_LEVELS.find((item) => item.fit.toLowerCase() === text);
  return level ? level.fit : FIT_ALIASES[text] || null;
}

export function statusForFit(fit) {
  return FIT_LEVELS.find((item) => item.fit === fit)?.status || null;
}

export function priorityWeight(priority) {
  const value = String(priority || '').trim().toLowerCase();
  if (/^(?:m|must|mandatory|required|critical|high|p1)\b/.test(value)) return 3;
  if (/^(?:s|should|important|medium|p2)\b/.test(value)) return 2;
  return 1;
}

export function ratingValue(value) {
  const number = typeof value === 'string' && /^\s*[1-5]\s*$/.test(value) ? Number(value) : value;
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
}

export function verdictForScore(score) {
  if (score >= 70) return 'Go';
  if (score >= 50) return 'Conditional-Go';
  return 'No-go';
}

/** Whole percentages that always add up to 100 (largest remainder). */
function wholeShares(weights, total) {
  const exact = weights.map((weight) => (weight / total) * 100);
  const shares = exact.map((value) => Math.floor(value + 1e-9));
  let left = 100 - shares.reduce((sum, value) => sum + value, 0);
  exact.map((value, index) => [value - shares[index], index])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .forEach(([remainder, index]) => {
      if (left > 0 && remainder > 1e-9) {
        shares[index] += 1;
        left -= 1;
      }
    });
  return shares;
}

/** Priority-weighted share of the requirement matrix that the proposed solutions meet. */
export function functionalCoverage(rows = []) {
  const counts = Object.fromEntries(FIT_LEVELS.map((level) => [level.fit, 0]));
  const partNames = Object.values(COVERAGE_PARTS);
  const partRows = Object.fromEntries(partNames.map((name) => [name, 0]));
  const partWeights = Object.fromEntries(partNames.map((name) => [name, 0]));
  const offerCounts = Object.fromEntries(OFFER_LEVELS.map((level) => [level, 0]));
  const addOns = [];
  const mustGaps = [];
  let met = 0;
  let total = 0;
  let unsourced = 0;
  let assessed = 0;
  let offered = 0;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const level = FIT_LEVELS.find((item) => item.fit === row?.fit);
    if (!level) return;
    const weight = priorityWeight(row.priority);
    const part = COVERAGE_PARTS[level.status];
    assessed += 1;
    counts[level.fit] += 1;
    partRows[part] += 1;
    partWeights[part] += weight;
    met += weight * level.value;
    total += weight;
    if (level.fit === 'Not supported' && weight === 3) mustGaps.push(row.id);
    if (!Array.isArray(row.evidenceRefs) || !row.evidenceRefs.length) unsourced += 1;
    if (OFFER_LEVELS.includes(row.offer)) {
      offered += 1;
      offerCounts[row.offer] += 1;
      if (row.offer === 'Add-on') addOns.push(row.id);
    }
  });
  if (!total) return null;
  // The band is chosen from the percentage shown, so the label never contradicts the rating.
  const percent = Math.floor((met / total) * 100 + 1e-9);
  let rating = COVERAGE_BANDS.find(([minimum]) => percent >= minimum)?.[1] || 1;
  if (mustGaps.length && rating > 4) rating = 4;
  const shares = wholeShares(partNames.map((name) => partWeights[name]), total);
  return {
    percent,
    rating,
    counts,
    mustGaps,
    unsourced,
    rows: assessed,
    parts: Object.fromEntries(partNames.map((name, index) => [
      name, { rows: partRows[name], percent: shares[index] },
    ])),
    ...(offered ? { offers: { counts: offerCounts, addOns } } : {}),
  };
}

/** Rated dimensions with no customer-specific evidence: their rating is the rubric default of 3. */
export function ratingsWithoutEvidence(view) {
  const confidence = Array.isArray(view?.confidence) ? view.confidence : [];
  const computed = Boolean(view?.scoring?.functionalCoverage);
  return RUBRIC.filter((rule) => !(computed && rule.dimension === 'Functional Coverage')
    && confidence.some((item) => item?.dimension === rule.dimension && item.basis === 'default'))
    .map((rule) => ({ dimension: rule.dimension, weight: rule.weight }));
}

function coverageBand(rating) {
  const index = COVERAGE_BANDS.findIndex(([, value]) => value === rating);
  if (index < 0) return `below ${COVERAGE_BANDS.at(-1)[0]}%`;
  const [minimum] = COVERAGE_BANDS[index];
  return index ? `${minimum}–${COVERAGE_BANDS[index - 1][0] - 1}%` : `${minimum}% or more`;
}

/** Nash's own explanation of the computed rating, so the text always matches the matrix. */
const SHARE_PHRASES = {
  standard: 'is met as standard or by configuration',
  custom: 'needs custom work or a partner',
  open: 'is still open',
  unsupported: 'is not supported',
};

/** The non-zero coverage parts by weight, e.g. "90% is met as standard … and 10% is still open". */
export function coverageShares(parts) {
  const items = Object.entries(SHARE_PHRASES).filter(([name]) => parts?.[name]?.percent)
    .map(([name, phrase]) => `${parts[name].percent}% ${phrase}`);
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] || '';
}

export function coverageRationale(coverage) {
  const {
    counts, percent, rating, rows, mustGaps, parts, offers,
  } = coverage;
  const valued = (value) => FIT_LEVELS
    .filter((level) => level.value === value && counts[level.fit]);
  const total = (value) => valued(value).reduce((sum, level) => sum + counts[level.fit], 0);
  const halves = valued(0.5).map((level) => `${counts[level.fit]} ${level.fit.toLowerCase()}`);
  const uncapped = COVERAGE_BANDS.find(([minimum]) => percent >= minimum)?.[1] || 1;
  const one = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;
  const gaps = mustGaps.length === 1
    ? `an unsupported Must requirement (${mustGaps[0]}) caps`
    : `unsupported Must requirements (${mustGaps.join(', ')}) cap`;
  return [
    `Nash computed ${percent}% priority-weighted coverage across ${rows} requirements, counting each Must three times and each Should twice.`,
    `${one(total(1), 'is', 'are')} met out of the box or by configuration${halves.length ? `; ${one(total(0.5), 'counts', 'count')} half (${halves.join(', ')})` : ''}${total(0) ? `; ${one(total(0), 'is', 'are')} not supported, counting zero` : ''}.`,
    rating < uncapped
      ? `That would rate ${uncapped}, but ${gaps} it at ${rating} of 5.`
      : `That is in the ${coverageBand(rating)} band, so the rating is ${rating} of 5.`,
    ...(parts ? [`By priority weight, ${coverageShares(parts)}.`] : []),
    ...(offers?.addOns.length ? [`${one(offers.addOns.length, 'requirement relies', 'requirements rely')} on an add-on that the proposal must include.`] : []),
  ].join(' ');
}

/** Recomputes ratings, points, total and verdict. Never trusts model-supplied arithmetic. */
export function applyAssessmentRubric(view) {
  if (!view || typeof view !== 'object' || !Array.isArray(view.dimensions)) return view;
  const coverage = Array.isArray(view.requirements) && view.requirements.length
    ? functionalCoverage(view.requirements) : null;
  const dimensions = view.dimensions.map((dimension) => {
    const rule = RUBRIC.find((item) => item.dimension === dimension?.dimension);
    if (!rule) return dimension;
    const computed = rule.dimension === 'Functional Coverage' && coverage;
    const rating = computed ? coverage.rating : ratingValue(dimension.rating);
    return {
      ...dimension,
      rating,
      weight: rule.weight,
      max: rule.weight || null,
      scored: rule.weight && rating !== null ? (rule.weight * rating) / 5 : null,
    };
  });
  const weighted = dimensions.filter((dimension) => (
    RUBRIC.find((rule) => rule.dimension === dimension?.dimension)?.weight
  ));
  const complete = weighted.length === RUBRIC.filter((rule) => rule.weight).length
    && weighted.every((dimension) => dimension.scored !== null);
  const score = complete ? weighted.reduce((sum, dimension) => sum + dimension.scored, 0) : null;
  return {
    ...view,
    meta: {
      ...view.meta,
      score,
      verdict: score === null ? view.meta?.verdict : verdictForScore(score),
    },
    scoring: {
      status: score === null ? 'incomplete' : 'scored',
      method: RUBRIC_METHOD,
      ...(coverage ? { functionalCoverage: coverage } : {}),
    },
    dimensions,
    dimensionDetails: Array.isArray(view.dimensionDetails)
      ? view.dimensionDetails.map((detail) => {
        if (!detail || typeof detail !== 'object') return detail;
        const computed = detail.name === 'Functional Coverage' && coverage;
        return {
          ...detail,
          scoreBasis: computed ? 'computed' : 'rubric',
          ...(computed ? { scoreRationale: coverageRationale(coverage) } : {}),
        };
      }) : view.dimensionDetails,
  };
}

export function rubricPromptText() {
  return `${RUBRIC.map((rule) => `${rule.dimension} (${rule.upside ? 'upside: rated, shown, not counted in the total' : `weight ${rule.weight}`})
${rule.anchors.map((anchor, index) => `  ${index + 1} = ${anchor}`).join('\n')}`).join('\n')}
Functional Coverage is computed by Nash from the requirement matrix when one exists: each row counts by priority (Must x3, Should x2, other x1) and fit (Out of the box or Configuration = 1; Custom build, Partner or third party, or Needs clarification = 0.5; Not supported = 0). Any Must requirement that is Not supported caps the rating at 4. Without a matrix, rate the documented requirements against the same bands.
Ratings are integers 1-5. Missing information is not a weakness: rate 3, set confidence Low with basis "default" and name what would move the rating. Never use 1 or 5 because information is missing.
Nash computes points (weight x rating / 5), the total out of 100 and the verdict (70+ Go, 50-69 Conditional-Go, below 50 No-go). Do not state a total score or verdict yourself.`;
}

const DRAFT_STANCES = [
  ['open', /^(?:open|tbc|tbd|n\/a|na|not applicable|unknown|pending|confirm)\b|^[-?]+$/],
  ['yes', /^(?:yes|y|comply|compliant|full(?:y)?|supported|true)\b/],
  ['no', /^(?:no|n|non[- ]?compliant|not|false|does not)\b/],
  ['partial', /partial|custom|roadmap|planned|workaround|limited/],
];

export function draftStance(answer) {
  const value = String(answer || '').trim().toLowerCase();
  if (!value) return 'open';
  return DRAFT_STANCES.find(([, pattern]) => pattern.test(value))?.[0] || 'open';
}

/** How the reviewed fit relates to the answer already present in the source document. */
export function draftAgreement(row) {
  if (!row?.draft?.answer) return null;
  const stance = draftStance(row.draft.answer);
  const covered = ['Out of the box', 'Configuration'].includes(row.fit);
  const partial = ['Custom build', 'Partner or third party'].includes(row.fit);
  if (stance === 'open') return row.fit === 'Needs clarification' ? 'open' : 'answered';
  if (stance === 'yes') return covered ? 'agrees' : 'downgraded';
  if (stance === 'no') {
    if (row.fit === 'Not supported') return 'agrees';
    return row.fit === 'Needs clarification' ? 'open' : 'upgraded';
  }
  if (partial) return 'agrees';
  return covered ? 'upgraded' : 'downgraded';
}
