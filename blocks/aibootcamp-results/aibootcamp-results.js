/**
 * aibootcamp-results block
 * Auth-gated brand visibility dashboard — full 19-page report renderer.
 */

const LOGIN_PAGE = '/aibootcamp/';
const REPORTS_BASE = '/aibootcamp/reports/';
const SESSION_KEY = 'aibootcamp-auth';

function requireAuth() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const s = auth && Date.now() < auth.expires ? auth : null;
    if (!s) { window.location.href = LOGIN_PAGE; return null; }
    return s;
  } catch { window.location.href = LOGIN_PAGE; return null; }
}

async function fetchReport(slug) {
  const resp = await fetch(`${REPORTS_BASE}${slug}.plain.html`);
  if (!resp.ok) throw new Error(`Report not found: ${slug}`);
  return new DOMParser().parseFromString(await resp.text(), 'text/html');
}

function parseBlock(doc, name) {
  const el = doc.querySelector(`.${name}`);
  if (!el) return [];
  return [...el.querySelectorAll(':scope > div')].map(
    (row) => [...row.querySelectorAll(':scope > div')].map((c) => c.textContent.trim()),
  );
}

function parseKV(doc, name) {
  return Object.fromEntries(parseBlock(doc, name).map(([k, v]) => [k, v]));
}

function scoreColor(val) {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return 'neutral';
  if (n >= 70) return 'green';
  if (n >= 50) return 'amber';
  return 'red';
}

function cwvStatus(status) {
  if (status === 'good') return 'green';
  if (status === 'needs-work') return 'amber';
  if (status === 'poor') return 'red';
  return 'neutral';
}

function badge(priority) {
  const map = { high: 'red', medium: 'amber', low: 'gray' };
  const c = map[priority] || 'gray';
  return `<span class="ab-badge ab-badge-${c}">${priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : ''} Priority</span>`;
}

// ─── Topbar (Adobe logo + logout — sticky) ─────────────────────
function renderTopbar() {
  return `
    <header class="ab-topbar">
      <div class="ab-topbar-inner">
        <div class="ab-topbar-left">
          <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="ab-topbar-logo" width="80" height="20"/>
          <span class="ab-topbar-divider"></span>
          <span class="ab-topbar-title">Digital Insights Report</span>
        </div>
        <button class="ab-topbar-logout" type="button" aria-label="Sign out" title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>`;
}

// ─── Domain bar (AI-Generated badge + domain) ──────────────────
function renderDomainBar(meta) {
  return `
    <div class="ab-domain-bar">
      <div class="ab-domain-left">
        <span class="ab-ai-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          AI-Generated
        </span>
        <span class="ab-domain-name">${meta.domain || ''}</span>
      </div>
    </div>`;
}

// ─── Tabs ──────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'seo', label: 'SEO' },
  { id: 'ai-visibility', label: 'AI Visibility' },
  { id: 'solutions', label: 'Solutions' },
];

function renderTabNav(active) {
  return `
    <nav class="ab-tabnav" aria-label="Report sections">
      <div class="ab-tabnav-inner">
        ${TABS.map((t) => `<button class="ab-tabnav-btn${t.id === active ? ' ab-tabnav-btn-active' : ''}" data-tab="${t.id}" type="button">${t.label}</button>`).join('')}
      </div>
    </nav>`;
}

// ─── Helpers ───────────────────────────────────────────────────
function card(content, cls = '') {
  return `<div class="ab-card${cls ? ` ${cls}` : ''}">${content}</div>`;
}

function sectionHtml(id, title, body, sub = '') {
  return `<section class="ab-section" id="${id}">
    <h2 class="ab-section-title">${title}</h2>${sub ? `<p class="ab-section-sub">${sub}</p>` : ''}
    ${body}
  </section>`;
}

