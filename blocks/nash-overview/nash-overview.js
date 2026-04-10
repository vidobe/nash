/**
 * loads and decorates the nash-overview block
 * Fetches /qualifications/query.json for live data; falls back to mock data in dev.
 * Document metadata fields used: title, description (domain), status, score, cms, user, lastModified
 * @param {Element} block The block element
 */

const MOCK_REPORTS = [
  {
    id: 1, company: 'Fluidra', domain: 'fluidra.com', status: 'generating', pct: 74, steps: 17, total: 23, task: 'Product Assessment & Success Story', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 2, company: 'Fnbo', domain: 'fnbo.com', status: 'generating', pct: 34, steps: 8, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 3, company: 'Focus GTS', domain: 'focusgts.com', status: 'generating', pct: 21, steps: 5, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'Unknown', time: 'just now', score: null, path: null,
  },
  {
    id: 4, company: 'Fanatics', domain: 'fanatics.com', status: 'generating', pct: 95, steps: 22, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'Unknown', time: 'just now', score: null, path: null,
  },
  {
    id: 5, company: 'Ford', domain: 'ford.com', status: 'generating', pct: 4, steps: 1, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 6, company: 'Fiserv', domain: 'fiserv.com', status: 'generating', pct: 58, steps: 13, total: 23, task: 'Core Analysis', user: 'josec@adobe.com', cms: 'Unknown', time: '2m ago', score: null, path: null,
  },
  {
    id: 7, company: 'Forescout', domain: 'forescout.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '18m ago', score: 78, path: null,
  },
  {
    id: 8, company: 'Firstrand Group', domain: 'firstrand.co.za', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Unknown', time: '32m ago', score: 62, path: null,
  },
  {
    id: 9, company: 'Fortive Corp', domain: 'fortive.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '1h ago', score: 85, path: null,
  },
  {
    id: 10, company: 'Frontier Airlines', domain: 'flyfrontier.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Sitecore', time: '2h ago', score: 71, path: null,
  },
  {
    id: 11, company: 'FNZ Group', domain: 'fnz.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Unknown', time: '3h ago', score: 44, path: null,
  },
  {
    id: 12, company: 'Ferretti Group', domain: 'ferrettigroup.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '5h ago', score: 91, path: null,
  },
];

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toTitleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapQueryRow(row, idx) {
  const score = parseInt(row.score, 10) || null;
  const status = (row.status || '').toLowerCase() === 'generating' ? 'generating' : 'done';
  // Strip " | Nash" suffix from <title> and fall back to path slug
  const rawTitle = (row.title || '').replace(/\s*\|.*$/, '').trim();
  const pathSlug = (row.path || '').split('/').pop();
  const company = rawTitle || toTitleCase(pathSlug) || 'Unknown';
  return {
    id: idx,
    company,
    domain: row.description || '',
    status,
    pct: status === 'done' ? 100 : (parseInt(row.progress, 10) || 0),
    steps: parseInt(row.steps, 10) || 0,
    total: parseInt(row.totalsteps, 10) || 23,
    task: row.task || 'Processing',
    user: row.user || '',
    cms: row.cms || 'Unknown',
    time: relativeTime(row.lastmodified || row.lastModified),
    score: status === 'done' ? score : null,
    path: row.path || null,
  };
}

function scoreColor(s) {
  if (s >= 70) return 'var(--green, #0d7a45)';
  if (s >= 50) return 'var(--amber, #b45309)';
  return 'var(--red, #eb1000)';
}

function verdictLabel(s) {
  if (s >= 70) return 'Go';
  if (s >= 50) return 'Conditional';
  return 'No-go';
}

function verdictStyle(s) {
  if (s >= 70) return 'background:var(--green-lt,#edf7f2);color:var(--green,#0d7a45);';
  if (s >= 50) return 'background:var(--amber-lt,#fef3c7);color:var(--amber,#b45309);';
  return 'background:var(--red-lt,#fff0ef);color:var(--red,#eb1000);';
}

