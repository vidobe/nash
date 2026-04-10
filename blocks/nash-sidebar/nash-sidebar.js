/* eslint-disable no-use-before-define */

const NAV = [
  {
    label: 'Main',
    items: [
      {
        view: 'overview', text: 'Overview', badge: 'count', icon: 'grid',
      },
      { view: 'new-insight', text: 'New Insight', icon: 'plus' },
      {
        view: 'campaigns', text: 'Campaigns', badge: '3', icon: 'activity',
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      { view: 'cms-detector', text: 'CMS Detector', icon: 'globe' },
      { view: 'skills-files', text: 'Skills Files', icon: 'file' },
      { view: 'feedback', text: 'Feedback Hub', icon: 'signal' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { view: 'about', text: 'About Nash', icon: 'info' },
      { view: 'guide', text: 'Insights Guide', icon: 'book' },
    ],
  },
];

const ICONS = {
  grid: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  activity: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  globe: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
  file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  signal: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>',
  info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  book: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
};

function badge(item, countEl) {
  if (!item.badge) return '';
  if (item.badge === 'count') {
    return `<span class="nash-sidebar-badge gray" id="nash-sidebar-count">${countEl}</span>`;
  }
  return `<span class="nash-sidebar-badge">${item.badge}</span>`;
}

function renderNav(block, reportCount) {
  const sectionsHtml = NAV.map((section) => `
    <div class="nash-sidebar-section">
      <span class="nash-sidebar-label">${section.label}</span>
      ${section.items.map((item) => `
        <button class="nash-sidebar-item" data-view="${item.view}" type="button">
          ${ICONS[item.icon] || ''}
          ${item.text}
          ${badge(item, reportCount)}
        </button>
      `).join('')}
    </div>
    <hr class="nash-sidebar-divider"/>
  `).join('');

  block.innerHTML = `
    <nav class="nash-sidebar-nav" aria-label="Nash navigation">
      ${sectionsHtml}
    </nav>
    <div class="nash-sidebar-bottom">
      <div class="nash-sidebar-user" role="button" tabindex="0" aria-label="User profile">
        <div class="nash-sidebar-user-av" aria-hidden="true">VG</div>
        <div>
          <div class="nash-sidebar-user-name">Vitor</div>
          <div class="nash-sidebar-user-email">vgabriel@adobe.com</div>
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

/**
 * loads and decorates the nash-sidebar block
 * No authored content needed — navigation is programmatic.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  let reportCount = 0;

  try {
    const resp = await fetch('/reports/query.json');
    if (resp.ok) {
      const data = await resp.json();
      reportCount = (data.data || []).length;
    }
  } catch {
    reportCount = 12; // mock fallback
  }

  renderNav(block, reportCount);
  setActive(block, 'overview');

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('.nash-sidebar-item');
    if (!btn) return;
    const { view } = btn.dataset;
    setActive(block, view);
    document.dispatchEvent(new CustomEvent('nash:navigate', { detail: { view }, bubbles: true }));
  });

  document.addEventListener('nash:navigate', (e) => {
    setActive(block, e.detail?.view);
  });
}