// ─── Overview tab ──────────────────────────────────────────────
function buildOverview(meta, yourRequest, execOverview, worldSeesYou, whyAdobe, priorityIssues) {
  const WORLD_ICONS = {
    seo: {
      color: 'purple',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    },
    'ai-visibility': {
      color: 'green',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    },
    performance: {
      color: 'blue',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    },
  };

  const worldCards = worldSeesYou.map(([label, value, unit, trend, desc, tabId]) => {
    const isNeg = trend && trend.startsWith('-');
    const isPoor = trend === 'Poor';
    const tabLabel = { seo: 'View SEO details', 'ai-visibility': 'View AI visibility', performance: 'View performance' }[tabId] || '';
    const icon = WORLD_ICONS[tabId] || { color: 'neutral', svg: '' };
    return `
      <button class="ab-world-card ab-world-card-${icon.color}" data-tab="${tabId}" type="button">
        <div class="ab-world-label-row">
          <span class="ab-world-icon ab-world-icon-${icon.color}">${icon.svg}</span>
          <p class="ab-world-label ab-world-label-${icon.color}">${label.toUpperCase()}</p>
        </div>
        <p class="ab-world-value">${value}<span class="ab-world-unit">${unit || ''}</span></p>
        ${isPoor
    ? '<span class="ab-world-poor">Poor</span>'
    : `<p class="ab-world-trend${isNeg ? ' ab-world-trend-neg' : ''}">${isNeg ? '↘ ' : ''}${trend || ''}</p>`}
        <p class="ab-world-desc">${desc || ''}</p>
        ${tabLabel ? `<span class="ab-world-link ab-world-link-${icon.color}">${tabLabel} →</span>` : ''}
      </button>`;
  }).join('');

  const whyCards = whyAdobe.map(([name, pct, desc]) => `
    <div class="ab-why-item">
      <div class="ab-why-pct">${pct}%</div>
      <div>
        <h3 class="ab-why-name">${name}</h3>
        <p class="ab-why-desc">${desc}</p>
      </div>
    </div>`).join('');

  const issueItems = priorityIssues.map(([title, desc, severity]) => `
    <div class="ab-issue ab-issue-${severity === 'high' ? 'red' : 'amber'}">
      <svg class="ab-issue-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div>
        <p class="ab-issue-title">${title}</p>
        <p class="ab-issue-desc">${desc}</p>
      </div>
    </div>`).join('');

  return {
    anchors: ['Executive Summary', 'How World Sees You', 'Why Adobe', 'Priority Issues'],
    html: `
      <section class="ab-section" id="executive-summary">
        ${card(`
          <div class="ab-your-request">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="ab-your-request-label">Your Request</span>
          </div>
          <p class="ab-your-request-text">${yourRequest[0] ? yourRequest[0][0] : ''}</p>
        `)}
        ${card(`
          <div class="ab-exec-overview-head">
            <div class="ab-exec-overview-title-wrap">
              <span class="ab-section-icon ab-section-icon-purple">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>
              </span>
              <h2 class="ab-section-title">Executive Overview</h2>
            </div>
            <span class="ab-ai-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              AI-Generated
            </span>
          </div>
          <p class="ab-exec-overview-text">${execOverview[0] ? execOverview[0][0] : ''}</p>
        `)}
      </section>
      <section class="ab-section" id="how-world-sees-you">
        <div class="ab-section-heading-row">
          <span class="ab-section-icon ab-section-icon-blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </span>
          <h2 class="ab-section-title">How The World Sees You</h2>
        </div>
        <div class="ab-world-grid">${worldCards}</div>
      </section>
      <section class="ab-section" id="why-adobe">
        <div class="ab-why-adobe">
          <div class="ab-why-adobe-head">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <h2 class="ab-why-adobe-title">Why Adobe Can Help</h2>
          </div>
          <p class="ab-why-adobe-sub">Based on the analysis, here are key opportunities where Adobe solutions can drive impact:</p>
          <div class="ab-why-items">${whyCards}</div>
          <button class="ab-why-all-btn" data-tab="solutions" type="button">View All Solutions →</button>
        </div>
      </section>
      <section class="ab-section" id="priority-issues">
        <div class="ab-priority-head">
          <h2 class="ab-section-title">Priority Issues</h2>
          <span class="ab-priority-count">${priorityIssues.length} issues</span>
        </div>
        <div class="ab-issues-list">${issueItems}</div>
      </section>`,
  };
}

