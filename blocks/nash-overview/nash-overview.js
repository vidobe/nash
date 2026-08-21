/**
 * loads and decorates the nash-overview block
 * Fetches /qualifications/query.json for live data; falls back to mock data in dev.
 * Also merges locally-created assessments (localStorage) so completed runs appear here.
 * Document metadata fields: title, description (domain), status, score, cms, user, lastModified
 *
 * @param {Element} block The block element
 */

import { listAssessments } from '../../scripts/nash-assessments.js';
import { slugify } from '../../scripts/da-doc.js';

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

/* Resolve a numeric fit score, tolerating a string score or a missing one by
   summing the scored dimensions (which sum to the overall score). */
function coerceScore(a) {
  if (typeof a.score === 'number' && Number.isFinite(a.score)) return a.score;
  if (typeof a.score === 'string' && a.score.trim() !== '' && Number.isFinite(Number(a.score))) {
    return Number(a.score);
  }
  if (Array.isArray(a.dimensions) && a.dimensions.length) {
    const sum = a.dimensions.reduce((t, d) => t + (parseInt(d.scored, 10) || 0), 0);
    if (sum > 0) return sum;
  }
  return null;
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
    solutions: row.solutionnames || '',
    time: relativeTime(row.lastmodified || row.lastModified),
    ts: Number(row.lastmodified || row.lastModified) || 0,
    score: status === 'done' ? score : null,
    verdict: row.verdict || '',
    path: row.path || null,
  };
}

