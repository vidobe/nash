import { isCustomerShareableUrl } from './nash-assessment-contract.js';

/**
 * Adobe trust & service baseline: verified public Adobe facts (certifications, privacy terms,
 * availability, recovery, support, exit) authored as a DA sheet per platform. Nash registers
 * each row as citeable evidence (T1, T2, ...) so security, privacy and service questions get
 * sourced answers instead of "needs clarification".
 */
export const TRUST_BASELINE_ORIGIN = 'trust-baseline';

export const TRUST_BASELINES = [{
  path: '/trust/aem-cloud-service.json',
  name: 'AEM as a Cloud Service',
  solutions: ['aem', 'aem-assets'],
}];

const ADOBE_HOST = /(?:^|\.)(?:adobe\.com|aem\.live)$/i;

export const isTrustBaselineEvidence = (item) => item?.origin === TRUST_BASELINE_ORIGIN;

/** Evidence Nash itself owns: workbook citations and the trust baseline. */
export const isNashOwnedEvidence = (item) => item?.type === 'source-citation'
  || isTrustBaselineEvidence(item);

export function trustBaselinesFor(slugs = []) {
  return TRUST_BASELINES
    .filter((baseline) => baseline.solutions.some((slug) => slugs.includes(slug)));
}

function cells(row) {
  return Object.fromEntries(Object.entries(row && typeof row === 'object' ? row : {})
    .map(([name, value]) => [name.trim().toLowerCase(), String(value ?? '').replace(/\s+/g, ' ').trim()]));
}

function adobeUrl(value) {
  if (!isCustomerShareableUrl(value)) return false;
  try {
    return ADOBE_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Turns authored sheet rows (Topic, Statement, Conditions, Source, URL, Verified) into
 * public-source evidence. Rows without a topic, statement or an official Adobe https URL are
 * skipped and reported by sheet row number, so an authoring slip never becomes a citation.
 */
export function trustBaselineEvidence(sheets = []) {
  const evidence = [];
  const sources = sheets.map(({
    path, name, rows = [], error,
  }) => {
    if (error) {
      return {
        path, name, facts: 0, error,
      };
    }
    const skipped = [];
    let facts = 0;
    rows.forEach((raw, index) => {
      const row = cells(raw);
      if (!row.topic || !row.statement || !adobeUrl(row.url)) {
        skipped.push(index + 2);
        return;
      }
      facts += 1;
      evidence.push({
        id: `T${evidence.length + 1}`,
        type: 'public-source',
        origin: TRUST_BASELINE_ORIGIN,
        topic: row.topic,
        source: row.source || new URL(row.url).hostname,
        locator: row.url,
        claim: row.conditions ? `${row.statement} Conditions: ${row.conditions}` : row.statement,
        ...(row.verified ? { verified: row.verified } : {}),
      });
    });
    return {
      path, name, facts, ...(skipped.length ? { skipped } : {}),
    };
  });
  return { evidence, sources };
}

/**
 * Loads the baselines that apply to the selected solutions. Never blocks an assessment: a
 * missing or unreadable sheet is reported in the returned sources and provenance instead.
 */
export async function fetchTrustBaseline(slugs = [], fetchImpl = (url) => fetch(url)) {
  const sheets = await Promise.all(trustBaselinesFor(slugs).map(async ({ path, name }) => {
    try {
      const response = await fetchImpl(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sheet = await response.json();
      if (!Array.isArray(sheet?.data)) throw new Error('not a sheet');
      return { path, name, rows: sheet.data };
    } catch (error) {
      return { path, name, error: error.message || 'request failed' };
    }
  }));
  return trustBaselineEvidence(sheets);
}