// ─── Performance tab ───────────────────────────────────────────
function buildPerformance(perfRows, perfNarrative, perfInsights) {
  const note = perfRows.find(([n]) => n === 'note');
  const ps = perfRows.find(([n]) => n === 'PageSpeed Score') || [];
  const lcpCold = perfRows.find(([n]) => n.includes('cold')) || [];
  const lcpField = perfRows.find(([n]) => n.includes('field')) || [];
  const inp = perfRows.find(([n]) => n === 'INP') || [];
  const cls = perfRows.find(([n]) => n === 'CLS') || [];
  const fcp = perfRows.find(([n]) => n === 'FCP') || [];
  const tbt = perfRows.find(([n]) => n === 'TBT') || [];

  const score = parseInt(ps[1] || '42', 10);
  // eslint-disable-next-line no-nested-ternary
  const gaugeColor = score >= 70 ? '#059669' : score >= 50 ? '#f59e0b' : '#ef4444';
  const gradeMap = {
    90: 'A', 75: 'B', 50: 'C', 25: 'D',
  };
  const grade = Object.entries(gradeMap).find(([t]) => score >= Number(t))?.[1] || 'F';
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  const narrative = perfNarrative[0] ? perfNarrative[0][0]
    : 'Your website\'s 12.4s load time is significantly slower than the 2.5s industry standard. Research shows that 53% of mobile users abandon sites that take longer than 3 seconds to load. This is likely costing you conversions and revenue.';

  const cwvItems = [
    {
      label: 'Time to See Content',
      metric: 'LCP',
      value: lcpCold[1] || '12.4s',
      target: `under ${lcpCold[2] || '2.5s'}`,
      status: lcpCold[3] || 'poor',
      desc: lcpCold[4] || 'Users likely leaving before content loads',
    },
    {
      label: 'Time to Interact',
      metric: 'INP',
      value: inp[1] || '327ms',
      target: `under ${inp[2] || '200ms'}`,
      status: inp[3] || 'needs-work',
      desc: inp[4] || 'Some delay in button and form responsiveness',
    },
    {
      label: 'Visual Stability',
      metric: 'CLS',
      value: cls[1] || '0.00',
      target: `under ${cls[2] || '0.1'}`,
      status: cls[3] || 'good',
      desc: cls[4] || 'Page layout is stable',
    },
  ];

  const cwvIcons = {
    poor: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'needs-work': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A2 2 0 0 1 10 17V7a2 2 0 0 1 1.19-1.84"/></svg>',
    good: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  };

  const cwvRows = cwvItems.map(({
    label, value, target, status, desc,
  }) => {
    const c = cwvStatus(status);
    const isGood = status === 'good';
    const targetIcon = isGood
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    return `
      <div class="ab-cwv-row ab-cwv-row-${c}">
        <div class="ab-cwv-row-left">
          <span class="ab-cwv-row-icon ab-cwv-row-icon-${c}">${cwvIcons[status] || cwvIcons.good}</span>
          <div>
            <p class="ab-cwv-row-label">${label}</p>
            <p class="ab-cwv-row-desc">${desc}</p>
            <p class="ab-cwv-row-target">${targetIcon} Target: ${target}</p>
          </div>
        </div>
        ${status === 'poor' || status === 'needs-work'
    ? `<span class="ab-cwv-row-value ab-cwv-row-value-${c}">${value}</span>`
    : ''}
      </div>`;
  }).join('');

  const insightItems = perfInsights.length
    ? perfInsights.map(([text]) => `<li>${text}</li>`).join('')
    : [
      `Lab LCP of ${lcpCold[1] || '12.4s'} significantly exceeds the 2.5s threshold for 'Good' performance`,
      `Lab FCP of ${fcp[1] || '7.4s'} indicates extremely slow initial paint in synthetic cold-load conditions`,
      `TBT of ${tbt[1] || '617ms'} suggests significant main thread blocking during page load`,
      `Critical gap between lab metrics (LCP ${lcpCold[1] || '12.4s'}) and field metrics (LCP ${lcpField[1] || '1.37s'}) indicates inconsistent user experience or heavy resource loading`,
    ].map((t) => `<li>${t}</li>`).join('');

  const noteHtml = note ? `<div class="ab-note">${note[1]}</div>` : '';
  const domain = lcpCold[4] ? '' : 'wehkamp.nl';

  return {
    anchors: ['Overview', 'Pages Tested', 'Core Web Vitals', 'Issues'],
    html: `
      <section class="ab-section" id="overview">
        ${card(`
          <div class="ab-perf-narrative-head">
            <span class="ab-section-icon ab-section-icon-red">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </span>
            <h2 class="ab-section-title">The Business Impact of Performance</h2>
            <span class="ab-ai-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              AI-Generated
            </span>
          </div>
          <p class="ab-card-desc">${narrative}</p>
        `, 'ab-perf-narrative-card')}
        <div class="ab-perf-overview-row">
          ${card(`
            <p class="ab-perf-gauge-label">OVERALL PERFORMANCE</p>
            <div class="ab-gauge-wrap">
              <svg class="ab-gauge" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="10"/>
                <circle cx="70" cy="70" r="${r}" fill="none" stroke="${gaugeColor}" stroke-width="10"
                  stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}"
                  stroke-dashoffset="${(circ * 0.25).toFixed(1)}"
                  stroke-linecap="round"
                  transform="rotate(-90 70 70)"/>
              </svg>
              <div class="ab-gauge-label">
                <span class="ab-gauge-score" style="color:${gaugeColor}">${score}</span>
                <span class="ab-gauge-grade" style="color:${gaugeColor}">${grade}</span>
              </div>
            </div>
            <span class="ab-world-poor" style="display:inline-block;margin-top:8px">Poor</span>
          `, 'ab-perf-gauge-card')}
          ${card(`
            <div class="ab-pages-analyzed-head">
              <span class="ab-section-icon ab-section-icon-blue">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </span>
              <h3 class="ab-card-title">Pages Analyzed</h3>
            </div>
            <p class="ab-pages-count">1 page</p>
            <div class="ab-page-bullet">
              <span class="ab-page-dot"></span>
              <div>
                <p class="ab-page-name">Homepage</p>
                <p class="ab-page-domain">${domain || 'wehkamp.nl'}</p>
              </div>
            </div>
            <p class="ab-pages-see-more">See detailed breakdown below</p>
          `, 'ab-perf-pages-card')}
        </div>
      </section>
      <section class="ab-section" id="pages-tested">
        <div class="ab-perf-per-page-head">
          <div class="ab-section-heading-row" style="margin-bottom:0">
            <span class="ab-section-icon ab-section-icon-blue">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </span>
            <h2 class="ab-section-title">Performance Per Page</h2>
          </div>
          <span class="ab-priority-count">1 page analyzed</span>
        </div>
        <div class="ab-per-page-item">
          <div class="ab-per-page-info">
            <h3 class="ab-per-page-name">Homepage</h3>
            <a class="ab-per-page-url" href="https://www.wehkamp.nl" target="_blank" rel="noopener">wehkamp.nl ↗</a>
            <div class="ab-per-page-scores">
              <div class="ab-per-page-score-box ab-per-page-score-box-red">
                <p class="ab-per-page-score-label">Performance</p>
                <p class="ab-per-page-score-value">${score}/100</p>
                <p class="ab-per-page-score-status">Poor</p>
              </div>
              <div class="ab-per-page-score-box">
                <p class="ab-per-page-score-label">Grade</p>
                <p class="ab-per-page-score-value" style="color:#ef4444">${grade}</p>
                <p class="ab-per-page-score-status">Poor</p>
              </div>
            </div>
            <div class="ab-note ab-note-red">Poor performance is likely causing high bounce rates. This page needs immediate optimisation to prevent revenue loss.</div>
            ${noteHtml}
          </div>
        </div>
        <div class="ab-per-page-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Average performance score: <strong>${score}</strong>
        </div>
      </section>
      <section class="ab-section" id="core-web-vitals">
        <div class="ab-section-heading-row">
          <span class="ab-section-icon ab-section-icon-blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </span>
          <h2 class="ab-section-title">What This Means For Your Business</h2>
        </div>
        <div class="ab-cwv-rows">${cwvRows}</div>
      </section>
      <section class="ab-section" id="issues">
        ${card(`
          <h3 class="ab-card-title" style="margin-bottom:12px">Additional Insights</h3>
          <ul class="ab-insights-list">${insightItems}</ul>
        `)}
      </section>`,
  };
}

