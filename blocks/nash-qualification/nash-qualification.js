/**
 * nash-qualification block
 *
 * Renders a qualification assessment report page.
 *
 * Content model (DA block table):
 *   Row 1 (7 cells): accountName | solution | score | verdict | date
 *                    | engagementType | proposedSolution
 *   Rows 2–N (5 cells each): dimension | weight | scored | max | notes
 *
 * Body content (headings, paragraphs, tables) is authored in sections BELOW
 * this block and styled via CSS using the .nash-qual-page class on <main>.
 *
 * @param {Element} block
 */

function statusClass(text) {
  if (text === 'Does not meet') return 'nash-qual-status-fail';
  if (text === 'Meets') return 'nash-qual-status-pass';
  if (text.startsWith('Meets with')) return 'nash-qual-status-warn';
  if (text === 'High') return 'nash-qual-risk-high';
  if (text === 'Medium-High' || text === 'Medium') return 'nash-qual-risk-medium';
  return '';
}

function enhanceBodyContent(main) {
  if (!main) return;

  // Colour <td> cells in HTML tables
  main.querySelectorAll('td').forEach((td) => {
    const cls = statusClass(td.textContent.trim());
    if (cls) td.classList.add(cls);
  });

  // Colour status cells in div-based requirement/competitor blocks
  // Structure: .block > div(row) > div(cell)[1] contains status text
  main.querySelectorAll('.requirement, .competitor').forEach((blk) => {
    blk.classList.add('nash-qual-data-table');
    [...blk.querySelectorAll(':scope > div')].forEach((row) => {
      const cells = [...row.querySelectorAll(':scope > div')];
      if (cells.length >= 2) {
        const cls = statusClass(cells[1].textContent.trim());
        if (cls) cells[1].classList.add(cls);
      }
    });
  });

  main.querySelectorAll('h3').forEach((h3) => {
    const next = h3.nextElementSibling;
    if (!next || next.tagName !== 'P' || !next.textContent.startsWith('Status:')) return;
    const statusText = next.textContent.replace('Status:', '').trim();
    if (!statusText.includes('Does not meet')) return;

    const section = h3.parentElement;
    const callout = document.createElement('div');
    callout.className = 'nash-qual-gap-callout';
    section.insertBefore(callout, h3);
    let node = h3;
    while (node) {
      const sibling = node.nextElementSibling;
      callout.appendChild(node);
      node = sibling;
      if (node && node.tagName === 'H3') break;
    }
  });
}

function dimCardHTML(d) {
  const pct = d.max ? Math.round((d.scored / d.max) * 100) : 0;
  let colour = 'red';
  if (pct >= 70) colour = 'green';
  else if (pct >= 50) colour = 'amber';
  const notes = d.notes ? `<p class="nash-qual-dim-notes">${d.notes}</p>` : '';
  return `
    <div class="nash-qual-dim-card nash-qual-dim--${colour}">
      <div class="nash-qual-dim-top">
        <span class="nash-qual-dim-name">${d.dimension}</span>
        <span class="nash-qual-dim-weight">${d.weight}</span>
      </div>
      <div class="nash-qual-dim-score">
        <span class="nash-qual-dim-scored">${d.scored}</span>
        <span class="nash-qual-dim-max">/ ${d.max}</span>
      </div>
      <div class="nash-qual-dim-bar-wrap">
        <div class="nash-qual-dim-bar" style="width:${pct}%"></div>
      </div>
      ${notes}
    </div>`;
}

const TAB_ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
};

// One distinct icon per section position (standard 7-section order).
const TAB_ICON_ORDER = ['grid', 'chart', 'briefcase', 'cpu', 'search', 'target', 'flag', 'zap'];

/* Short nav label for a section, matched from its heading text. */
function tabLabel(title) {
  const t = title.toLowerCase();
  if (/executive|overview/.test(t)) return 'Overview';
  if (/market|financial|intelligence/.test(t)) return 'Market';
  if (/business/.test(t)) return 'Business';
  if (/technical|architect|tech/.test(t)) return 'Tech Fit';
  if (/qualification|discovery|question/.test(t)) return 'Discovery';
  if (/accelerat|reference/.test(t)) return 'Accelerators';
  if (/competitive|win|position/.test(t)) return 'Competition';
  if (/recommendation|scope|final|verdict/.test(t)) return 'Recommendation';
  return title.replace(/^\d+[.)]\s*/, '').slice(0, 24);
}

/* True for a numbered top-level section heading (e.g. "2. Market …"). */
function isSectionHeading(node) {
  return /^H[1-3]$/.test(node.tagName) && /^\d+[.)]\s/.test(node.textContent.trim());
}

/* Group the report body into numbered top-level sections (subsections stay in
   the body of their parent section). */
function collectSections(blockSection) {
  const sections = [];
  let current = null;
  let sib = blockSection.nextElementSibling;
  const nodes = [];
  while (sib) {
    const wraps = sib.querySelectorAll(':scope > .default-content-wrapper');
    if (wraps.length) wraps.forEach((w) => nodes.push(...w.children));
    else nodes.push(...sib.children);
    sib = sib.nextElementSibling;
  }
  nodes.forEach((node) => {
    if (isSectionHeading(node)) {
      current = { title: node.textContent.trim(), el: document.createElement('div') };
      current.el.className = 'nash-qual-panel-body';
      sections.push(current);
    } else if (current) {
      current.el.appendChild(node);
    }
  });
  return sections;
}

