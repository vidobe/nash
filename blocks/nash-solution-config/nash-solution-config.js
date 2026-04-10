/**
 * loads and decorates the nash-solution-config block
 * Reads solution configuration from the authored document rows.
 * Row structure:
 *   Row 1: Section name (e.g. "Scoring Dimensions")
 *   Rows 2+: key | value pairs within that section
 * @param {Element} block The block element
 */

const SECTION_ICONS = {
  'Scoring Dimensions': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  'Key Signals': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  'Red Flags': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  'Competitive Alternatives': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
  'Products Covered': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
};

function buildSection(title, rows) {
  const icon = SECTION_ICONS[title] || '';
  const items = rows.map(([key, val]) => `
    <div class="nash-config-row">
      <span class="nash-config-key">${key}</span>
      <span class="nash-config-val">${val}</span>
    </div>
  `).join('');

  return `
    <div class="nash-config-section">
      <h3 class="nash-config-section-title">
        ${icon}
        ${title}
      </h3>
      <div class="nash-config-rows">${items}</div>
    </div>
  `;
}

export default async function decorate(block) {
  const meta = (name) => document.head.querySelector(`meta[name="${name}"]`)?.content || '';
  const ogTitle = document.head.querySelector('meta[property="og:title"]')?.content || document.title || '';
  const solutionName = ogTitle.replace(/\s*\|.*$/, '').trim() || 'Solution';
  const description = meta('description') || '';
  const status = meta('status') || 'active';
  const version = meta('version') || '1.0';

  // Parse authored rows: first cell = section header (single col), or key|value pair
  const allRows = [...block.querySelectorAll(':scope > div')];
  const sections = [];
  let currentSection = null;

  allRows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length === 1) {
      // Section header
      currentSection = { title: cells[0].textContent.trim(), rows: [] };
      sections.push(currentSection);
    } else if (cells.length >= 2 && currentSection) {
      currentSection.rows.push([cells[0].textContent.trim(), cells[1].innerHTML.trim()]);
    }
  });

  const statusClass = status.toLowerCase() === 'active' ? 'active' : 'beta';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  block.innerHTML = `
    <div class="nash-config-header">
      <a class="nash-config-back" href="/solutions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Solutions Files
      </a>
      <div class="nash-config-title-row">
        <div class="nash-config-logo" aria-hidden="true">${solutionName.charAt(0)}</div>
        <div>
          <h1 class="nash-config-name">${solutionName}</h1>
          <p class="nash-config-desc">${description}</p>
        </div>
        <span class="nash-config-badge ${statusClass}">${statusLabel}</span>
        <span class="nash-config-version">v${version}</span>
      </div>
    </div>
    <div class="nash-config-body">
      ${sections.map((s) => buildSection(s.title, s.rows)).join('')}
    </div>
  `;

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: solutionName }, bubbles: true }));
}