// ─── SEO tab ───────────────────────────────────────────────────
function buildSeo(seo, seoNarrative, seoCountries, keywords, seoKeyInsights) {
  const traffic = seo['Monthly Traffic'] || '1.1M';
  const yoy = seo['YoY Growth'] || '-20.4%';
  const healthScore = parseInt(seo['SEO Health Score'] || '71', 10);
  const branded = parseFloat(seo['Branded Traffic']) || 86;
  const nonBranded = parseFloat(seo['Non-Branded Traffic']) || 14;
  const primaryMarket = seo['Primary Market'] || 'Netherlands';
  const isYoyNeg = yoy.startsWith('-');

  // eslint-disable-next-line no-nested-ternary
  const healthColor = healthScore >= 70 ? '#2563eb' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  // eslint-disable-next-line no-nested-ternary
  const healthLabel = healthScore >= 70 ? 'Good' : healthScore >= 50 ? 'Moderate' : 'Poor';
  // eslint-disable-next-line no-nested-ternary
  const healthGrade = healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 50 ? 'C' : 'D';
  const hR = 48;
  const hCirc = 2 * Math.PI * hR;
  const hFilled = (healthScore / 100) * hCirc;

  const narrative = seoNarrative[0] ? seoNarrative[0][0]
    : `You receive ${traffic} organic visitors monthly (down ${yoy} year over year), but ${branded}% come from branded searches. This means most visitors already know your brand — there's significant opportunity to capture new customers searching for your products and services.`;

  // Traffic chart (CSS-only sparkline approximation using bars)
  const chartMonths = ['May\'25', 'Jul', 'Sep', 'Nov', 'Jan\'26', 'Mar', 'Apr'];
  const chartVals = [100, 97, 92, 87, 80, 58, 77]; // relative heights
  const chartBars = chartMonths.map((m, i) => `
    <div class="ab-chart-col">
      <div class="ab-chart-bar" style="height:${chartVals[i]}%"></div>
      <span class="ab-chart-label">${m}</span>
    </div>`).join('');

  // Countries
  const countryRows = seoCountries.length ? seoCountries : [
    ['Netherlands', '🇳🇱', '1.1M', '98.7', 'primary'],
    ['Belgium', '🇧🇪', '13.1K', '1.2', ''],
    ['United States', '🇺🇸', '2.9K', '0.3', ''],
  ];
  const countryCards = countryRows.map(([name, flag, visits, pct, isPrimary]) => `
    <div class="ab-country-card${isPrimary === 'primary' ? ' ab-country-card-primary' : ''}">
      <div class="ab-country-head">
        <span class="ab-country-flag">${flag}</span>
        <span class="ab-country-name">${name}</span>
        ${isPrimary === 'primary' ? '<span class="ab-country-primary-badge">Primary</span>' : ''}
      </div>
      <div class="ab-country-stats">
        <span class="ab-country-visits">${visits} visits</span>
        <span class="ab-country-pct">${pct}%</span>
      </div>
      <div class="ab-country-bar-track">
        <div class="ab-country-bar${isPrimary === 'primary' ? ' ab-country-bar-primary' : ''}" style="width:${Math.min(parseFloat(pct) * 0.7, 100)}%"></div>
      </div>
    </div>`).join('');

  // Donut chart SVG for branded/non-branded
  const dR = 70;
  const dCirc = 2 * Math.PI * dR;

  // Keywords
  const posColor = (pos) => {
    const n = parseInt(pos, 10);
    if (n <= 3) return 'green';
    if (n <= 10) return 'blue';
    if (n <= 20) return 'amber';
    return 'gray';
  };

  const kwRows = keywords.map(([kw, pos, vol, traffic2, cpc, rationale]) => `
    <div class="ab-kw-row-item">
      <div class="ab-kw-main-row">
        <span class="ab-kw-name">${kw}</span>
        <span class="ab-kw-rank ab-kw-rank-${posColor(pos)}">${pos}</span>
        <span class="ab-kw-vol">${Number((vol || '0').replace(/,/g, '')).toLocaleString()}/mo</span>
        <span class="ab-kw-traffic">${traffic2}</span>
        <span class="ab-kw-cpc">${cpc || '—'}</span>
        <span class="ab-kw-trend">—</span>
      </div>
      ${rationale ? `<p class="ab-kw-rationale-text">${rationale}</p>` : ''}
    </div>`).join('');

  // Key insights
  const insightIcons = {
    red: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    amber: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    green: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  };
  const insightRows = (seoKeyInsights.length ? seoKeyInsights : [
    ['Traffic declining (-20.4% YoY)', 'Declining traffic may indicate competitive pressure or algorithm changes.', 'red'],
    ['High brand dependency (86% branded)', 'Focus on ranking for product-related keywords to reduce reliance on brand awareness.', 'amber'],
  ]).map(([title, desc, color]) => `
    <div class="ab-key-insight ab-key-insight-${color || 'amber'}">
      <span class="ab-key-insight-icon">${insightIcons[color] || insightIcons.amber}</span>
      <div>
        <p class="ab-key-insight-title">${title}</p>
        <p class="ab-key-insight-desc">${desc}</p>
      </div>
    </div>`).join('');

  return {
    anchors: ['Overview', 'Traffic &amp; Score', 'Top Countries', 'Traffic Mix', 'Keywords', 'Key Insights'],
    html: `
      <section class="ab-section" id="overview">
        ${card(`
          <div class="ab-exec-overview-head">
            <div class="ab-exec-overview-title-wrap">
              <span class="ab-section-icon ab-section-icon-purple">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <h2 class="ab-section-title">Your Organic Search Presence</h2>
            </div>
            <span class="ab-ai-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              AI-Generated
            </span>
          </div>
          <p class="ab-exec-overview-text">${narrative}</p>
        `)}
      </section>
      <section class="ab-section" id="traffic-score">
        <div class="ab-seo-traffic-row">
          ${card(`
            <div class="ab-section-heading-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              <h2 class="ab-section-title">Monthly Organic Traffic</h2>
            </div>
            <div class="ab-traffic-hero">
              <span class="ab-traffic-value">${traffic}</span>
              <span class="ab-traffic-unit">visitors/month</span>
              <span class="ab-traffic-yoy${isYoyNeg ? ' ab-traffic-yoy-neg' : ''}">${yoy} YoY</span>
            </div>
            <div class="ab-seo-chart">${chartBars}</div>
            <p class="ab-chart-market">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Primary market: ${primaryMarket}
            </p>
          `, 'ab-seo-chart-card')}
          ${card(`
            <p class="ab-perf-gauge-label">SEO HEALTH SCORE</p>
            <div class="ab-gauge-wrap">
              <svg class="ab-gauge" width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
                <circle cx="65" cy="65" r="${hR}" fill="none" stroke="#e5e7eb" stroke-width="10"/>
                <circle cx="65" cy="65" r="${hR}" fill="none" stroke="${healthColor}" stroke-width="10"
                  stroke-dasharray="${hFilled.toFixed(1)} ${hCirc.toFixed(1)}"
                  stroke-dashoffset="${(hCirc * 0.25).toFixed(1)}"
                  stroke-linecap="round"
                  transform="rotate(-90 65 65)"/>
              </svg>
              <div class="ab-gauge-label">
                <span class="ab-gauge-score" style="color:${healthColor}">${healthScore}</span>
                <span class="ab-gauge-grade" style="color:${healthColor}">${healthGrade}</span>
              </div>
            </div>
            <span class="ab-seo-health-label" style="color:${healthColor};background:${healthScore >= 70 ? '#dbeafe' : '#fef3c7'}">${healthLabel}</span>
            <p class="ab-seo-health-note"><strong>What this score measures:</strong> A composite score based on organic traffic volume, traffic trend (growth/decline), brand vs non-branded traffic mix, and keyword ranking positions. Higher scores indicate stronger organic search presence and growth potential.</p>
          `, 'ab-seo-health-card')}
        </div>
      </section>
      <section class="ab-section" id="top-countries">
        ${card(`
          <div class="ab-section-heading-row">
            <span class="ab-section-icon ab-section-icon-purple">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <h2 class="ab-section-title">Traffic by Country</h2>
          </div>
          <div class="ab-country-grid">${countryCards}</div>
        `)}
      </section>
      <section class="ab-section" id="traffic-mix">
        ${card(`
          <div class="ab-section-heading-row">
            <span class="ab-section-icon ab-section-icon-purple">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <h2 class="ab-section-title">Traffic Mix: The Brand Dependency Factor</h2>
          </div>
          <div class="ab-brand-mix-layout">
            <div class="ab-brand-donut-wrap">
              <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
                <circle cx="90" cy="90" r="${dR}" fill="none" stroke="#7c3aed" stroke-width="22"/>
                <circle cx="90" cy="90" r="${dR}" fill="none" stroke="#10b981" stroke-width="22"
                  stroke-dasharray="${((nonBranded / 100) * dCirc).toFixed(1)} ${dCirc.toFixed(1)}"
                  stroke-dashoffset="${(dCirc * 0.25).toFixed(1)}"
                  transform="rotate(-90 90 90)"/>
              </svg>
              <div class="ab-brand-donut-label">
                <span class="ab-brand-donut-pct">${branded}%</span>
                <span class="ab-brand-donut-sub">Branded</span>
              </div>
            </div>
            <div class="ab-brand-legend">
              <span class="ab-brand-legend-item"><span class="ab-brand-legend-dot" style="background:#7c3aed"></span>Branded</span>
              <span class="ab-brand-legend-item"><span class="ab-brand-legend-dot" style="background:#10b981"></span>Non-Branded</span>
            </div>
            <div class="ab-brand-info-cards">
              <div class="ab-brand-info-card ab-brand-info-branded">
                <div class="ab-brand-info-head">
                  <h3>${branded}% Branded</h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <p>Searches containing your brand name, product names, or trademarks</p>
                <p class="ab-brand-info-example">Examples: "www.wehkamp.nl", your product names, branded terms</p>
              </div>
              <div class="ab-brand-info-card ab-brand-info-nonbranded">
                <div class="ab-brand-info-head">
                  <h3>${nonBranded}% Non-Branded</h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <p>Generic searches for products, services, or topics you cover</p>
                <p class="ab-brand-info-example">These searchers may not know your brand yet — acquisition opportunity</p>
              </div>
            </div>
          </div>
          <div class="ab-brand-risk">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <p class="ab-brand-risk-title">High Brand Dependency Risk</p>
              <p class="ab-brand-risk-text">${seo['Non-Branded Analysis'] || `With ${branded}% of traffic coming from branded searches, your organic presence heavily depends on existing brand awareness. If brand recognition drops, so does your traffic.`}</p>
            </div>
          </div>
        `)}
      </section>
      <section class="ab-section" id="keywords">
        ${card(`
          <div class="ab-kw-opportunities-head">
            <div class="ab-section-heading-row" style="margin-bottom:0">
              <span class="ab-section-icon ab-section-icon-purple">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <h2 class="ab-section-title">Keyword Opportunities</h2>
            </div>
            <span class="ab-priority-count">${keywords.length} keywords</span>
          </div>
          <div class="ab-kw-table-new">
            <div class="ab-kw-table-header">
              <span>KEYWORD</span><span>RANK</span><span>VOLUME</span><span>TRAFFIC</span><span>CPC</span><span>TREND</span>
            </div>
            ${kwRows}
          </div>
          <div class="ab-kw-legend">
            Position:
            <span class="ab-kw-rank ab-kw-rank-green">1-3 Excellent</span>
            <span class="ab-kw-rank ab-kw-rank-blue">4-10 Page 1</span>
            <span class="ab-kw-rank ab-kw-rank-amber">11-20 Page 2</span>
            <span class="ab-kw-rank ab-kw-rank-gray">20+ Opportunity</span>
          </div>
        `)}
      </section>
      <section class="ab-section" id="key-insights">
        ${card(`
          <div class="ab-section-heading-row">
            <span class="ab-section-icon ab-section-icon-purple">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>
            </span>
            <h2 class="ab-section-title">Key Insights</h2>
          </div>
          <div class="ab-key-insights-list">${insightRows}</div>
        `)}
      </section>`,
  };
}

