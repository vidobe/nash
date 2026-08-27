/* eslint-disable no-use-before-define */

import { listAssessments, isHidden, hideFromList } from '../../scripts/nash-assessments.js';
import { getUserInfo } from '../../scripts/nash-auth.js';
import { slugify } from '../../scripts/da-doc.js';
import { submitFeedback } from '../../scripts/da-feedback.js';

/* Stable per-opportunity key (matches the DA publish slug). */
const oppSlug = (a) => slugify(a.dr || a.company);

const NAV = [
  {
    label: '',
    items: [
      {
        view: 'session', text: 'New Session', icon: 'plus', href: '/indextest',
      },
      {
        view: 'overview', text: 'Overview', badge: 'count', icon: 'grid', href: '/',
      },
    ],
  },
];

const MOCK_RECENT = [
  { title: 'Ministry of Defence — NL', path: '#' },
  { title: 'Sannetestcompany', path: '#' },
  { title: 'Nash Detail View', path: '#' },
];

const USER_MENU = [
  { text: 'About Nash', icon: 'info', href: '/about-nash' },
  { text: 'Solution Skills', icon: 'layers', href: '/solutions/' },
];

const SORT_KEY = 'nash-sidebar-sort';
const SORT_DIR_KEY = 'nash-sidebar-sort-dir';
const defaultDir = (sort) => (sort === 'alpha' ? 'asc' : 'desc');

const ICONS = {
  sort: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5h10M11 9h7M11 13h4M3 7l3-3 3 3M6 4v16"/></svg>',
  grid: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  activity: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  globe: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
  file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  layers: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  signal: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>',
  info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  book: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
  message: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  panel: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  logout: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  moon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
};

