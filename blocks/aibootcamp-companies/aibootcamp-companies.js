/**
 * aibootcamp-companies block
 * Lists all company reports as cards with search.
 * Reads company rows from authored content: name | domain | slug | country
 */

const RESULTS_PAGE = '/aibootcamp/brand-visibility-report';
const SESSION_KEY = 'aibootcamp-auth';

function getSession() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return auth && Date.now() < auth.expires ? auth : null;
  } catch { return null; }
}

function initials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return (email || 'U').slice(0, 2).toUpperCase();
}

function renderUserMenu(session) {
  const abbr = initials(session.name, session.email);
  const display = session.name || session.email || '';
  return `
    <div class="ab-user-menu">
      <button class="ab-user-trigger" type="button" aria-label="Account menu">
        <span class="ab-user-avatar">${abbr}</span>
        <span class="ab-user-name">${display}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="ab-user-dropdown">
        <div class="ab-user-dropdown-header">
          <span class="ab-user-avatar ab-user-avatar-lg">${abbr}</span>
          <div>
            <p class="ab-user-dropdown-name">${session.name || ''}</p>
            <p class="ab-user-dropdown-email">${session.email || ''}</p>
          </div>
        </div>
        <button class="ab-user-signout" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>`;
}

function renderCard(name, domain, slug, country) {
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
      </div>
      <div class="ab-co-domain">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <a href="https://${domain}" target="_blank" rel="noopener">${domain}</a>
      </div>
      <p class="ab-co-desc">Report is ready to view.</p>
      <div class="ab-co-meta">
        <span class="ab-co-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          ${country || 'Netherlands'}
        </span>
      </div>
      <div class="ab-co-actions">
        <a class="ab-co-open-btn" href="${RESULTS_PAGE}?company=${slug}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Open Analysis
        </a>
      </div>
    </div>`;
}

export default function decorate(block) {
  // Auth guard
  const session = getSession();
  if (!session) { window.location.href = '/aibootcamp/'; return; }

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
    el.style.overflow = 'visible';
  });

  const cardsHtml = rows.map(([name, domain, slug, country]) => renderCard(name, domain, slug, country)).join('');

  block.innerHTML = `
    <div class="ab-companies-page">
      <header class="ab-topbar">
        <div class="ab-topbar-inner">
          <div class="ab-topbar-left">
            <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="ab-topbar-logo" width="80" height="20"/>
            <span class="ab-topbar-divider"></span>
            <span class="ab-topbar-title">AI Bootcamp NL 2026</span>
          </div>
          ${renderUserMenu(session)}
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
      <footer class="ab-companies-footer">Confidential &middot; Adobe Digital Insights &middot; AI Bootcamp NL 2026</footer>
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

  // User dropdown toggle
  const trigger = block.querySelector('.ab-user-trigger');
  const dropdown = block.querySelector('.ab-user-dropdown');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('ab-user-dropdown-open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('ab-user-dropdown-open');
  });

  block.querySelector('.ab-user-signout').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/aibootcamp/';
  });
}