// ─── AI Visibility tab ─────────────────────────────────────────
function buildAiVisibility(ai, competitive, whatAiSees) {
  const engines = [
    ['Google AI Overview', ai['AI Overview Score'], ai['AI Overview Score']],
    ['Google AI Mode', ai['AI Mode Score'], ai['AI Mode Score']],
    ['Gemini', ai['Gemini Score'], ai['Gemini Score']],
    ['ChatGPT', ai['ChatGPT Score'], ai['ChatGPT Score']],
  ].filter(([, v]) => v);

  const engineRows = engines.map(([name, score]) => {
    const n = parseInt(score, 10);
    const color = scoreColor(score);
    return `
      <div class="ab-engine-row">
        <span class="ab-engine-name">${name}</span>
        <div class="ab-engine-bar-wrap">
          <div class="ab-engine-bar ab-engine-bar-${color}" style="width:${n}%"></div>
        </div>
        <span class="ab-engine-score ab-engine-score-${color}">${score}<span class="ab-engine-max">/100</span></span>
      </div>`;
  }).join('');

  const competitorRows = competitive.map(([brand, mentions, citations, score]) => `
    <tr class="${brand === 'Wehkamp' ? 'ab-row-highlight' : ''}">
      <td><strong>${brand}</strong></td>
      <td>${mentions}</td>
      <td>${citations}</td>
      <td>${score}</td>
    </tr>`).join('');

  const strengths = Object.entries(whatAiSees)
    .filter(([k]) => k.startsWith('strength-'))
    .map(([, v]) => `<li class="ab-strength">${v}</li>`).join('');

  const gaps = Object.entries(whatAiSees)
    .filter(([k]) => k.startsWith('gap-'))
    .map(([, v]) => `<li class="ab-gap">${v}</li>`).join('');

  const actions = Object.entries(whatAiSees)
    .filter(([k]) => k.startsWith('action-'))
    .map(([, v], i) => `<div class="ab-action"><span class="ab-action-num">${i + 1}</span><p>${v}</p></div>`).join('');

  const assocChips = (whatAiSees.associations || '').split('·').map((a) => `<span class="ab-assoc-chip">${a.trim()}</span>`).join('');

  return {
    anchors: ['Visibility Score', 'By Engine', 'Competitive Position', 'What AI Sees', 'Recommended Actions'],
    html: `
      ${sectionHtml('visibility-score', 'AI Visibility Score', card(`
        <div class="ab-ai-hero">
          <div class="ab-ai-score-block">
            <p class="ab-ai-score-label">Visibility Score</p>
            <p class="ab-ai-score-value ab-ai-score-${scoreColor(ai['Visibility Score'] || '62')}">${ai['Visibility Score'] || '62'}<span class="ab-ai-score-max">/100</span></p>
            <p class="ab-ai-score-trend">${ai['Visibility Score'] ? (ai['Visibility Score'][3] || '') : '-8 points over 3 months'}</p>
          </div>
          <div class="ab-ai-stats">
            <div class="ab-ai-stat"><p class="ab-ai-stat-value">${ai['Brand Mentions'] || ''}</p><p class="ab-ai-stat-label">Brand Mentions</p></div>
            <div class="ab-ai-stat"><p class="ab-ai-stat-value">${ai.Citations || ''}</p><p class="ab-ai-stat-label">Citations</p></div>
            <div class="ab-ai-stat"><p class="ab-ai-stat-value">${ai['Audience Reach'] || ''}</p><p class="ab-ai-stat-label">Audience Reach</p></div>
          </div>
        </div>`))}
      ${sectionHtml('by-engine', 'Visibility by Engine', card(`<div class="ab-engines">${engineRows}</div>`))}
      ${sectionHtml('competitive-position', 'Competitive Position', card(`
        <div class="ab-competitive-head">
          <div><p class="ab-competitive-label">Brand Rank</p><p class="ab-competitive-big">${ai['Competitive Rank'] || '#2 of 5'}</p></div>
          <div><p class="ab-competitive-label">Wehkamp Share of Voice</p><p class="ab-competitive-big">${ai['Share of Voice'] || '19%'}</p></div>
          <div><p class="ab-competitive-label">Top Brand</p><p class="ab-competitive-big">h&amp;m <span class="ab-competitive-note">80% SoV</span></p></div>
        </div>
        <table class="ab-comp-table">
          <thead><tr><th>Brand</th><th>Mentions</th><th>Citations</th><th>Score</th></tr></thead>
          <tbody>${competitorRows}</tbody>
        </table>`))}
      ${sectionHtml('what-ai-sees', 'What AI Sees About Wehkamp', card(`
        <p class="ab-card-desc">${whatAiSees.summary || ''}</p>
        <div class="ab-assoc-chips">${assocChips}</div>
        <div class="ab-strengths-gaps">
          <div>
            <p class="ab-sg-label ab-sg-label-green">Strengths</p>
            <ul class="ab-sg-list">${strengths}</ul>
          </div>
          <div>
            <p class="ab-sg-label ab-sg-label-red">Growth Opportunities</p>
            <ul class="ab-sg-list">${gaps}</ul>
          </div>
        </div>`))}
      ${sectionHtml('recommended-actions', 'Recommended Actions', `<div class="ab-actions">${actions}</div>`)}`,
  };
}