/* Map a locally-created assessment (localStorage) to the card model. */
function mapLocalAssessment(a, idx) {
  const ts = Math.floor((a.updatedAt || a.createdAt || Date.now()) / 1000);
  return {
    id: `local-${idx}`,
    company: a.company || 'Untitled',
    domain: a.dr ? `DR ${a.dr}` : '',
    status: a.status === 'done' ? 'done' : 'generating',
    pct: a.status === 'done' ? 100 : 0,
    steps: 0,
    total: 23,
    task: 'Draft',
    user: 'vgabriel@adobe.com',
    solutions: (a.solutions || []).map((s) => s.name).join(', ') || a.solutionNames || '',
    time: relativeTime(ts),
    ts,
    score: a.status === 'done' ? coerceScore(a) : null,
    verdict: a.verdict || '',
    path: `/indextest?a=${encodeURIComponent(a.id)}`,
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

/* Verdict chip label + style — prefer the stored verdict, fall back to score. */
function verdictInfo(r) {
  if (typeof r.score === 'number') return { label: verdictLabel(r.score), style: verdictStyle(r.score) };
  const v = (r.verdict || '').toLowerCase();
  if (/no.?go/.test(v)) return { label: 'No-go', style: verdictStyle(0) };
  if (/condition/.test(v)) return { label: 'Conditional', style: verdictStyle(60) };
  if (/\bgo\b/.test(v)) return { label: 'Go', style: verdictStyle(80) };
  return { label: '', style: '' };
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
         <span class="nash-overview-score" style="color:${r.score == null ? 'var(--ink-40,#9a9da6)' : scoreColor(r.score)}">${r.score == null ? '—' : r.score}</span>
         <span class="nash-overview-score-of">/ 100 fit score</span>
         ${(() => { const v = verdictInfo(r); return v.label ? `<span class="nash-overview-verdict" style="${v.style}">${v.label}</span>` : ''; })()}
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
          <svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          ${r.solutions || '—'}
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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Clean, borderless table for the list view. */
function tableRow(r) {
  let scoreCell;
  if (r.status === 'generating') {
    scoreCell = `<span class="nash-overview-t-gen">Generating ${r.pct}%</span>`;
  } else if (r.score == null) {
    scoreCell = '<span class="nash-overview-t-muted">—</span>';
  } else {
    scoreCell = `<span class="nash-overview-t-score" style="color:${scoreColor(r.score)}">${r.score}</span><span class="nash-overview-t-of"> / 100</span>`;
  }
  const v = verdictInfo(r);
  const verdictCell = r.status === 'generating' || !v.label
    ? '<span class="nash-overview-t-muted">—</span>'
    : `<span class="nash-overview-verdict" style="${v.style}">${v.label}</span>`;
  return `<tr class="nash-overview-trow" data-id="${esc(r.id)}" data-status="${esc(r.status)}" data-company="${esc(r.company.toLowerCase())}"${r.path ? ` data-path="${esc(r.path)}"` : ''}>
    <td class="nash-overview-t-name">
      <span class="nash-overview-favicon" aria-hidden="true">${esc(r.company.charAt(0))}</span>
      <span>${esc(r.company)}</span>
    </td>
    <td>${scoreCell}</td>
    <td>${verdictCell}</td>
    <td class="nash-overview-t-muted">${esc(r.solutions || '—')}</td>
    <td class="nash-overview-t-muted">${esc(r.user || '')}</td>
    <td class="nash-overview-t-muted nash-overview-t-time">${esc(r.time || '')}</td>
  </tr>`;
}

function renderTable(block, reports) {
  const wrap = block.querySelector('.nash-overview-listwrap');
  if (!wrap) return;
  wrap.innerHTML = `<table class="nash-overview-table">
    <thead><tr>
      <th>Company</th><th>Fit score</th><th>Verdict</th><th>Solutions</th><th>Owner</th><th>Updated</th>
    </tr></thead>
    <tbody>${reports.map(tableRow).join('')}</tbody>
  </table>`;
  wrap.querySelectorAll('.nash-overview-trow').forEach((row) => {
    row.addEventListener('click', () => {
      const report = reports.find((r) => String(r.id) === row.dataset.id);
      if (row.dataset.path) window.location.href = row.dataset.path;
      else if (report) document.dispatchEvent(new CustomEvent('nash:open-detail', { detail: { report }, bubbles: true }));
    });
  });
}

/* Richer stats strip: total, avg score (with bar), win rate, and a verdict mix. */
function statsStrip(s) {
  const avgColor = s.avg == null ? 'var(--ink-40, #9a9da6)' : scoreColor(s.avg);
  const seg = (n, cls) => (n > 0 ? `<span class="nash-overview-seg ${cls}" style="flex:${n}"></span>` : '');
  return `
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num">${s.total}</div>
      <div class="nash-overview-stat-label">Assessments</div>
      <div class="nash-overview-stat-sub">${s.done} complete &middot; ${s.gen} in progress</div>
    </div>
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num" style="color:${avgColor}">${s.avg == null ? '—' : s.avg}<span class="nash-overview-stat-unit">/100</span></div>
      <div class="nash-overview-stat-label">Avg fit score</div>
      <div class="nash-overview-stat-bar"><div style="width:${s.avg == null ? 0 : s.avg}%;background:${avgColor}"></div></div>
    </div>
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num">${s.winRate == null ? '—' : `${s.winRate}%`}</div>
      <div class="nash-overview-stat-label">Win rate</div>
      <div class="nash-overview-stat-sub">${s.go} of ${s.scoredCount} rated Go</div>
    </div>
    <div class="nash-overview-stat nash-overview-stat-wide">
      <div class="nash-overview-stat-label">Verdict mix</div>
      <div class="nash-overview-mixbar">${seg(s.go, 'go')}${seg(s.cond, 'cond')}${seg(s.nogo, 'nogo')}</div>
      <div class="nash-overview-mixlegend">
        <span class="go">${s.go} Go</span>
        <span class="cond">${s.cond} Conditional</span>
        <span class="nogo">${s.nogo} No-go</span>
      </div>
    </div>`;
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

  // Merge locally-created assessments (newest first) ahead of published ones,
  // deduped by opportunity: keep the local (editable) copy and drop any published
  // doc for the same opp.
  const seen = new Set();
  const localRaw = listAssessments().filter((a) => {
    const slug = slugify(a.dr || a.company);
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
  const local = localRaw.map(mapLocalAssessment);
  const publishedDeduped = reports.filter((r) => !seen.has((r.path || '').split('/').pop()));
  reports = [...local, ...publishedDeduped];

  const genCount = reports.filter((r) => r.status === 'generating').length;
  const doneCount = reports.filter((r) => r.status === 'done').length;

  // Stats over completed qualifications
  const scored = reports.filter((r) => r.status === 'done' && typeof r.score === 'number');
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length) : null;
  const goCount = scored.filter((r) => r.score >= 70).length;
  const condCount = scored.filter((r) => r.score >= 50 && r.score < 70).length;
  const nogoCount = scored.filter((r) => r.score < 50).length;
  const scoredCount = scored.length;
  const winRate = scoredCount ? Math.round((goCount / scoredCount) * 100) : null;

  block.innerHTML = `
    <div class="nash-overview-head">
      <h1 class="nash-overview-title">Qualifications</h1>
      <p class="nash-overview-subtitle">Every opportunity your team has assessed with Nash.</p>
      <p class="nash-overview-intro">Fit scores, verdicts and win rate across all completed assessments. Search or filter to find a deal, switch between grid and list, or open one to dive in.</p>
    </div>
    <div class="nash-overview-stats">
      ${statsStrip({
    total: reports.length,
    done: doneCount,
    gen: genCount,
    avg: avgScore,
    winRate,
    go: goCount,
    cond: condCount,
    nogo: nogoCount,
    scoredCount,
  })}
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
          <span class="nash-overview-sort-label">Last updated</span>
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
    <div class="nash-overview-area" data-layout="grid">
      <div class="nash-overview-grid" aria-label="Qualification reports" role="list"></div>
      <div class="nash-overview-listwrap"></div>
      <div class="nash-overview-noresults" hidden>No qualifications match your search.</div>
      <div class="nash-overview-pagination"></div>
      ${reports.length === 0 ? `<div class="nash-overview-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No qualifications yet. Start a new analysis to get going.</p>
      </div>` : ''}
      ${usingMock ? '<div class="nash-overview-mock-banner" role="status">Preview mode — showing sample data. Publish documents in /qualifications to see real results.</div>' : ''}
    </div>
  `;

  // Client-side view model: filter + sort + paginate (20 per page).
  const PAGE_SIZE = 20;
  const state = {
    q: '', status: 'all', sort: 'updated', page: 1,
  };

  const view = () => {
    let list = reports.filter((r) => state.status === 'all' || r.status === state.status);
    if (state.q) {
      list = list.filter((r) => r.company.toLowerCase().includes(state.q)
        || (r.solutions || '').toLowerCase().includes(state.q));
    }
    const by = state.sort === 'score'
      ? (a, b) => (b.score || 0) - (a.score || 0)
      : (a, b) => (b.ts || 0) - (a.ts || 0);
    return [...list].sort(by);
  };

  function renderPage() {
    const list = view();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const startIdx = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(startIdx, startIdx + PAGE_SIZE);
    renderCards(block, pageItems);
    renderTable(block, pageItems);
    const noRes = block.querySelector('.nash-overview-noresults');
    if (noRes) noRes.hidden = list.length !== 0;

    const pag = block.querySelector('.nash-overview-pagination');
    if (!pag) return;
    if (pages <= 1) { pag.innerHTML = ''; return; }
    const to = Math.min(state.page * PAGE_SIZE, list.length);
    pag.innerHTML = `
      <span class="nash-overview-page-info">${startIdx + 1}–${to} of ${list.length}</span>
      <div class="nash-overview-page-btns">
        <button class="nash-overview-page-btn" data-nav="prev" type="button"${state.page <= 1 ? ' disabled' : ''}>&lsaquo; Prev</button>
        <span class="nash-overview-page-cur">Page ${state.page} of ${pages}</span>
        <button class="nash-overview-page-btn" data-nav="next" type="button"${state.page >= pages ? ' disabled' : ''}>Next &rsaquo;</button>
      </div>`;
    pag.querySelector('[data-nav="prev"]')?.addEventListener('click', () => { state.page -= 1; renderPage(); });
    pag.querySelector('[data-nav="next"]')?.addEventListener('click', () => { state.page += 1; renderPage(); });
  }

  renderPage();

  block.querySelector('.nash-overview-search').addEventListener('input', (e) => {
    state.q = e.target.value.toLowerCase();
    state.page = 1;
    renderPage();
  });

  block.querySelector('.nash-overview-filter').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    renderPage();
  });

  block.querySelector('.nash-overview-sort-btn')?.addEventListener('click', () => {
    state.sort = state.sort === 'updated' ? 'score' : 'updated';
    const label = block.querySelector('.nash-overview-sort-label');
    if (label) label.textContent = state.sort === 'score' ? 'Fit score' : 'Last updated';
    state.page = 1;
    renderPage();
  });

  // View toggle (grid ⇄ list table)
  block.querySelectorAll('.nash-overview-vt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.nash-overview-vt-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      block.querySelector('.nash-overview-area').dataset.layout = btn.dataset.layout;
    });
  });
}
