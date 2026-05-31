/**
 * aibootcamp-companies block
 * Lists all company reports as cards with search.
 * Reads company rows from authored content: name | domain | slug | country
 */

const RESULTS_PAGE = '/aibootcamp/brand-visibility-report';
const SESSION_KEY = 'aibootcamp-auth';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getSession() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return auth && Date.now() < auth.expires ? auth : null;
  } catch { return null; }
}

function renderCard(name, domain, slug, country, date) {
  const ago = timeAgo(date) || '14h ago';
  const session = getSession();
  const email = session ? session.email : 'vgabriel@adobe.com';

  return `
    <div class="ab-co-card" data-name="${name.toLowerCase()}">
      <div class="ab-co-card-top">
        <div class="ab-co-card-title-row">
          <span class="ab-co-card-name">${name}</span>
          <span class="ab-co-ready-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Ready
          </span>
        </div>
        <span class="ab-co-time">${ago}</span>
      </div>
      <div class="ab-co-domain">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <a href="https://${domain}" target="_blank" rel="noopener">${domain}</a>
      </div>
      <p class="ab-co-desc">Report is ready to view and download.</p>
      <div class="ab-co-meta">
        <span class="ab-co-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          ${email}
        </span>
        <span class="ab-co-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Unknown
        </span>
        <span class="ab-co-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          ${country || 'Netherlands'}
        </span>
      </div>
      <div class="ab-co-actions">
        <a class="ab-co-open-btn" href="${RESULTS_PAGE}?company=${slug}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          Open Analysis
        </a>
        <a class="ab-co-icon-btn" href="/aibootcamp/reports/${slug}.plain.html" download title="Download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
        <button class="ab-co-icon-btn" type="button" title="Refresh" onclick="location.reload()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>
    </div>`;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')].map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.map((c) => c.textContent.trim());
  }).filter(([name]) => name);

  const section = block.closest('.section');
  const main = block.closest('main');
  [section, main].forEach((el) => {
    if (!el) return;
    el.style.maxWidth = 'none';
    el.style.padding = '0';
    el.style.margin = '0';
  });

  const cardsHtml = rows.map(([name, domain, slug, country, date]) => renderCard(name, domain, slug, country, date)).join('');

  block.innerHTML = `
    <div class="ab-companies-page">
      <header class="ab-topbar">
        <div class="ab-topbar-inner">
          <div class="ab-topbar-left">
            <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="ab-topbar-logo" width="80" height="20"/>
            <span class="ab-topbar-divider"></span>
            <span class="ab-topbar-title">AI Bootcamp NL 2026 — Reports</span>
          </div>
          <button class="ab-topbar-logout" type="button" title="Sign out"
            onclick="localStorage.removeItem('${SESSION_KEY}');window.location.href='/aibootcamp/'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>
      <div class="ab-companies-body">
        <div class="ab-search-wrap">
          <div class="ab-search-box">
            <svg class="ab-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="ab-search-input" type="search" placeholder="Search reports..." aria-label="Search reports"/>
            <span class="ab-search-kbd">/</span>
          </div>
        </div>
        <div class="ab-co-grid">${cardsHtml}</div>
      </div>
    </div>`;

  // Search
  const input = block.querySelector('.ab-search-input');
  const cards = [...block.querySelectorAll('.ab-co-card')];

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    cards.forEach((card) => {
      card.style.display = !q || card.dataset.name.includes(q) ? '' : 'none';
    });
  });

  // "/" shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });
}
