/**
 * nash-qualification block
 *
 * Renders a published qualification report page with the same clean look as the
 * in-app assessment view: a simple score + verdict header, then the report body
 * flowing vertically (headings, paragraphs, tables) — no side-nav, no scorecard
 * cards, no score ring.
 *
 * Content model (DA block table):
 *   Row 1 (7 cells): accountName | solution | score | verdict | date
 *                    | engagementType | proposedSolution
 *   (Any further rows — legacy scorecard dimensions — are ignored.)
 *
 * Body content (real <h2>/<h3> headings, paragraphs, tables) is authored in
 * sections BELOW this block and styled via the .nash-qual-page class on <main>.
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

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // ── Row 1: metadata ───────────────────────────────────────────────────────
  const metaCells = [...rows[0].querySelectorAll(':scope > div')];
  const accountName = metaCells[0]?.textContent.trim() || '';
  const solution = metaCells[1]?.textContent.trim() || '';
  const score = parseInt(metaCells[2]?.textContent.trim() || '0', 10);
  const verdict = metaCells[3]?.textContent.trim() || '';
  const cms = metaCells[6]?.textContent.trim() || '';

  // ── Score / verdict colours ───────────────────────────────────────────────
  let scoreColour = 'var(--red, #eb1000)';
  if (score >= 70) scoreColour = 'var(--green, #0d7a45)';
  else if (score >= 50) scoreColour = 'var(--amber, #b45309)';

  const vLower = verdict.toLowerCase();
  let verdictColour = 'nogo';
  if (vLower === 'go') verdictColour = 'go';
  else if (vLower.includes('conditional')) verdictColour = 'conditional';

  const scoreTop = Number.isFinite(score) && score > 0 ? `
    <div class="nash-qual-top">
      <div class="nash-qual-score" style="color:${scoreColour}">${score}<span>/ 100</span></div>
      <span class="nash-qual-verdict ${verdictColour}">${verdict}</span>
      ${cms && cms.toLowerCase() !== 'n/a' ? `<span class="nash-qual-cms">${cms}</span>` : ''}
    </div>` : '';

  // ── Render the header; the report body stays in the sections below ─────────
  block.innerHTML = `
    <a class="nash-qual-back" href="/">← All Qualifications</a>
    <h1 class="nash-qual-title">${accountName}</h1>
    ${solution ? `<p class="nash-qual-sub">${solution}</p>` : ''}
    ${scoreTop}
  `;

  const main = block.closest('main');
  if (main) main.classList.add('nash-qual-page');

  requestAnimationFrame(() => {
    enhanceBodyContent(main);
  });
}