// ─── Solutions tab ─────────────────────────────────────────────
function buildSolutions(solutions, roadmapResults, success, nextSteps) {
  const solCards = solutions.map(([name, priority, desc, tags, quickWin]) => {
    const tagChips = (tags || '').split('·').map((t) => `<span class="ab-tag">${t.trim()}</span>`).join('');
    return card(`
      <div class="ab-card-head">
        <h3 class="ab-card-title">${name}</h3>
        ${badge(priority)}
      </div>
      <p class="ab-card-desc">${desc}</p>
      ${quickWin ? `<div class="ab-quick-win"><span class="ab-quick-win-label">Quick Win</span><p>${quickWin}</p></div>` : ''}
      <div class="ab-tags">${tagChips}</div>`);
  }).join('');

  const resultItems = roadmapResults.map(([stat, company, product]) => `
    <div class="ab-result-item">
      <p class="ab-result-stat">${stat}</p>
      <p class="ab-result-company">${company} · ${product}</p>
    </div>`).join('');

  const achievements = Object.entries(success)
    .filter(([k]) => k.startsWith('achievement-'))
    .map(([, v]) => `<li>${v}</li>`).join('');

  const successStats = [
    [success['stat1-value'], success['stat1-label']],
    [success['stat2-value'], success['stat2-label']],
    [success['stat3-value'], success['stat3-label']],
    [success['stat4-value'], success['stat4-label']],
  ].filter(([v]) => v).map(([v, l]) => `<div class="ab-success-stat"><p class="ab-success-stat-value">${v}</p><p class="ab-success-stat-label">${l}</p></div>`).join('');

  const stepCards = nextSteps.map(([title, desc]) => card(`
    <h3 class="ab-card-title">${title}</h3>
    <p class="ab-card-desc">${desc}</p>`)).join('');

  return {
    anchors: ['Recommended Solutions', 'What Adobe Customers Achieve', 'Customer Success', 'Next Steps'],
    html: `
      ${sectionHtml('recommended-solutions', 'Recommended Solutions', `<div class="ab-cards-list">${solCards}</div>`)}
      ${roadmapResults.length ? sectionHtml('customer-results', 'What Adobe Customers Are Achieving', card(`<div class="ab-results-row">${resultItems}</div>`)) : ''}
      ${success.company ? sectionHtml('customer-success', `Customer Success: ${success.company}`, card(`
        <div class="ab-success-meta">
          <span class="ab-success-industry">${success.industry || ''}</span>
          <span class="ab-success-solution">${success.solution || ''}</span>
        </div>
        <div class="ab-success-stats">${successStats}</div>
        <p class="ab-card-desc">${success.description || ''}</p>
        ${achievements ? `<ul class="ab-success-achievements">${achievements}</ul>` : ''}
        ${success.relevance ? `<div class="ab-relevance"><p class="ab-relevance-label">Why this matters for ${success.company === 'Maisons du Monde' ? 'Wehkamp' : 'you'}</p><p>${success.relevance}</p></div>` : ''}`)) : ''}
      ${nextSteps.length ? sectionHtml('next-steps', 'Next Steps', `<div class="ab-cards-grid">${stepCards}</div>`) : ''}`,
  };
}

