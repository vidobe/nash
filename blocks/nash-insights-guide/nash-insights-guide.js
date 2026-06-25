/**
 * nash-insights-guide block
 *
 * Renders the "Understanding Your Digital Opportunity Report" guide.
 * Content model — single table, parsed like nash-solution-config:
 *   [lead]            | intro paragraph   → hero lead text
 *   [Section Name]    | (empty)           → section heading
 *   [Title] | [Body]                      → card inside the current section
 *
 * @param {Element} block
 */

function buildSection(title, rows) {
  return `
    <section class="nash-guide-section">
      <h2 class="nash-guide-section-title">${title}</h2>
      <dl class="nash-guide-list">
        ${rows.map(([key, val]) => `
          <div class="nash-guide-item">
            <dt class="nash-guide-term">${key}</dt>
            <dd class="nash-guide-def">${val}</dd>
          </div>
        `).join('')}
      </dl>
    </section>
  `;
}

export default async function decorate(block) {
  let lead = '';
  const sections = [];
  let current = null;

  [...block.querySelectorAll(':scope > div')].forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const key = cells[0]?.textContent.trim() || '';
    const val = cells[1]?.innerHTML.trim() || '';
    if (key.toLowerCase() === 'lead') {
      lead = val;
    } else if (!val) {
      current = { title: key, rows: [] };
      sections.push(current);
    } else if (current) {
      current.rows.push([key, val]);
    }
  });

  // No authored content (e.g. embedded empty on another page) — render nothing.
  if (!lead && sections.length === 0) {
    block.innerHTML = '';
    return;
  }

  block.innerHTML = `
    <div class="nash-guide">
      <header class="nash-guide-hero">
        <span class="nash-guide-eyebrow">Digital Insights by Adobe</span>
        <h1 class="nash-guide-headline">Understanding Your Digital Opportunity Report</h1>
        <p class="nash-guide-subhead">A guide to reading and interpreting your results.</p>
        ${lead ? `<p class="nash-guide-lead">${lead}</p>` : ''}
      </header>
      ${sections.map((s) => buildSection(s.title, s.rows)).join('')}
    </div>
  `;

  if (window.location.pathname.startsWith('/insights-guide')) {
    document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'Insights Guide' }, bubbles: true }));
  }
}
