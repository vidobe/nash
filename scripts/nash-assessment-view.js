import { isCustomerShareableUrl } from './nash-assessment-contract.js';

function text(value) {
  return String(value ?? '')
    .replace(/\[\[[a-z0-9_-]+\]\]/gi, '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function heading(line) {
  const markdown = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (markdown) return { level: markdown[1].length, title: text(markdown[2]) };
  const bold = line.match(/^\s*\*\*([^*]+)\*\*\s*:?\s*$/);
  return bold ? { level: 2, title: text(bold[1]) } : null;
}

export function reportSubsection(markdown, titlePattern) {
  const lines = String(markdown || '').split('\n');
  const start = lines.findIndex((line) => {
    const current = heading(line);
    return current && titlePattern.test(current.title);
  });
  if (start < 0) return '';
  const { level } = heading(lines[start]);
  const end = lines.slice(start + 1).findIndex((line) => {
    const current = heading(line);
    return current && current.level <= level;
  });
  return lines.slice(start, end < 0 ? undefined : start + 1 + end).join('\n').trim();
}

function paragraphs(markdown) {
  return String(markdown || '').split(/\n\s*\n/)
    .filter((part) => !heading(part.trim()) && !/^\s*(?:\||[-*]\s|\d+\.\s)/.test(part))
    .map(text)
    .filter(Boolean);
}

function points(markdown) {
  return String(markdown || '').split('\n').map((line) => {
    const match = line.match(/^\s*(?:[-*]\s+|\d+[.)]\s+)?\*\*([^*]+)\*\*\s*(.*)$/);
    if (!match) return null;
    return {
      label: text(match[1]).replace(/[:.]\s*$/, ''),
      text: text(match[2]).replace(/^[:\u2013\u2014-]\s*/, ''),
    };
  })
    .filter((item) => item?.text);
}

function point(markdown, pattern) {
  return points(markdown).find((item) => pattern.test(item.label))?.text || '';
}

function firstSentence(value) {
  const cleaned = text(value);
  return cleaned.match(/^.*?[.!?](?=\s|$)/)?.[0] || cleaned;
}

function list(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(';');
  return [...new Set(items.map(text).filter(
    (item) => item && !/^(?:none|n\/a|not applicable)\.?$/i.test(item),
  ))];
}

function tableCells(line) {
  const cells = line.trim().split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function tables(markdown) {
  const lines = String(markdown || '').split('\n');
  const result = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const separators = lines[i].includes('|') ? tableCells(lines[i + 1]) : [];
    if (separators.length && separators.every((cell) => /^:?-+:?$/.test(cell))) {
      const headers = tableCells(lines[i]).map(text);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(tableCells(lines[i]).map(text));
        i += 1;
      }
      result.push({ headers, rows });
    }
  }
  return result;
}

function tableRecords(markdown, columns, required) {
  return tables(markdown).flatMap(({ headers, rows }) => {
    const indexes = Object.fromEntries(Object.entries(columns).map(
      ([key, pattern]) => [key, headers.findIndex((header) => pattern.test(header))],
    ));
    if (!required.every((key) => indexes[key] >= 0)) return [];
    return rows.map((row) => Object.fromEntries(
      Object.entries(indexes).map(([key, index]) => [key, row[index] || '']),
    )).filter((row) => row[required[0]]);
  });
}

function legacySolutions(markdown) {
  return tableRecords(markdown, {
    product: /^(?:adobe\s+)?product\b|^solution(?:\s*\/|\s*$)/i,
    deployment: /deployment|delivery model/i,
    role: /^role\b/i,
    rationale: /why.*propos|rationale/i,
    requirements: /requirement/i,
    dependencies: /dependenc|unresolved/i,
  }, ['product', 'deployment', 'rationale']).map((item) => ({
    ...item,
    requirements: list(item.requirements),
    dependencies: list(item.dependencies),
  }));
}

