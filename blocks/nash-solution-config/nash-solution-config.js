/**
 * nash-solution-config block
 *
 * Single-table content model — one Nash Solution Config block per page.
 * Row formats:
 *   [Section Name]           → section heading (first cell only, second empty)
 *   [Key] | [Value]          → key/value row inside current section
 *
 * Page metadata: title, description, status, version
 *
 * @param {Element} block
 */

const SVG = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"';
const SECTION_ICONS = {
  'Scoring Dimensions': `<svg ${SVG}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  'Products Covered': `<svg ${SVG}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  'Key Signals': `<svg ${SVG}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  'Red Flags': `<svg ${SVG}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  'Competitive Alternatives': `<svg ${SVG}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
};

const DEFAULT_ICON = `<svg ${SVG}><circle cx="12" cy="12" r="10"/></svg>`;

function buildSection(title, rows) {
  const icon = SECTION_ICONS[title] || DEFAULT_ICON;
  return `
    <div class="nash-config-section">
      <h2 class="nash-config-section-title">${icon}${title}</h2>
      <div class="nash-config-rows">
        ${rows.map(([key, val]) => `
          <div class="nash-config-row">
            <dt class="nash-config-key">${key}</dt>
            <dd class="nash-config-val">${val}</dd>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export default async function decorate(block) {
  const metaEl = (name) => document.head.querySelector(`meta[name="${name}"]`)?.content || '';
  const rawTitle = (document.head.querySelector('meta[property="og:title"]')?.content || document.title || '')
    .replace(/\s*\|.*$/, '').trim();
  const solutionName = rawTitle || 'Solution';
  const description = metaEl('description') || '';
  const status = metaEl('status') || 'active';
  const version = metaEl('version') || '1';
  const daPath = window.location.pathname;

  // Parse rows: single-cell = section header, two-cell = key/value
  const sections = [];
  let current = null;
  [...block.querySelectorAll(':scope > div')].forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const key = cells[0]?.textContent.trim() || '';
    const val = cells[1]?.innerHTML.trim() || '';
    if (!val) {
      current = { title: key, rows: [] };
      sections.push(current);
    } else if (current) {
      current.rows.push([key, val]);
    }
  });

  const statusClass = status.toLowerCase() === 'active' ? 'active' : 'beta';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  block.innerHTML = `
    <div class="nash-config-header">
      <a class="nash-config-back" href="/solutions/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Solutions Files
      </a>
      <div class="nash-config-hero">
        <div class="nash-config-logo" aria-hidden="true">${solutionName.charAt(0)}</div>
        <div class="nash-config-hero-text">
          <div class="nash-config-hero-top">
            <h1 class="nash-config-name">${solutionName}</h1>
            <span class="nash-config-badge ${statusClass}">${statusLabel}</span>
            <span class="nash-config-version">v${version}</span>
          </div>
          <p class="nash-config-desc">${description}</p>
        </div>
        <a class="nash-config-edit-btn" href="https://da.live/edit#/vidobe/nash${daPath}" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit in DA
        </a>
      </div>
    </div>
    <div class="nash-config-body">
      ${sections.map((s) => buildSection(s.title, s.rows)).join('')}
    </div>
  `;

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: solutionName }, bubbles: true }));
}