function cleanTitle(t) {
  return (t || '').replace(/\s*\|.*$/, '').trim();
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusClass(s) {
  const t = (s || '').toLowerCase();
  if (t === 'done' || t === 'complete') return 'status-done';
  if (t === 'generating' || t === 'running') return 'status-running';
  if (t === 'error' || t === 'failed') return 'status-error';
  return '';
}

/* Assessments — locally-created (in-progress) merged with published qualifications. */
function buildAssessItems(reports) {
  const currentUser = (getUserInfo()?.email || '').toLowerCase();
  const seen = new Set();

  const local = listAssessments()
    .filter((a) => {
      if (a.user && a.user.toLowerCase() !== currentUser) return false;
      const slug = oppSlug(a);
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .map((a) => ({
      name: a.company || '',
      href: `/indextest?a=${encodeURIComponent(a.id)}`,
      status: a.status,
      date: a.updatedAt || a.createdAt || 0,
      solutions: Array.isArray(a.solutions) ? a.solutions.join(', ') : (a.solutions || ''),
      isLocal: true,
      id: a.id,
    }));

  const pub = [...reports]
    .filter((r) => cleanTitle(r.title))
    .filter((r) => !currentUser || (r.user || '').toLowerCase() === currentUser)
    .filter((r) => !seen.has((r.path || '').split('/').pop()))
    .map((r) => ({
      name: cleanTitle(r.title),
      href: r.path || '#',
      status: r.status,
      date: Number(r.lastModified || 0),
      solutions: r.solutions || '',
      isLocal: false,
    }));

  // Items the user removed from the sidebar (keyed by href) stay hidden here but
  // are NOT deleted — they remain available in the Overview.
  return [...local, ...pub].filter((it) => !isHidden(it.href));
}

function sortAssessItems(items, sort, dir) {
  const arr = [...items];
  if (sort === 'alpha') arr.sort((a, b) => a.name.localeCompare(b.name));
  else arr.sort((a, b) => a.date - b.date);
  if (dir === 'desc') arr.reverse();
  return arr;
}

function assessmentsHtml(reports) {
  const sort = localStorage.getItem(SORT_KEY) || 'date';
  const dir = localStorage.getItem(SORT_DIR_KEY) || defaultDir(sort);
  const items = sortAssessItems(buildAssessItems(reports), sort, dir).slice(0, 16);
  if (!items.length) return '';

  const SORT_OPTS = [
    { key: 'date', label: 'Date' },
    { key: 'alpha', label: 'A to Z' },
  ];

  const rows = items.map((item) => `
    <div class="nash-sidebar-recent-item">
      <a class="nash-sidebar-recent ${statusClass(item.status)}" href="${esc(item.href)}" title="${esc(item.name)}">${esc(item.name)}</a>
      <button class="nash-sidebar-recent-del" type="button" data-hide="${esc(item.href)}" aria-label="Remove from list" title="Remove from list (keeps the assessment)">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  return `
    <div class="nash-sidebar-section nash-sidebar-recent-section">
      <div class="nash-sidebar-assess-head">
        <span class="nash-sidebar-label">Assessments</span>
        <div class="nash-sidebar-sort-wrap">
          <button class="nash-sidebar-sort-btn" type="button" title="Sort assessments" aria-label="Sort assessments">${dir === 'asc' ? ICONS.arrowUp : ICONS.arrowDown}</button>
          <div class="nash-sidebar-sort-menu" hidden>
            ${SORT_OPTS.map((o) => {
    const active = sort === o.key;
    let arrow = '';
    if (active) arrow = dir === 'asc' ? ICONS.arrowUp : ICONS.arrowDown;
    return `<button class="nash-sidebar-sort-opt${active ? ' active' : ''}" type="button" data-sort-by="${o.key}"><span>${o.label}</span>${arrow}</button>`;
  }).join('')}
          </div>
        </div>
      </div>
      ${rows}
    </div>
  `;
}

function badge(item, countEl) {
  if (!item.badge) return '';
  if (item.badge === 'count') {
    return `<span class="nash-sidebar-badge gray" id="nash-sidebar-count">${countEl}</span>`;
  }
  return `<span class="nash-sidebar-badge">${item.badge}</span>`;
}

function renderNav(block, reportCount) {
  const u = getUserInfo() || { name: 'Signed in', email: '', initials: '?' };
  const sectionsHtml = NAV.map((section) => `
    <div class="nash-sidebar-section">
      ${section.label ? `<span class="nash-sidebar-label">${section.label}</span>` : ''}
      ${section.items.map((item) => `
        <button class="nash-sidebar-item" data-view="${item.view}" ${item.href ? `data-href="${item.href}"` : ''} type="button" title="${item.text}">
          ${ICONS[item.icon] || ''}
          <span class="nash-sidebar-text">${item.text}</span>
          ${badge(item, reportCount)}
        </button>
      `).join('')}
    </div>
  `).join('');

  block.innerHTML = `
    <div class="nash-sidebar-head">
      <a class="nash-sidebar-brand" href="/" aria-label="Nash home">
        <span class="nash-sidebar-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 240 234" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adobe">
            <rect height="234" rx="42.5" width="240" fill="#fa0f00"/>
            <path fill="#fff" d="M186.617 175.95h-28.506a6.243 6.243 0 0 1-5.847-3.769l-30.947-72.359a1.364 1.364 0 0 0-2.611-.034L99.42 145.731a1.635 1.635 0 0 0 1.506 2.269h21.2a3.27 3.27 0 0 1 3.01 1.994l9.281 20.655a3.812 3.812 0 0 1-3.507 5.301H53.734a3.518 3.518 0 0 1-3.213-4.904l49.09-116.902A6.639 6.639 0 0 1 105.843 50h28.314a6.628 6.628 0 0 1 6.232 4.144l49.43 116.902a3.517 3.517 0 0 1-3.202 4.904z"/>
          </svg>
        </span>
        <span class="nash-sidebar-wordmark">Nash</span>
        <span class="nash-sidebar-subtitle">Solution Qualifier</span>
      </a>
      <button class="nash-sidebar-toggle" type="button" aria-label="Collapse sidebar">${ICONS.panel}</button>
    </div>
    <nav class="nash-sidebar-nav" aria-label="Nash navigation">
      ${sectionsHtml}
      <div class="nash-sidebar-assess"></div>
    </nav>
    <div class="nash-sidebar-bottom">
      <div class="nash-sidebar-usermenu" role="menu" hidden>
        <button class="nash-sidebar-themetoggle" type="button" role="menuitemcheckbox" aria-checked="false">
          <span class="nash-sidebar-theme-label">${ICONS.moon} Dark mode</span>
          <span class="nash-sidebar-switch" aria-hidden="true"><span class="nash-sidebar-switch-knob"></span></span>
        </button>
        <hr class="nash-sidebar-menudivider"/>
        ${USER_MENU.map((m) => `
          <a class="nash-sidebar-menuitem" href="${m.href}" role="menuitem">
            ${ICONS[m.icon] || ''}
            ${m.text}
          </a>
        `).join('')}
        <hr class="nash-sidebar-menudivider"/>
        <button class="nash-sidebar-menuitem nash-sidebar-logout" type="button" role="menuitem">
          ${ICONS.logout}
          Log out
        </button>
      </div>
      <div class="nash-sidebar-feedback">
        <button class="nash-sidebar-feedback-btn" type="button" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Send feedback</span>
        </button>
        <form class="nash-sidebar-feedback-form" hidden>
          <textarea class="nash-sidebar-feedback-input" rows="3" placeholder="Share a comment, idea, or bug…" aria-label="Your feedback"></textarea>
          <div class="nash-sidebar-feedback-actions">
            <button type="button" class="nash-sidebar-feedback-cancel">Cancel</button>
            <button type="submit" class="nash-sidebar-feedback-send">Send</button>
          </div>
          <p class="nash-sidebar-feedback-msg" hidden></p>
        </form>
      </div>
      <div class="nash-sidebar-user" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" aria-label="User menu">
        <div class="nash-sidebar-user-av" aria-hidden="true">${esc(u.initials)}</div>
        <div>
          <div class="nash-sidebar-user-name">${esc(u.name)}</div>
          <div class="nash-sidebar-user-email">${esc(u.email)}</div>
        </div>
      </div>
    </div>
  `;
}

function setActive(block, view) {
  block.querySelectorAll('.nash-sidebar-item').forEach((btn) => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

const COLLAPSE_KEY = 'nash-nav-collapsed';

function setupCollapse(block) {
  const toggleBtn = block.querySelector('.nash-sidebar-toggle');

  const apply = (collapsed) => {
    document.body.classList.toggle('nash-nav-collapsed', collapsed);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  };

  // restore saved state
  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { /* ignore */ }
  apply(collapsed);

  toggleBtn?.addEventListener('click', () => {
    apply(!document.body.classList.contains('nash-nav-collapsed'));
  });
}

const THEME_KEY = 'nash-theme';
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

function setupThemeToggle(block) {
  const btn = block.querySelector('.nash-sidebar-themetoggle');
  if (!btn) return;
  const sync = () => {
    const dark = currentTheme() === 'dark';
    btn.setAttribute('aria-checked', String(dark));
    btn.classList.toggle('on', dark);
  };
  sync();
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // keep the menu open
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    sync();
  });
}

function setupUserMenu(block) {
  const user = block.querySelector('.nash-sidebar-user');
  const menu = block.querySelector('.nash-sidebar-usermenu');
  if (!user || !menu) return;

  const close = () => {
    menu.hidden = true;
    user.setAttribute('aria-expanded', 'false');
  };

  user.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    user.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  block.querySelector('.nash-sidebar-logout')?.addEventListener('click', () => {
    try { localStorage.removeItem('nash-auth'); } catch { /* ignore */ }
    window.location.href = '/login';
  });
}

function setupFeedback(block) {
  const wrap = block.querySelector('.nash-sidebar-feedback');
  if (!wrap) return;
  const btn = wrap.querySelector('.nash-sidebar-feedback-btn');
  const form = wrap.querySelector('.nash-sidebar-feedback-form');
  const input = wrap.querySelector('.nash-sidebar-feedback-input');
  const cancel = wrap.querySelector('.nash-sidebar-feedback-cancel');
  const send = wrap.querySelector('.nash-sidebar-feedback-send');
  const msg = wrap.querySelector('.nash-sidebar-feedback-msg');

  const setMsg = (text, ok) => {
    msg.textContent = text;
    msg.hidden = !text;
    msg.classList.toggle('is-error', !ok && !!text);
  };
  const open = (show) => {
    form.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) input.focus();
  };

  btn.addEventListener('click', () => open(form.hidden));
  cancel.addEventListener('click', () => { open(false); setMsg('', true); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = input.value.trim();
    if (!comment) { input.focus(); return; }
    send.disabled = true;
    send.textContent = 'Sending…';
    setMsg('', true);
    try {
      await submitFeedback({ comment, email: getUserInfo()?.email || '' });
      input.value = '';
      setMsg('Thanks — your feedback was sent.', true);
      window.setTimeout(() => { open(false); setMsg('', true); }, 1600);
    } catch (err) {
      setMsg(err.message || 'Couldn’t send feedback.', false);
    } finally {
      send.disabled = false;
      send.textContent = 'Send';
    }
  });
}

/**
 * loads and decorates the nash-sidebar block
 * No authored content needed — navigation is programmatic.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  let reports = [];

  try {
    const resp = await fetch('/qualifications/query.json');
    if (resp.ok) {
      const data = await resp.json();
      reports = data.data || [];
    }
  } catch {
    reports = [];
  }
  if (!reports.length) reports = MOCK_RECENT; // dev fallback

  renderNav(block, reports.length);

  const refreshAssess = () => {
    const container = block.querySelector('.nash-sidebar-assess');
    if (container) container.innerHTML = assessmentsHtml(reports);
  };
  refreshAssess();
  document.addEventListener('nash:assessments-changed', refreshAssess);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nash-sidebar-sort-wrap')) {
      block.querySelectorAll('.nash-sidebar-sort-menu').forEach((m) => { m.hidden = true; });
    }
  });

  setupCollapse(block);
  setupUserMenu(block);
  setupThemeToggle(block);
  setupFeedback(block);

  // Detect active item from current URL
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const onAssessment = new URLSearchParams(window.location.search).has('a');
  const allItems = NAV.flatMap((s) => s.items);
  let matched = allItems.find((item) => {
    if (!item.href) return false;
    const itemPath = item.href.replace(/\/$/, '') || '/';
    if (itemPath === '/') return path === '/' || path === '';
    return path === itemPath || path.startsWith(`${itemPath}/`);
  });
  // Viewing an assessment (/indextest?a=…) is not "New Session".
  if (onAssessment && matched?.view === 'session') matched = null;
  setActive(block, matched?.view || '');

  block.addEventListener('click', (e) => {
    const del = e.target.closest('.nash-sidebar-recent-del');
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      hideFromList(del.dataset.hide);
      return;
    }

    const sortBtn = e.target.closest('.nash-sidebar-sort-btn');
    if (sortBtn) {
      e.stopPropagation();
      const menu = sortBtn.closest('.nash-sidebar-sort-wrap')?.querySelector('.nash-sidebar-sort-menu');
      if (menu) menu.hidden = !menu.hidden;
      return;
    }

    const sortOpt = e.target.closest('.nash-sidebar-sort-opt');
    if (sortOpt) {
      // Same option again flips direction; a new option resets to its default dir.
      const key = sortOpt.dataset.sortBy;
      const curSort = localStorage.getItem(SORT_KEY) || 'date';
      const curDir = localStorage.getItem(SORT_DIR_KEY) || defaultDir(curSort);
      if (key === curSort) {
        localStorage.setItem(SORT_DIR_KEY, curDir === 'asc' ? 'desc' : 'asc');
      } else {
        localStorage.setItem(SORT_KEY, key);
        localStorage.setItem(SORT_DIR_KEY, defaultDir(key));
      }
      refreshAssess();
      return;
    }

    const btn = e.target.closest('.nash-sidebar-item');
    if (!btn) return;
    const { view, href } = btn.dataset;
    // New Session: if already on the chat home, reset it in place; otherwise navigate.
    if (view === 'session' && window.location.pathname.startsWith('/indextest')) {
      document.dispatchEvent(new CustomEvent('nash:new-session', { bubbles: true }));
      return;
    }
    if (href) {
      window.location.href = href;
      return;
    }
    setActive(block, view);
    document.dispatchEvent(new CustomEvent('nash:navigate', { detail: { view }, bubbles: true }));
  });

  document.addEventListener('nash:navigate', (e) => {
    setActive(block, e.detail?.view);
  });
}