function buildCard(r) {
  const card = document.createElement('div');
  card.className = `nash-overview-card${r.status === 'generating' ? ' generating' : ''}`;
  card.dataset.id = r.id;
  card.dataset.status = r.status;
  card.dataset.company = r.company.toLowerCase();

  const badge = r.status === 'generating'
    ? `<span class="nash-overview-badge gen">
        <svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        Generating
      </span>`
    : '<span class="nash-overview-badge done">&#10003; Complete</span>';

  const body = r.status === 'generating'
    ? `<div class="nash-overview-card-status">Your report is being generated.</div>
       <div class="nash-overview-card-live">
         <span class="nash-overview-live-dot" aria-hidden="true"></span>
         <span class="nash-overview-live-label">Live updates</span>
       </div>
       <div class="nash-overview-progress-row">
         <span class="nash-overview-progress-label">${r.task} (${r.steps}/${r.total} tasks)</span>
         <span class="nash-overview-progress-pct">${r.pct}%</span>
       </div>
       <div class="nash-overview-progress-track">
         <div class="nash-overview-progress-fill" style="width:${r.pct}%" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100" role="progressbar"></div>
       </div>`
    : `<div class="nash-overview-card-status">Qualification complete.</div>
       <div class="nash-overview-score-row">
         <span class="nash-overview-score" style="color:${scoreColor(r.score)}">${r.score}</span>
         <span class="nash-overview-score-of">/ 100 fit score</span>
         <span class="nash-overview-verdict" style="${verdictStyle(r.score)}">${verdictLabel(r.score)}</span>
       </div>`;

  card.innerHTML = `
    <div class="nash-overview-card-top">
      <div class="nash-overview-card-left">
        <div class="nash-overview-favicon" aria-hidden="true">${r.company.charAt(0)}</div>
        <div>
          <div class="nash-overview-company">${r.company}</div>
          <div class="nash-overview-domain">
            <svg width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            ${r.domain}
          </div>
        </div>
      </div>
      <div class="nash-overview-card-meta">
        ${badge}
        <div class="nash-overview-time">${r.time}</div>
      </div>
    </div>
    ${body}
    <div class="nash-overview-card-footer">
      <div class="nash-overview-footer-meta">
        <span class="nash-overview-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          ${r.user}
        </span>
        <span class="nash-overview-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          ${r.cms}
        </span>
      </div>
      <button class="nash-overview-menu-btn" aria-label="More options for ${r.company}" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.nash-overview-menu-btn')) return;
    if (r.path) {
      window.location.href = r.path;
    } else {
      document.dispatchEvent(new CustomEvent('nash:open-detail', { detail: { report: r }, bubbles: true }));
    }
  });

  return card;
}

function renderCards(block, reports) {
  const grid = block.querySelector('.nash-overview-grid');
  if (!grid) return;
  grid.innerHTML = '';
  reports.forEach((r) => grid.appendChild(buildCard(r)));
}

export default async function decorate(block) {
  let reports = [];
  let usingMock = false;
  try {
    const resp = await fetch('/qualifications/query.json');
    if (resp.ok) {
      const json = await resp.json();
      reports = (json.data || []).map(mapQueryRow);
    } else {
      reports = MOCK_REPORTS;
      usingMock = true;
    }
  } catch {
    reports = MOCK_REPORTS;
    usingMock = true;
  }

  const genCount = reports.filter((r) => r.status === 'generating').length;
  const doneCount = reports.filter((r) => r.status === 'done').length;

  block.innerHTML = `
    <div class="nash-overview-notif" id="nash-notif" role="status">
      <span>&#128203;&nbsp;&nbsp;Skills File for AEM has been updated — April 2026. <strong style="cursor:pointer">Review changes &#8594;</strong></span>
      <button class="nash-overview-notif-close" type="button" aria-label="Dismiss notification">
        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="nash-overview-toolbar">
      <div class="nash-overview-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="nash-overview-search" type="search" placeholder="Search qualifications&#8230;" aria-label="Search qualifications"/>
      </div>
      <select class="nash-overview-filter" aria-label="Filter by status">
        <option value="all">Status: All (${reports.length})</option>
        <option value="generating">Generating (${genCount})</option>
        <option value="done">Complete (${doneCount})</option>
      </select>
      <div class="nash-overview-toolbar-right">
        <button class="nash-overview-sort-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
          Last updated
        </button>
        <div class="nash-overview-view-toggle" role="group" aria-label="View layout">
          <button class="nash-overview-vt-btn active" data-layout="grid" type="button" aria-pressed="true" aria-label="Grid view">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button class="nash-overview-vt-btn" data-layout="list" type="button" aria-pressed="false" aria-label="List view">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="nash-overview-area">
      <div class="nash-overview-grid" aria-label="Qualification reports" role="list"></div>
      ${reports.length === 0 ? `<div class="nash-overview-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No qualifications yet. Start a new analysis to get going.</p>
      </div>` : ''}
      ${usingMock ? '<div class="nash-overview-mock-banner" role="status">Preview mode — showing sample data. Publish documents in /qualifications to see real results.</div>' : ''}
    </div>
  `;

  renderCards(block, reports);

  // Dismiss notification
  block.querySelector('.nash-overview-notif-close').addEventListener('click', () => {
    block.querySelector('#nash-notif').remove();
  });

  // Search
  block.querySelector('.nash-overview-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    block.querySelectorAll('.nash-overview-card').forEach((card) => {
      card.hidden = q && !card.dataset.company.includes(q);
    });
  });

  // Filter
  block.querySelector('.nash-overview-filter').addEventListener('change', (e) => {
    const val = e.target.value;
    block.querySelectorAll('.nash-overview-card').forEach((card) => {
      card.hidden = val !== 'all' && card.dataset.status !== val;
    });
  });

  // View toggle
  block.querySelectorAll('.nash-overview-vt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.nash-overview-vt-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      block.querySelector('.nash-overview-grid').dataset.layout = btn.dataset.layout;
    });
  });
}