export function solutionSelection(solution) {
  const selections = ['recommended', 'conditional', 'alternative', 'excluded', 'external'];
  if (solution.selection !== undefined) {
    return selections.includes(solution.selection) ? solution.selection : 'unclassified';
  }
  const deployment = text(solution.deployment);
  const scope = [deployment, solution.role, solution.rationale].map(text).join(' ');
  if (/\bexternal\b|customer[- ]owned|customer[- ]managed|existing customer systems/i.test(deployment)
    || /^external customer systems?\b/i.test(text(solution.product))) {
    return 'external';
  }
  if (/\bnot (?:selected|proposed|recommended|required|(?:(?:in|part of) (?:the )?)?baseline)|\bout of scope\b|\bexcluded\b/i.test(scope)) {
    return 'excluded';
  }
  if (/\balternative\b|\bfuture (?:option|phase|scope)\b/i.test(scope)) return 'alternative';
  if (/\bconditional option\b|\boptional\b|\bonly (?:if|for|where|when)\b/i.test(scope)
    || /\bpreferred scenario pending\b/i.test(list(solution.dependencies).join(' '))) {
    return 'conditional';
  }
  return 'recommended';
}

export function referenceKind(reference) {
  const kinds = ['customer-story', 'product-documentation', 'trust-compliance', 'other'];
  if (reference.kind !== undefined) {
    return kinds.includes(reference.kind) ? reference.kind : 'other';
  }
  const url = String(reference.url || '');
  if (/^https?:\/\/(?:business|www)\.adobe\.com\/(?:[a-z]{2}\/)?(?:customer-success-stories|customers)\//i.test(url)) {
    return 'customer-story';
  }
  if (/^https?:\/\/(?:www\.)?adobe\.com\/(?:trust|privacy|legal)(?:\/|\.html(?:[?#]|$)|[?#]|$)/i.test(url)) {
    return 'trust-compliance';
  }
  if (/^https?:\/\/(?:www\.)?aem\.live\/(?:docs|developer)\//i.test(url)
    || /^https?:\/\/experienceleague\.adobe\.com\/(?:[a-z-]+\/)?docs\//i.test(url)
    || /^https?:\/\/developer\.adobe\.com\//i.test(url)
    || /^https?:\/\/business\.adobe\.com\/(?:[a-z]{2}\/)?products\//i.test(url)) {
    return 'product-documentation';
  }
  if (/\bcustomer (?:success )?story\b|\bcase study\b/i.test(reference.relevance || '')
    && !/\bnot (?:a )?(?:customer story|case study)\b/i.test(reference.relevance || '')) {
    return 'customer-story';
  }
  return 'other';
}

export function scoreBreakdownFor(dimension, detail = {}) {
  const { criteria } = detail;
  if (criteria === undefined || (Array.isArray(criteria) && !criteria.length)) {
    return { status: 'missing', criteria: [] };
  }
  if (!Array.isArray(criteria)) return { status: 'invalid', criteria: [] };
  const qualitative = (item) => item && typeof item.criterion === 'string'
    && item.criterion.trim() && typeof item.rationale === 'string' && item.rationale.trim()
    && ['supported', 'conditional', 'unknown', 'gap'].includes(item.status);
  if (detail.scoreBasis === 'unscored' && dimension.scored === null && dimension.max === null) {
    const valid = criteria.every((item) => qualitative(item)
      && item.scored === null && item.max === null);
    return { status: valid ? 'unscored' : 'invalid', criteria: valid ? criteria : [] };
  }
  if (['rubric', 'computed'].includes(detail.scoreBasis)) {
    // Rubric ratings are explained by criteria; points belong to the dimension, not each criterion.
    const valid = criteria.every(qualitative);
    return {
      status: valid ? 'rubric' : 'invalid',
      criteria: valid ? criteria : [],
      rating: Number.isInteger(dimension.rating) ? dimension.rating : null,
      scored: Number.isFinite(dimension.scored) ? dimension.scored : null,
      max: Number.isFinite(dimension.max) ? dimension.max : null,
    };
  }
  const valid = criteria.every((item) => item && typeof item.criterion === 'string'
    && item.criterion.trim() && typeof item.rationale === 'string' && item.rationale.trim()
    && Number.isFinite(item.scored) && Number.isFinite(item.max)
    && item.max > 0 && item.scored >= 0 && item.scored <= item.max);
  if (!valid || !Number.isFinite(dimension.scored) || !Number.isFinite(dimension.max)) {
    return { status: 'invalid', criteria: [] };
  }
  const scored = criteria.reduce((sum, item) => sum + item.scored, 0);
  const max = criteria.reduce((sum, item) => sum + item.max, 0);
  if (Math.abs(scored - dimension.scored) > 0.000001
    || Math.abs(max - dimension.max) > 0.000001) {
    return { status: 'mismatch', criteria: [] };
  }
  return {
    status: 'valid', criteria, scored, max,
  };
}

function legacyReferences(assessment) {
  return (assessment.evidence || []).filter(
    (item) => item.type === 'public-source' && isCustomerShareableUrl(item.locator),
  ).map((item) => ({
    title: text(item.source),
    url: item.locator,
    relevance: text(item.claim),
  }));
}

function legacyUseCases(markdown) {
  return tableRecords(markdown, {
    name: /^use case\b/i,
    priority: /^priority$/i,
    persona: /persona|^users?$/i,
    trigger: /^trigger$/i,
    journey: /journey/i,
    products: /adobe.*product|product.*deployment|^products?$/i,
    requirements: /requirement/i,
    outcome: /outcome|business value/i,
    proof: /proof|validation/i,
    prerequisites: /prerequisit|dependenc/i,
  }, ['name', 'journey']).map((item) => ({
    ...item,
    products: list(item.products),
    requirements: list(item.requirements),
    prerequisites: list(item.prerequisites),
  }));
}

function legacyRequirements(markdown) {
  return tableRecords(markdown, {
    id: /^requirement id$|^id$/i,
    requirement: /^short requirement$|^requirement$|customer requirement/i,
    status: /^status$|covered.*partial|coverage status/i,
    response: /adobe response/i,
    solution: /product.*deployment|solution/i,
    caveat: /caveat|dependenc/i,
    source: /^source/i,
    owner: /owner/i,
    validation: /validation|verification/i,
  }, ['id', 'requirement', 'status', 'response']);
}

function legacyCompetitors(markdown) {
  return tableRecords(markdown, {
    name: /^(?:named\s+)?competitor\b/i,
    status: /^status$/i,
    win: /adobe.*win/i,
    lose: /adobe.*lose/i,
    proof: /proof/i,
  }, ['name', 'win', 'lose', 'proof']).filter(
    (item) => !/not confirmed|reference alternatives?|not.*shortlist|not.*participants/i.test(`${item.name} ${item.status}`),
  );
}

function legacyDelivery(markdown) {
  return tableRecords(markdown, {
    phase: /^phase$/i,
    objective: /objective/i,
    entryGate: /entry gate/i,
    exitGate: /exit gate/i,
    work: /^work\b|workstream|^scope$/i,
    agent: /agent|ema/i,
  }, ['phase', 'work', 'entryGate', 'exitGate']).map((item) => ({
    ...item,
    work: list(item.work),
  }));
}

function legacyArchitecture(assessment, sections) {
  const rationale = sections.Rationale || '';
  const technical = sections.Architecture || sections['Tech Fit'] || '';
  const context = paragraphs(reportSubsection(rationale, /customer context/i));
  const recommendation = reportSubsection(rationale, /recommendation summary/i);
  const preferred = point(recommendation, /^preferred/i) || paragraphs(recommendation)[0] || '';
  const pattern = point(technical, /recommended pattern|recommended approach|preferred architecture/i);
  const deployment = point(technical, /^deployment$/i);
  const boundaries = point(technical, /delivery.model boundar/i);
  const detail = [deployment, boundaries].filter(Boolean).join(' ') || preferred;
  return {
    headline: firstSentence(pattern || preferred),
    summary: context[0] || '',
    recommendation: detail,
    status: /conditional|subject to|pending|provisional/i.test(`${assessment.verdict || ''} ${detail}`)
      ? 'Provisional architecture' : 'Recommended architecture',
    boundary: context.slice(1).join(' '),
  };
}

function legacyExecutive(assessment, sections) {
  const overview = sections.Overview || '';
  const recommendation = sections.Recommendation || '';
  const fit = points(overview).filter((item) => /fit\b|why adobe/i.test(item.label))
    .map((item) => item.text);
  return {
    headline: firstSentence(fit[0]) || firstSentence(paragraphs(overview)[0]),
    summary: fit.slice(0, 2).join(' ') || paragraphs(overview)[0]
      || text(assessment.context?.success),
    conditions: list((assessment.confidence || []).map((item) => item.unknowns)).slice(0, 3),
    nextAction: point(recommendation, /next step|next action/i)
      || point(overview, /next step|next action/i)
      || text(assessment.confidence?.find((item) => item.scoreChanger)?.scoreChanger),
  };
}

function legacyDimension(dimension, assessment) {
  const confidence = (assessment.confidence || []).find(
    (item) => item.dimension.toLowerCase() === dimension.dimension.toLowerCase(),
  );
  const evidenceRefs = list(confidence?.factRefs?.length
    ? confidence.factRefs : dimension.evidenceRefs);
  const evidence = (assessment.evidence || []).filter(
    (item) => evidenceRefs.some((id) => id.toLowerCase() === item.id.toLowerCase()),
  );
  const verification = list([
    confidence?.scoreChanger,
    ...list(confidence?.unknowns),
    ...list(confidence?.assumptions),
  ]);
  return {
    name: dimension.dimension,
    takeaway: text(dimension.notes),
    matters: evidence.filter((item) => /customer-document|analyst-context/.test(item.type))
      .slice(0, 4).map((item) => ({ label: text(item.source), text: text(item.claim) })),
    unknowns: list(confidence?.unknowns),
    assumptions: list(confidence?.assumptions),
    verification,
    nextActions: verification.slice(0, 3),
    evidenceRefs,
  };
}

// Older published assessments contain these tables but predate the V2 payload.
// Derive display data only; never rewrite their report, score, or stored payload.
export function assessmentViewFor(assessment, sections = {}) {
  const rationale = sections.Rationale || '';
  const solutions = legacySolutions(rationale);
  const architecture = legacyArchitecture(assessment, sections);
  const view = assessment.assessmentView || {};
  const useCases = legacyUseCases(rationale);
  const legacy = {
    executive: legacyExecutive(assessment, sections),
    architecture,
    architectureBoundary: architecture.boundary,
    solutions,
    useCases: useCases.length ? useCases
      : list(assessment.context?.use_cases).map((name) => ({ name })),
    requirements: legacyRequirements(sections.Business),
    competitors: legacyCompetitors(sections.Competition),
    deliveryPath: legacyDelivery(sections.Recommendation),
    publicReferences: legacyReferences(assessment),
  };
  const dimensionDetails = (assessment.dimensions || []).map((dimension) => ({
    ...legacyDimension(dimension, assessment),
    ...(view.dimensionDetails || []).find(
      (item) => item.name?.toLowerCase() === dimension.dimension.toLowerCase(),
    ),
  }));
  return {
    ...legacy,
    ...view,
    executive: { ...legacy.executive, ...view.executive },
    architecture: { ...legacy.architecture, ...view.architecture },
    dimensionDetails: dimensionDetails.length ? dimensionDetails : view.dimensionDetails || [],
  };
}