// ─── Layout ────────────────────────────────────────────────────
function renderLayout(meta, tabContent, activeTab) {
  const { anchors, html } = tabContent;
  const links = anchors.map((a) => `<a class="ab-sidebar-link" href="#${a.toLowerCase().replace(/\s+/g, '-')}">${a}</a>`).join('');
  return `
    ${renderTopbar()}
    <div class="ab-page-body">
      ${renderDomainBar(meta)}
      ${renderTabNav(activeTab)}
      <div class="ab-content-wrap">
        <aside class="ab-sidebar">
          <p class="ab-sidebar-heading">On this page</p>
          <nav>${links}</nav>
        </aside>
        <div class="ab-content">${html}</div>
      </div>
    </div>
    <footer class="ab-report-footer">Confidential · Adobe Digital Insights · ${meta.date || ''}</footer>`;
}

// ─── Main ──────────────────────────────────────────────────────
export default async function decorate(block) {
  const section = block.closest('.section');
  const main = block.closest('main');
  [section, main].forEach((el) => {
    if (!el) return;
    el.style.maxWidth = 'none';
    el.style.padding = '0';
    el.style.margin = '0';
  });

  const session = requireAuth();
  if (!session) return;

  block.innerHTML = '<div class="ab-loading"><div class="ab-loading-spinner"></div><p>Loading your report…</p></div>';

  const slug = (session.company || 'wehkamp').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  try {
    const doc = await fetchReport(slug);
    const meta = parseKV(doc, 'aibootcamp-report-meta');
    const yourRequest = parseBlock(doc, 'aibootcamp-report-your-request');
    const execOverview = parseBlock(doc, 'aibootcamp-report-executive-overview');
    const worldSeesYou = parseBlock(doc, 'aibootcamp-report-world-sees-you');
    const whyAdobe = parseBlock(doc, 'aibootcamp-report-why-adobe');
    const priorityIssues = parseBlock(doc, 'aibootcamp-report-priority-issues');
    const perf = parseBlock(doc, 'aibootcamp-report-performance');
    const perfNarrative = parseBlock(doc, 'aibootcamp-report-performance-narrative');
    const perfInsights = parseBlock(doc, 'aibootcamp-report-performance-insights');
    const seo = parseKV(doc, 'aibootcamp-report-seo');
    const seoNarrative = parseBlock(doc, 'aibootcamp-report-seo-narrative');
    const seoCountries = parseBlock(doc, 'aibootcamp-report-seo-countries');
    const keywords = parseBlock(doc, 'aibootcamp-report-seo-keywords');
    const seoKeyInsights = parseBlock(doc, 'aibootcamp-report-seo-key-insights');
    const ai = parseKV(doc, 'aibootcamp-report-ai');
    const aiCompetitive = parseBlock(doc, 'aibootcamp-report-ai-competitive');
    const aiWhatAiSees = parseKV(doc, 'aibootcamp-report-ai-what-ai-sees');
    const solutions = parseBlock(doc, 'aibootcamp-report-solutions');
    const roadmapResults = parseBlock(doc, 'aibootcamp-report-roadmap-results');
    const success = parseKV(doc, 'aibootcamp-report-success');
    const nextSteps = parseBlock(doc, 'aibootcamp-report-next-steps');

    const builders = {
      // eslint-disable-next-line max-len
      overview: () => buildOverview(meta, yourRequest, execOverview, worldSeesYou, whyAdobe, priorityIssues),
      performance: () => buildPerformance(perf, perfNarrative, perfInsights),
      seo: () => buildSeo(seo, seoNarrative, seoCountries, keywords, seoKeyInsights),
      'ai-visibility': () => buildAiVisibility(ai, aiCompetitive, aiWhatAiSees),
      solutions: () => buildSolutions(solutions, roadmapResults, success, nextSteps),
    };

    let activeTab = 'overview';

    const render = () => {
      block.innerHTML = renderLayout(meta, builders[activeTab](), activeTab);

      block.querySelector('.ab-topbar-logout')?.addEventListener('click', () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = LOGIN_PAGE;
      });

      block.querySelectorAll('.ab-tabnav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      block.querySelectorAll('[data-tab]').forEach((btn) => {
        if (btn.classList.contains('ab-tabnav-btn')) return;
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      block.querySelectorAll('.ab-sidebar-link').forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          block.querySelector(link.getAttribute('href'))
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    };

    render();
  } catch (err) {
    block.innerHTML = `<div class="ab-error"><p class="ab-error-title">Report unavailable</p><p class="ab-error-msg">${err.message}</p></div>`;
  }
}