/* Build the side-nav + panels layout and attach it to the block. */
function buildTabs(block, sections, scorecardHTML) {
  if (!sections.length) return;
  if (scorecardHTML) {
    const sc = document.createElement('div');
    sc.innerHTML = scorecardHTML;
    if (sc.firstElementChild) sections[0].el.prepend(sc.firstElementChild);
  }
  const layout = document.createElement('div');
  layout.className = 'nash-qual-layout';
  const nav = sections.map((s, i) => {
    const icon = TAB_ICONS[TAB_ICON_ORDER[i % TAB_ICON_ORDER.length]];
    return `<button type="button" class="nash-qual-tab${i === 0 ? ' active' : ''}" data-idx="${i}" title="${s.title}">${icon}<span>${tabLabel(s.title)}</span></button>`;
  }).join('');
  layout.innerHTML = `<nav class="nash-qual-nav">${nav}</nav><div class="nash-qual-panels"></div>`;
  const panels = layout.querySelector('.nash-qual-panels');
  sections.forEach((s, i) => {
    const panel = document.createElement('div');
    panel.className = `nash-qual-panel${i === 0 ? ' active' : ''}`;
    panel.dataset.idx = String(i);
    const h = document.createElement('h2');
    h.className = 'nash-qual-panel-title';
    h.textContent = s.title;
    panel.append(h, s.el);
    panels.append(panel);
  });
  block.append(layout);
  layout.querySelectorAll('.nash-qual-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      layout.querySelectorAll('.nash-qual-tab').forEach((b) => b.classList.toggle('active', b === tab));
      panels.querySelectorAll('.nash-qual-panel').forEach((p) => p.classList.toggle('active', p.dataset.idx === tab.dataset.idx));
    });
  });
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // ── Row 1: metadata ───────────────────────────────────────────────────────
  const metaCells = [...rows[0].querySelectorAll(':scope > div')];
  const accountName = metaCells[0]?.textContent.trim() || '';
  const solution = metaCells[1]?.textContent.trim() || '';
  const score = parseInt(metaCells[2]?.textContent.trim() || '0', 10);
  const verdict = metaCells[3]?.textContent.trim() || '';
  const date = metaCells[4]?.textContent.trim() || '';
  const engagementType = metaCells[5]?.textContent.trim() || '';
  const proposedSolution = metaCells[6]?.textContent.trim() || '';

  // ── Rows 2–N: scorecard dimensions ────────────────────────────────────────
  const dimensions = rows.slice(1)
    .filter((r) => r.querySelectorAll(':scope > div').length >= 4)
    .map((r) => {
      const c = [...r.querySelectorAll(':scope > div')];
      return {
        dimension: c[0]?.textContent.trim() || '',
        weight: c[1]?.textContent.trim() || '',
        scored: parseInt(c[2]?.textContent.trim() || '0', 10),
        max: parseInt(c[3]?.textContent.trim() || '0', 10),
        notes: c[4]?.textContent.trim() || '',
      };
    });

  // ── Score colour ──────────────────────────────────────────────────────────
  let scoreColour = 'red';
  if (score >= 70) scoreColour = 'green';
  else if (score >= 50) scoreColour = 'amber';

  // ── Verdict colour ────────────────────────────────────────────────────────
  const vLower = verdict.toLowerCase();
  let verdictColour = 'red';
  if (vLower === 'go') verdictColour = 'green';
  else if (vLower.includes('conditional')) verdictColour = 'amber';

  // ── Scorecard section ─────────────────────────────────────────────────────
  const scorecardHTML = dimensions.length ? `
    <div class="nash-qual-scorecard">
      <p class="nash-qual-section-title">Score Breakdown</p>
      <div class="nash-qual-scorecard-grid">
        ${dimensions.map(dimCardHTML).join('')}
      </div>
    </div>` : '';

  // ── Meta tags ─────────────────────────────────────────────────────────────
  const calendarIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`;

  const codeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>`;

  const dateMeta = date
    ? `<span class="nash-qual-meta-item">${calendarIcon}${date}</span>` : '';
  const typeMeta = engagementType
    ? `<span class="nash-qual-meta-item">${engagementType}</span>` : '';
  const solutionMeta = proposedSolution
    ? `<span class="nash-qual-meta-item">${codeIcon}${proposedSolution}</span>` : '';

  // ── Render ────────────────────────────────────────────────────────────────
  block.innerHTML = `
    <div class="nash-qual-header">
      <div class="nash-qual-header-body">
        <a class="nash-qual-breadcrumb" href="/">← All Qualifications</a>
        <p class="nash-qual-account">${accountName}</p>
        <p class="nash-qual-solution">${solution}</p>
        <div class="nash-qual-meta">
          ${dateMeta}${typeMeta}${solutionMeta}
        </div>
      </div>
      <div class="nash-qual-header-score">
        <div class="nash-qual-score-ring nash-qual-score--${scoreColour}">
          <span class="nash-qual-score-num">${score}</span>
          <span class="nash-qual-score-denom">/ 100</span>
        </div>
        <div class="nash-qual-verdict nash-qual-verdict--${verdictColour}">${verdict}</div>
      </div>
    </div>
  `;

  const main = block.closest('main');
  if (main) main.classList.add('nash-qual-page');

  // Group the report body into H2 sections, then build the side-nav + panels.
  const blockSection = block.closest('.section') || block.parentElement;
  const sections = collectSections(blockSection);
  let sib = blockSection.nextElementSibling;
  while (sib) { const next = sib.nextElementSibling; sib.remove(); sib = next; }
  buildTabs(block, sections, scorecardHTML);

  requestAnimationFrame(() => {
    enhanceBodyContent(main);
  });
}
