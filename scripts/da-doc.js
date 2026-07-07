/*
 * Builds a DA source document from a Nash (Fluffy) assessment.
 *
 * Output matches how /qualifications pages are authored so it renders in the
 * existing nash-qualification block and is indexed by helix-query.yaml:
 *
 *   <main>
 *     <div>                         ← section 1
 *       <div class="nash-qualification">
 *         <div>account|solution|score|verdict|date|engagementType|proposedSolution</div>
 *         <div>dimension|weight|scored|max|notes</div>   ← optional, repeated
 *       </div>
 *     </div>
 *     <div>                         ← section 2
 *       …report body (headings, paragraphs, tables)…
 *       <div class="metadata"> Title|status|score|cms|verdict|user|description </div>
 *     </div>
 *   </main>
 *
 * This module only builds the document string — writing it to DA + publishing is
 * handled by the publish Worker (scripts/da-publish.js / tools/da-publish).
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** kebab-case slug from a company name, safe for a DA path. */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'assessment';
}

function today() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const cell = (v) => `<div><div>${esc(v)}</div></div>`;
const kv = (k, v) => `<div><div>${esc(k)}</div><div>${esc(v)}</div></div>`;

/* The nash-qualification block: metadata row + optional scorecard rows. */
function qualificationBlock(a) {
  const solution = (a.solutions || []).map((s) => s.name).join(', ') || a.solutionNames || '';
  const row1 = `<div>${[
    a.company, solution, a.score ?? '', a.verdict || '', today(),
    a.opp?.salesStage || '', a.proposedSolution || '',
  ].map((v) => `<div>${esc(v)}</div>`).join('')}</div>`;

  const dims = Array.isArray(a.dimensions) ? a.dimensions : [];
  const dimRows = dims.map((d) => `<div>${[
    d.dimension || d.name, d.weight, d.scored, d.max, d.notes,
  ].map((v) => `<div>${esc(v)}</div>`).join('')}</div>`).join('');

  return `<div class="nash-qualification">${row1}${dimRows}</div>`;
}

/* Base64 (Unicode-safe) payload so a published page can reconstruct the full
   assessment — report markdown + opp + meta — and render the interactive view. */
function encodePayload(a) {
  const data = {
    v: 1,
    company: a.company,
    dr: a.dr || '',
    fileName: a.fileName || '',
    solutions: a.solutions || [],
    solutionNames: a.solutionNames || '',
    proposedSolution: a.proposedSolution || '',
    score: a.score ?? null,
    verdict: a.verdict || '',
    cms: a.cms || '',
    dimensions: Array.isArray(a.dimensions) ? a.dimensions : [],
    reportMarkdown: a.reportMarkdown || '',
    opp: a.opp || {},
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch {
    return '';
  }
}

function metadataBlock(a, user) {
  return `<div class="metadata">${
    kv('Title', a.company)
    + kv('status', 'done')
    + kv('score', a.score ?? '')
    + kv('cms', a.cms || 'n/a')
    + kv('verdict', a.verdict || '')
    + kv('user', user || '')
    + kv('description', a.dr || a.company)
    + kv('nash-payload', encodePayload(a))
  }</div>`;
}

/**
 * Builds the full DA document HTML for an assessment.
 * @param {object} a assessment ({ company, dr, score, verdict, cms, solutions, ... })
 * @param {string} bodyHtml the rendered report body (headings/paragraphs/tables)
 * @param {string} [user] the author email, for the `user` metadata
 * @returns {string} DA source HTML
 */
export function buildDaDocument(a, bodyHtml = '', user = '') {
  return `<body>
  <header></header>
  <main>
    <div>${qualificationBlock(a)}</div>
    <div>
${bodyHtml || `<p>${esc(a.company)}</p>`}
      ${metadataBlock(a, user)}
    </div>
  </main>
  <footer></footer>
</body>`;
}

// Cell helpers kept exported in case the Worker wants to reuse them.
export { cell };
