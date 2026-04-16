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
    ${scorecardHTML}
  `;

  const main = block.closest('main');
  if (main) main.classList.add('nash-qual-page');

  requestAnimationFrame(() => {
    enhanceBodyContent(main);
  });
}
