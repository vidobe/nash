/**
 * aibootcamp-companies block
 * Lists all company reports as cards. Reads company rows from the block's
 * own authored content: name | domain | slug | country
 * "Open Analysis" navigates to /aibootcamp/brand-visibility-report?company={slug}
 */

const RESULTS_PAGE = '/aibootcamp/brand-visibility-report';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderCard(name, domain, slug, country, date) {
  return `
    <div class="ab-company-card">
      <div class="ab-company-card-head">
        <div class="ab-company-card-title-row">
          <span class="ab-company-card-name">${name}</span>
          <span class="ab-company-ready-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Ready
          </span>
        </div>
        <span class="ab-company-card-time">${timeAgo(date)}</span>
      </div>
      <div class="ab-company-card-domain">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <a href="https://${domain}" target="_blank" rel="noopener">${domain}</a>
      </div>
      <p class="ab-company-card-desc">Report is ready to view and download.</p>
      <div class="ab-company-card-meta">
        <span class="ab-company-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Adobe AI Bootcamp
        </span>
        <span class="ab-company-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          ${country || 'Netherlands'}
        </span>
      </div>
      <div class="ab-company-card-actions">
        <a class="ab-company-open-btn" href="${RESULTS_PAGE}?company=${slug}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          Open Analysis
        </a>
        <a class="ab-company-icon-btn" href="/aibootcamp/reports/${slug}.plain.html" download title="Download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      </div>
    </div>`;
}

export default function decorate(block) {
  // Parse rows: name | domain | slug | country | date
  const rows = [...block.querySelectorAll(':scope > div')].map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.map((c) => c.textContent.trim());
  }).filter(([name]) => name);

  // Break out of EDS section width
  const section = block.closest('.section');
  const main = block.closest('main');
  [section, main].forEach((el) => {
    if (!el) return;
    el.style.maxWidth = 'none';
    el.style.padding = '0';
    el.style.margin = '0';
  });

  block.innerHTML = `
    <div class="ab-companies-page">
      <header class="ab-topbar">
        <div class="ab-topbar-inner">
          <div class="ab-topbar-left">
            <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="ab-topbar-logo" width="80" height="20"/>
            <span class="ab-topbar-divider"></span>
            <span class="ab-topbar-title">AI Bootcamp NL 2026 — Reports</span>
          </div>
        </div>
      </header>
      <div class="ab-companies-body">
        <div class="ab-companies-grid">
          ${rows.map(([name, domain, slug, country, date]) => renderCard(name, domain, slug, country, date)).join('')}
        </div>
      </div>
    </div>`;
}
