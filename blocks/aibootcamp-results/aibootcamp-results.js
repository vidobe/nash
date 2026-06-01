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

function cwvStatus(status) {
  if (status === 'good') return 'green';
  if (status === 'needs-work') return 'amber';
  if (status === 'poor') return 'red';
  return 'neutral';
}

// ─── Topbar (Adobe logo + logout — sticky) ─────────────────────
function renderTopbar() {
  return `
    <header class="ab-topbar">
      <div class="ab-topbar-inner">
        <div class="ab-topbar-left">
          <button class="ab-topbar-logo-link" type="button" aria-label="Back to reports">
            <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="ab-topbar-logo" width="80" height="20"/>
          </button>
          <span class="ab-topbar-divider"></span>
          <span class="ab-topbar-title">Digital Insights Report</span>
        </div>
        <div class="ab-user-menu">
          <button class="ab-user-trigger" type="button" aria-label="Account menu">
            <span class="ab-user-avatar" id="ab-topbar-avatar"></span>
            <span class="ab-user-name" id="ab-topbar-name"></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ab-user-dropdown" hidden>
            <div class="ab-user-dropdown-header">
              <span class="ab-user-avatar ab-user-avatar-lg" id="ab-dropdown-avatar"></span>
              <div>
                <p class="ab-user-dropdown-name" id="ab-dropdown-name"></p>
                <p class="ab-user-dropdown-email" id="ab-dropdown-email"></p>
              </div>
            </div>
            <button class="ab-user-signout ab-topbar-logout" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </div>
        </div>
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

// ─── Overview tab ──────────────────────────────────────────────
// eslint-disable-next-line max-params
function buildOverview(meta, yourRequest, execOverview, worldSeesYou, whyAdobe, priorityIssues) {
  const WORLD_ICONS = {
    seo: { color: 'purple', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' },
    'ai-visibility': { color: 'green', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
    performance: { color: 'blue', svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
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
        `, 'ab-exec-overview-card')}
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
      </section>
      <section class="ab-section" id="optimization-opportunity">
        <div class="ab-optim-banner">
          <span class="ab-optim-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <div class="ab-optim-body">
            <h3 class="ab-optim-title">Optimization Opportunity</h3>
            <p class="ab-optim-text">Based on this analysis, we've identified Adobe solutions that could help improve these metrics. Our recommendations are tailored to your specific challenges and business goals.</p>
            <button class="ab-optim-btn" data-tab="solutions" type="button">Explore Adobe Solutions →</button>
          </div>
        </div>
      </section>`,
  };
}

// ─── Performance tab ───────────────────────────────────────────
function buildPerformance(perfRows, perfNarrative, perfInsights, metaDomain, perfPages) {
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

  const noteText = note ? note[1]
    .replace(/\bat Summit( 2026)?\b/gi, 'but requires onboarding')
    .replace(/\bwhile you're here at Summit\b/gi, 'through onboarding') : '';
  const noteHtml = noteText ? `<div class="ab-note">${noteText}</div>` : '';
  const domain = metaDomain || '';

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
            <p class="ab-pages-count">${perfPages.length > 1 ? `${perfPages.length} pages` : '1 page'}</p>
            ${(perfPages.length ? perfPages : [['Homepage', score, domain, 'poor', grade, '']]).map(([pName, , pUrl]) => `
            <div class="ab-page-bullet">
              <span class="ab-page-dot"></span>
              <div>
                <p class="ab-page-name">${pName}</p>
                <p class="ab-page-domain">${pUrl || domain}</p>
              </div>
            </div>`).join('')}
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
          <span class="ab-priority-count">${perfPages.length > 1 ? `${perfPages.length} pages` : '1 page'} analyzed</span>
        </div>
        ${(perfPages.length ? perfPages : [['Homepage', score, domain, 'poor', grade, 'Poor performance is likely causing high bounce rates. This page needs immediate optimisation to prevent revenue loss.']]).map(([pName, pScore, pUrl, pStatus, pGrade, pDesc]) => {
    const pN = parseInt(pScore, 10);
    let pColor = '#ef4444';
    if (pN >= 90) pColor = '#059669';
    else if (pN >= 50) pColor = '#f59e0b';
    let pStatusLabel = 'Poor';
    if (pStatus === 'good') pStatusLabel = 'Good';
    else if (pStatus === 'needs-work') pStatusLabel = 'Needs Work';
    return `
          <div class="ab-per-page-item">
            <div class="ab-per-page-info">
              <h3 class="ab-per-page-name">${pName}</h3>
              <a class="ab-per-page-url" href="https://${pUrl || domain}" target="_blank" rel="noopener">${pUrl || domain} ↗</a>
              <div class="ab-per-page-scores">
                <div class="ab-per-page-score-box${pStatus === 'poor' ? ' ab-per-page-score-box-red' : ''}">
                  <p class="ab-per-page-score-label">Performance</p>
                  <p class="ab-per-page-score-value" style="color:${pColor}">${pScore}/100</p>
                  <p class="ab-per-page-score-status" style="color:${pColor}">${pStatusLabel}</p>
                </div>
                <div class="ab-per-page-score-box">
                  <p class="ab-per-page-score-label">Grade</p>
                  <p class="ab-per-page-score-value" style="color:${pColor}">${pGrade}</p>
                  <p class="ab-per-page-score-status" style="color:${pColor}">${pStatusLabel}</p>
                </div>
              </div>
              ${pDesc ? `<div class="ab-note${pStatus === 'poor' ? ' ab-note-red' : ''}">${pDesc}</div>` : ''}
            </div>
          </div>`;
  }).join('')}
        ${noteHtml ? `<div class="ab-per-page-item" style="padding:0">${noteHtml}</div>` : ''}
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
function buildSeo(seo, seoNarrative, seoCountries, keywords, seoKeyInsights, seoTrafficData) {
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

  // SVG line chart — data from DA block aibootcamp-report-traffic-data
  const svgW = 560;
  const svgH = 240;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const chartInnerW = svgW - padL - padR;
  const chartInnerH = svgH - padT - padB;

  // Parse DA traffic data: rows are [month, value]
  // Fall back to Wehkamp defaults if block not present
  const FALLBACK_TRAFFIC = [
    ["May '25", '1.43'], ["Jun '25", '1.40'], ["Jul '25", '1.37'], ["Aug '25", '1.34'],
    ["Sep '25", '1.30'], ["Oct '25", '1.27'], ["Nov '25", '1.24'], ["Dec '25", '1.21'],
    ["Jan '26", '1.18'], ["Feb '26", '1.15'], ["Mar '26", '0.83'], ["Apr '26", '1.14'],
  ];
  const rawTraffic = seoTrafficData.length ? seoTrafficData : FALLBACK_TRAFFIC;
  const svgData = rawTraffic.map(([, v]) => parseFloat(v) || 0);
  const svgMonths = rawTraffic.map(([m]) => m);
  const maxVal = Math.ceil(Math.max(...svgData) * 10) / 10 + 0.2; // auto-scale + buffer

  // Pick ~6 evenly spaced x-axis labels
  const labelCount = Math.min(6, svgData.length);
  const labelStep = Math.floor((svgData.length - 1) / (labelCount - 1));
  const svgLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = i === labelCount - 1 ? svgData.length - 1 : i * labelStep;
    return [svgMonths[idx], idx];
  });

  const toX = (i) => padL + (i / (svgData.length - 1)) * chartInnerW;
  const toY = (v) => padT + (1 - v / maxVal) * chartInnerH;

  const pts = svgData.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const firstX = toX(0).toFixed(1);
  const lastX = toX(svgData.length - 1).toFixed(1);
  const baseY = (padT + chartInnerH).toFixed(1);

  const linePts = svgData.slice(1).map((v, i) => `L ${toX(i + 1).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `M ${firstX},${toY(svgData[0]).toFixed(1)} ${linePts} L ${lastX},${baseY} L ${firstX},${baseY} Z`;

  const dots = svgData.map((v, i) => `<circle cx="${toX(i).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="3" fill="#7c3aed"/>`).join('');

  // Dynamic y-axis: 4 grid lines from 0 to maxVal
  const yStep = maxVal / 3;
  const yGridVals = [maxVal, maxVal - yStep, maxVal - yStep * 2, 0];
  const yGrid = yGridVals.map((v) => {
    const y = toY(v).toFixed(1);
    const vR = Math.round(v * 10) / 10;
    let label;
    if (vR === 0) label = '0';
    else if (vR >= 1) label = `${vR}M`;
    else label = `${Math.round(vR * 1000)}K`;
    return `<line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="${v === 0 ? '0' : '4,4'}"/>
      <text x="${padL - 6}" y="${(parseFloat(y) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9ca3af" font-family="DM Sans,system-ui,sans-serif">${label}</text>`;
  }).join('');

  const xLabels = svgLabels.map(([label, idx]) => `<text x="${toX(idx).toFixed(1)}" y="${(padT + chartInnerH + 20).toFixed(1)}" text-anchor="middle" font-size="10" fill="#9ca3af" font-family="DM Sans,system-ui,sans-serif">${label}</text>`).join('');

  const trafficChart = `
    <svg class="ab-traffic-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${yGrid}
      <path d="${areaPath}" fill="url(#tg)"/>
      <polyline points="${pts}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;

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
            ${trafficChart}
            <p class="ab-chart-market">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Primary market: ${primaryMarket}
            </p>
          `, 'ab-seo-chart-card')}
          ${card(`
            <p class="ab-perf-gauge-label">SEO HEALTH SCORE</p>
            <div class="ab-seo-gauge-wrap">
              <svg width="130" height="130" viewBox="0 0 130 130" aria-label="SEO health score ${healthScore}">
                <circle cx="65" cy="65" r="${hR}" fill="none" stroke="#e5e7eb" stroke-width="10"/>
                <circle cx="65" cy="65" r="${hR}" fill="none" stroke="${healthColor}" stroke-width="10"
                  stroke-dasharray="${hFilled.toFixed(1)} ${hCirc.toFixed(1)}"
                  stroke-dashoffset="${(hCirc * 0.25).toFixed(1)}"
                  stroke-linecap="round"
                  transform="rotate(-90 65 65)"/>
                <text x="65" y="59" text-anchor="middle" font-size="28" font-weight="800" fill="${healthColor}" font-family="DM Sans,system-ui,sans-serif">${healthScore}</text>
                <text x="65" y="79" text-anchor="middle" font-size="14" font-weight="600" fill="${healthColor}" font-family="DM Sans,system-ui,sans-serif">${healthGrade}</text>
              </svg>
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
                <p class="ab-brand-info-example">Examples: your brand name, product names, branded terms</p>
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
            <span class="ab-kw-legend-label">Position:</span>
            <span class="ab-kw-legend-item ab-kw-legend-green">1-3 Excellent</span>
            <span class="ab-kw-legend-item ab-kw-legend-blue">4-10 Page 1</span>
            <span class="ab-kw-legend-item ab-kw-legend-amber">11-20 Page 2</span>
            <span class="ab-kw-legend-item ab-kw-legend-gray">20+ Opportunity</span>
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
function buildAiVisibility(ai, competitive, whatAiSees, aiTrendData, metaDomain) {
  const visScore = parseInt(ai['Visibility Score'] || '62', 10);
  const mentions = ai['Brand Mentions'] || '22,725';
  const citations = ai.Citations || '17,361';
  const domain = metaDomain || 'your domain';

  // Engine definitions with icons and colors
  const engineDefs = [
    {
      name: 'Google AI Overview',
      desc: 'AI-generated summaries in Google Search',
      score: ai['AI Overview Score'] || '74',
      color: '#2563eb',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      bg: '#dbeafe',
    },
    {
      name: 'Google AI Mode',
      desc: "Google's conversational AI search mode",
      score: ai['AI Mode Score'] || '72',
      color: '#059669',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      bg: '#d1fae5',
    },
    {
      name: 'Gemini',
      desc: "Google's AI assistant",
      score: ai['Gemini Score'] || '61',
      color: '#7c3aed',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      bg: '#ede9fe',
    },
    {
      name: 'ChatGPT',
      desc: "OpenAI's conversational AI assistant",
      score: ai['ChatGPT Score'] || '55',
      color: '#059669',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
      bg: '#d1fae5',
    },
  ];

  const engineCards = engineDefs.map(({
    name, desc, score, color, icon, bg,
  }) => {
    const n = parseInt(score, 10);
    return `
      <div class="ab-engine-card">
        <div class="ab-engine-card-left">
          <span class="ab-engine-card-icon" style="background:${bg};color:${color}">${icon}</span>
          <div>
            <p class="ab-engine-card-name">${name}</p>
            <p class="ab-engine-card-desc">${desc}</p>
          </div>
        </div>
        <div class="ab-engine-card-right">
          <span class="ab-engine-card-score" style="color:${color}">${score}<span class="ab-engine-card-max"> / 100</span></span>
          <div class="ab-engine-card-bar-wrap">
            <div class="ab-engine-card-bar" style="width:${n}%;background:${color}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Competitive bar chart
  const compData = competitive.length ? competitive : [];
  const compBars = compData.map(([brand, , , score]) => {
    const n = parseInt(score, 10) || 0;
    const isYou = metaDomain && brand.toLowerCase().includes(metaDomain.replace('www.', '').split('.')[0]);
    return `
      <div class="ab-comp-bar-row">
        <span class="ab-comp-bar-brand${isYou ? ' ab-comp-bar-you' : ''}">${brand}${isYou ? ' (you)' : ''}</span>
        <div class="ab-comp-bar-track">
          <div class="ab-comp-bar-fill${isYou ? ' ab-comp-bar-fill-you' : ''}" style="width:${n}%"></div>
        </div>
        <span class="ab-comp-bar-score">${n}.0</span>
      </div>`;
  }).join('');

  // SVG trend chart — reads from DA block aibootcamp-report-ai-trend-data
  // Fallback: Wehkamp 70→62 decline Feb-May 2026
  const FALLBACK_AI_TREND = [
    ['26-02', '70'], ['26-03', '68'], ['26-04', '65'], ['26-05', '62'],
  ];
  const rawAiTrend = aiTrendData.length ? aiTrendData : FALLBACK_AI_TREND;
  const aiTrendPoints = rawAiTrend.map(([label, v]) => ({ label, val: parseFloat(v) || 0 }));

  const tsvgW = 560; const tsvgH = 180;
  const tpadL = 40; const tpadR = 16; const tpadT = 12; const tpadB = 36;
  const tInnerW = tsvgW - tpadL - tpadR;
  const tInnerH = tsvgH - tpadT - tpadB;
  const tMax = 100;
  const ttoX = (i) => tpadL + (i / (aiTrendPoints.length - 1)) * tInnerW;
  const ttoY = (v) => tpadT + (1 - v / tMax) * tInnerH;

  const tPts = aiTrendPoints.map((p, i) => `${ttoX(i).toFixed(1)},${ttoY(p.val).toFixed(1)}`).join(' ');
  const tfX = ttoX(0).toFixed(1);
  const tlX = ttoX(aiTrendPoints.length - 1).toFixed(1);
  const tbY = (tpadT + tInnerH).toFixed(1);
  const tLinePts = aiTrendPoints.slice(1).map((p, i) => `L ${ttoX(i + 1).toFixed(1)},${ttoY(p.val).toFixed(1)}`).join(' ');
  const tAreaPath = `M ${tfX},${ttoY(aiTrendPoints[0].val).toFixed(1)} ${tLinePts} L ${tlX},${tbY} L ${tfX},${tbY} Z`;
  const tDots = aiTrendPoints.map((p, i) => `<circle cx="${ttoX(i).toFixed(1)}" cy="${ttoY(p.val).toFixed(1)}" r="4" fill="#10b981" stroke="#fff" stroke-width="2"/>`).join('');

  const tYGrid = [100, 75, 50, 25, 0].map((v) => {
    const y = ttoY(v).toFixed(1);
    return `<line x1="${tpadL}" y1="${y}" x2="${tsvgW - tpadR}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="${v === 0 ? '0' : '4,4'}"/>
      <text x="${tpadL - 6}" y="${(parseFloat(y) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9ca3af" font-family="DM Sans,system-ui,sans-serif">${v}</text>`;
  }).join('');

  // Pick labels evenly — show at most 6
  const tLabelStep = Math.max(1, Math.floor((aiTrendPoints.length - 1) / 5));
  const tXLabels = aiTrendPoints
    .filter((_, i) => i % tLabelStep === 0 || i === aiTrendPoints.length - 1)
    .map((p) => {
      const origIdx = aiTrendPoints.indexOf(p);
      return `<text x="${ttoX(origIdx).toFixed(1)}" y="${(tpadT + tInnerH + 20).toFixed(1)}" text-anchor="middle" font-size="10" fill="#9ca3af" font-family="DM Sans,system-ui,sans-serif">${p.label}</text>`;
    }).join('');

  const trendChart = `
    <svg class="ab-ai-trend-svg" viewBox="0 0 ${tsvgW} ${tsvgH}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="aitg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${tYGrid}
      <path d="${tAreaPath}" fill="url(#aitg)"/>
      <polyline points="${tPts}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${tDots}
      ${tXLabels}
    </svg>`;

  // Why it matters items
  const whyItems = [
    { icon: '📊', stat: '800% growth in LLM referral traffic', desc: 'AI-powered search is the fastest-growing traffic source for many brands.' },
    { icon: '🎯', stat: '3-5x higher conversion rates', desc: 'Users arriving from AI search have higher intent and are more likely to convert.' },
    { icon: '👥', stat: '40% of Gen Z prefers AI search', desc: 'Younger demographics are increasingly using AI tools as their primary search method.' },
    { icon: '⭐', stat: '50% market share projected by 2026', desc: 'AI search is expected to capture half of all search traffic within 2 years.' },
  ].map(({ icon, stat, desc }) => `
    <div class="ab-why-matters-item">
      <span class="ab-why-matters-icon">${icon}</span>
      <div>
        <p class="ab-why-matters-stat">${stat}</p>
        <p class="ab-why-matters-desc">${desc}</p>
      </div>
    </div>`).join('');

  const actions = Object.entries(whatAiSees)
    .filter(([k]) => k.startsWith('action-'))
    .map(([, v], i) => `
      <div class="ab-action">
        <span class="ab-action-num">${i + 1}</span>
        <p>${v}</p>
      </div>`).join('');

  return {
    anchors: ['Overview', 'Total Citations', 'Trend', 'By Platform', 'Brands Cited', 'Why It Matters'],
    html: `
      <section class="ab-section" id="overview">
        <div class="ab-ai-overview-card">
          <div class="ab-ai-overview-head">
            <span class="ab-section-icon ab-section-icon-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            <h2 class="ab-section-title">${domain} in AI-Powered Search</h2>
            <span class="ab-ai-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              AI-Generated
            </span>
          </div>
          <p class="ab-card-desc">Adobe LLM Optimizer tracks how often ${domain} appears in answers from ChatGPT, Gemini, Google AI Overview/Mode, Perplexity, and Copilot — and where competitors win answers your brand is missing from.</p>
        </div>
        ${card(`
          <div class="ab-what-ai-sees-head">
            <span class="ab-what-ai-icon">👁</span>
            <h3 class="ab-card-title">What AI Sees About ${domain}</h3>
          </div>
          <p class="ab-card-desc">${whatAiSees.summary || `Based on AI visibility data, <strong>${domain}</strong> is most frequently associated with various industry topics. The brand appears in 4 of 6 tracked AI engines with strongest presence on Google AI Overview. Key competitors include bol.com, zalando, de bijenkorf.`}</p>
        `)}
      </section>
      <section class="ab-section" id="total-citations">
        ${card(`
          <div class="ab-vis-score-layout">
            <div class="ab-vis-score-left">
              <p class="ab-vis-score-label">VISIBILITY SCORE</p>
              <p class="ab-vis-score-value" style="color:#059669">${visScore}<span class="ab-vis-score-max"> / 100</span></p>
              <p class="ab-vis-score-sub">Average prominence of ${domain} across tracked AI prompts.</p>
            </div>
            <div class="ab-vis-score-right">
              <div class="ab-vis-stat">
                <p class="ab-vis-stat-label">MENTIONS</p>
                <p class="ab-vis-stat-value">${mentions.replace(',', '.').replace(/(\d+),(\d+)/, '$1.$2')}</p>
              </div>
              <div class="ab-vis-stat">
                <p class="ab-vis-stat-label">CITATIONS</p>
                <p class="ab-vis-stat-value">${citations.replace(',', '.').replace(/(\d+),(\d+)/, '$1.$2')}</p>
              </div>
            </div>
          </div>
        `)}
      </section>
      <section class="ab-section" id="trend">
        ${card(`
          <div class="ab-section-heading-row">
            <span class="ab-section-icon ab-section-icon-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
            </span>
            <h2 class="ab-section-title">Visibility Trend</h2>
          </div>
          <p class="ab-section-sub">Aggregate monthly visibility score for ${domain} across all tracked AI engines (not per-engine breakdown)</p>
          <div class="ab-ai-trend-chart">
            ${trendChart}
          </div>
        `)}
      </section>
      <section class="ab-section" id="by-platform">
        <h2 class="ab-section-title" style="margin-bottom:12px">Visibility by Engine</h2>
        <div class="ab-engine-cards">${engineCards}</div>
      </section>
      <section class="ab-section" id="brands-cited">
        ${card(`
          <h2 class="ab-section-title">Brands Cited Alongside You</h2>
          <p class="ab-section-sub">Visibility score comparison across brands AI engines mention in similar contexts</p>
          <div class="ab-comp-bars">${compBars}</div>
        `)}
      </section>
      <section class="ab-section" id="why-it-matters">
        ${card(`
          <div class="ab-section-heading-row">
            <span class="ab-section-icon ab-section-icon-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            </span>
            <h2 class="ab-section-title">Why AI Visibility Matters</h2>
          </div>
          <div class="ab-why-matters-list">${whyItems}</div>
        `)}
        <div class="ab-ai-oppty-card">
          <div class="ab-ai-oppty-head">
            <span class="ab-section-icon ab-section-icon-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            <h3 class="ab-card-title">Optimization Opportunity</h3>
          </div>
          <p class="ab-card-desc">Adobe LLM Optimizer can close the gaps surfaced above by optimizing content for AI answer engines and tracking visibility week over week.</p>
          ${actions ? `<div class="ab-actions" style="margin-top:16px">${actions}</div>` : ''}
          <button class="ab-ai-oppty-btn" data-tab="solutions" type="button">Explore Adobe Solutions →</button>
        </div>
        ${card(`
          <div class="ab-about-data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p><strong>About This Data</strong> AI visibility metrics are powered by Adobe LLM Optimizer, which tracks brand appearances across major AI answer engines (ChatGPT, Gemini, Google AI Overview/Mode, Perplexity, Copilot) and identifies queries where competitors win.</p>
          </div>
        `)}
      </section>`,
  };
}

// ─── Solutions tab ─────────────────────────────────────────────
function miniGauge(score, color) {
  const n = parseInt(score, 10);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const filled = (n / 100) * circ;
  return `
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="5"/>
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="5"
        stroke-dasharray="${filled.toFixed(1)} ${circ.toFixed(1)}"
        stroke-dashoffset="${(circ * 0.25).toFixed(1)}"
        stroke-linecap="round"
        transform="rotate(-90 26 26)"/>
      <text x="26" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="${color}">${n}</text>
    </svg>`;
}

function buildSolutions(solutions, roadmapResults, success) {
  // All solutions — DA data takes priority, fallbacks for missing ones
  const defaultSolutions = [
    ['Adobe Commerce Optimizer', '90', 'Transform Wehkamp\'s 12.4s cold-load LCP into a 100 Lighthouse storefront and unlock 30-45% conversion uplift for new visitors. Deloitte research correlates 5x cold-load LCP improvement with 30-45% conversion lift. Delivers 100 Lighthouse storefront powered by Edge Delivery without requiring platform migration.'],
    ['AEM Sites with Edge Delivery Services', '90', 'Deliver 100 Lighthouse scores and eliminate the 12.4s cold-load LCP gap that\'s silently suppressing new-customer conversion. Performance-first architecture productizes speed with built-in phased content rendering, automated performance testing on every change, and pro-active monitoring to maintain green Core Web Vitals at scale.'],
    ['Adobe Sites Optimizer', '80', 'Reverse Wehkamp\'s 20.4% organic traffic decline through automated AI-driven optimization across performance, SEO, and engagement. Sites Optimizer\'s identify-suggest-fix framework enables one-click implementation of fixes. For Wehkamp\'s 1.1M monthly visits, reversing 50% of decline equals 145K recovered visits/month.'],
    ['Adobe LLM Optimizer', '80', 'Reverse Wehkamp\'s 8-point AI visibility decline (70→62) and capture AI-driven discovery before bol.com and Zalando dominate the channel. Wehkamp has a strong AI foundation (8.1M audience, 17K citations) but is bleeding visibility. LLM Optimizer provides prescriptive automated recommendations to reverse the decline.'],
    ['Adobe Journey Optimizer', '80', 'Orchestrate cart abandonment and lifecycle journeys to recapture revenue from declining traffic and convert acquisition into retention. With 20% traffic decline and 86% branded dependency, every visitor interaction must deliver maximum value. Journey Optimizer enables real-time decisioning and cross-channel orchestration.'],
    ['Adobe GenStudio', '80', 'Scale campaign content velocity to capture the 14% non-branded growth opportunity and address 20.4% organic decline. Wehkamp ranks well for competitor brand terms but struggles to capture generic product demand — a content production capacity issue. GenStudio enables content generation in hours instead of weeks.'],
    ['Adobe Workfront', '80', 'Orchestrate execution of performance, SEO, and content initiatives to ship optimization at the pace required to reverse 20.4% decline. Wehkamp\'s optimization opportunities require coordinated execution across marketing, development, and content teams. Workfront provides operational backbone for faster execution velocity.'],
    ['Adobe Customer Journey Analytics', '70', 'Expose attribution blind spots behind Wehkamp\'s 86% branded dependency and 20.4% traffic decline through unified journey measurement. Wehkamp\'s strong rankings for competitor brand terms signal cross-shopping behavior, but channel-by-channel reporting prevents prioritizing which channels convert.'],
    ['Adobe Real-Time CDP', '70', 'Unify customer data across 1.1M monthly visitors to activate retention and reduce 86% branded dependency. With 20% traffic decline and €323K monthly traffic value at stake, Real-Time CDP enables precision audience activation: win-back campaigns, category affinity targeting, lookalike modeling.'],
    ['Adobe Mix Modeler', '70', 'Guide budget allocation decisions to address 20.4% traffic decline and €323K monthly traffic value at stake. With declining traffic and high-value organic at stake, marketing investment decisions need stronger confidence. Mix Modeler combines tactical attribution with strategic MMM.'],
  ];

  // Merge DA solutions with defaults
  const solData = defaultSolutions.map(([defName, defScore, defDesc]) => {
    const found = solutions.find(([n]) => n.toLowerCase().includes(defName.toLowerCase().split(' ')[1] || defName));
    return found
      ? [defName, defScore, found[2] || defDesc]
      : [defName, defScore, defDesc];
  });

  const scoreToColor = (s) => {
    const n = parseInt(s, 10);
    if (n >= 85) return '#d97706';
    if (n >= 70) return '#2563eb';
    return '#6b7280';
  };

  const solGrid = solData.map(([name, score]) => {
    const color = scoreToColor(score);
    const isTop = parseInt(score, 10) >= 85;
    return `
      <div class="ab-sol-card${isTop ? ' ab-sol-card-top' : ''}">
        <div class="ab-sol-gauge">${miniGauge(score, color)}</div>
        <h3 class="ab-sol-name">${name}</h3>
        <p class="ab-sol-desc">${solData.find(([n]) => n === name)?.[2] || ''}</p>
      </div>`;
  }).join('');

  // Success story
  const company = success.company || 'Maisons du Monde';
  const relevance = 87;
  const relevColor = '#2563eb';
  const achievements = Object.entries(success)
    .filter(([k]) => k.startsWith('achievement-'))
    .map(([, v]) => `<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${v}</li>`).join('');

  // Executive summary challenge/solution
  const challengePoints = [
    'Catastrophic cold-load performance (42/100 score, 12.4s lab LCP) destroys conversion for first-time visitors and paid acquisition traffic',
    '20.4% organic traffic decline over 12 months erodes 290K monthly visits (~€65K/month traffic value)',
    'AI visibility declining 8 points in 3 months (70→62) while bol.com and Zalando optimize their AI presence',
  ];
  const solutionPoints = [
    {
      text: 'Adobe Commerce Optimizer + Edge Delivery Services deliver 100 Lighthouse storefront to unlock 30-45% conversion uplift for new visitors (Deloitte research)', chip: 'Adobe Commerce Optimizer', score: '90', color: '#d97706',
    },
    {
      text: 'Adobe Sites Optimizer reverses organic decline through automated AI-driven SEO and performance optimization (comparable deployments: PGA Tour +19% CWV, BambooHR +4% traffic in <1 hour)', chip: 'Adobe Sites Optimizer', score: '80', color: '#2563eb',
    },
    {
      text: 'Adobe LLM Optimizer defends and grows AI visibility across ChatGPT, Gemini, Google AI platforms to capture 4,700% AI-driven shopping traffic growth', chip: 'Adobe LLM Optimizer', score: '80', color: '#2563eb',
    },
  ];
  const topSolChips = [
    { label: 'Commerce Optimizer', score: '90', color: '#d97706' },
    { label: 'Edge Delivery', score: '90', color: '#d97706' },
    { label: 'Sites Optimizer', score: '80', color: '#2563eb' },
  ].map(({ label, score, color }) => `<span class="ab-exec-chip" style="border-color:${color};color:${color}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${label} (${score})</span>`).join('');

  const fitDots = Array.from({ length: 7 }, (_, i) => `<span class="ab-fit-dot${i < 4 ? ' ab-fit-dot-on' : ''}"></span>`).join('');
  const impactDots = Array.from({ length: 7 }, (_, i) => `<span class="ab-impact-dot${i < 6 ? ' ab-impact-dot-on' : ''}"></span>`).join('');

  return {
    anchors: ['Success Story', 'Recommended Solutions', 'Executive Summary'],
    html: `
      <section class="ab-section" id="success-story">
        ${card(`
          <div class="ab-story-head">
            <div class="ab-section-heading-row" style="margin-bottom:0">
              <span class="ab-section-icon ab-section-icon-blue">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </span>
              <h2 class="ab-section-title">Recommended Success Story</h2>
            </div>
            <span class="ab-ai-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              AI-Generated
            </span>
          </div>
          <div class="ab-story-layout">
            <div class="ab-story-body">
              <h3 class="ab-story-company">${company}</h3>
              <div class="ab-story-relevance-text">
                <p class="ab-story-relevance-label">Why This Story Is Relevant</p>
                <p class="ab-story-relevance-desc">${success.relevance || 'As a European e-commerce retailer facing performance challenges (42/100 score, 12.4s LCP) and 20% traffic decline, Maisons du Monde demonstrates what\'s achievable with Adobe Commerce.'}</p>
              </div>
              <p class="ab-story-results-label"><strong>Key Results:</strong></p>
              <ul class="ab-story-results">${achievements || '<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>29% of sales are made online and 52% include a digital component</li><li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Expanded product catalog by 200,000 products through the Marketplace</li><li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Handled close to 300 million website visits in 2022, with 73% on mobile devices</li><li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>32% of online purchases are delivered to stores, improving cross-channel engagement</li>'}</ul>
              <a class="ab-story-link" href="#" target="_blank" rel="noopener">View Full Story ↗</a>
            </div>
            <div class="ab-story-gauge">
              <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="8"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="${relevColor}" stroke-width="8"
                  stroke-dasharray="${((relevance / 100) * 2 * Math.PI * 40).toFixed(1)} ${(2 * Math.PI * 40).toFixed(1)}"
                  stroke-dashoffset="${(2 * Math.PI * 40 * 0.25).toFixed(1)}"
                  stroke-linecap="round"
                  transform="rotate(-90 50 50)"/>
                <text x="50" y="54" text-anchor="middle" font-size="22" font-weight="800" fill="${relevColor}">${relevance}</text>
              </svg>
              <p class="ab-story-gauge-label">Relevance</p>
            </div>
          </div>
        `)}
      </section>
      <section class="ab-section" id="recommended-solutions">
        <div class="ab-sol-head">
          <div class="ab-section-heading-row" style="margin-bottom:0">
            <span class="ab-section-icon ab-section-icon-amber">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </span>
            <h2 class="ab-section-title">Recommended Adobe Solutions</h2>
          </div>
          <p class="ab-sol-sub">Products assessed based on the customer's specific needs</p>
        </div>
        <div class="ab-sol-grid">${solGrid}</div>
      </section>
      <section class="ab-section" id="executive-summary">
        <div class="ab-section-heading-row">
          <span class="ab-section-icon ab-section-icon-amber">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </span>
          <h2 class="ab-section-title">Executive Summary</h2>
        </div>
        <p class="ab-section-sub" style="margin-bottom:12px">Key challenges identified and recommended approach</p>
        <div class="ab-exec-two-col">
          <div class="ab-exec-challenge">
            <div class="ab-exec-col-head">
              <span class="ab-exec-col-icon ab-exec-col-icon-red">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <span class="ab-exec-col-title">The Challenge</span>
              <span class="ab-exec-impact-badge">High Impact</span>
            </div>
            <div class="ab-exec-badges">
              <span class="ab-exec-data-badge ab-exec-data-badge-red">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Performance: 42/100
              </span>
              <span class="ab-exec-data-badge ab-exec-data-badge-amber">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>
                4 Critical Issues
              </span>
              <span class="ab-exec-data-badge ab-exec-data-badge-amber">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                22,725 AI Mentions (Adobe LLM Optimizer)
              </span>
            </div>
            <div class="ab-exec-points">
              ${challengePoints.map((p) => `<div class="ab-exec-point ab-exec-point-red"><span class="ab-exec-point-dot"></span><p>${p}</p></div>`).join('')}
            </div>
            <div class="ab-exec-bar-row">
              <span class="ab-exec-bar-label">Business Impact</span>
              <span class="ab-exec-dots">${impactDots}</span>
            </div>
          </div>
          <div class="ab-exec-solution">
            <div class="ab-exec-col-head">
              <span class="ab-exec-col-icon ab-exec-col-icon-green">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </span>
              <span class="ab-exec-col-title">The Solution</span>
              <span class="ab-exec-products-badge">10 Products</span>
            </div>
            <div class="ab-exec-chips">${topSolChips}</div>
            <div class="ab-exec-points">
              ${solutionPoints.map(({
    text, chip, score, color,
  }) => `
                <div class="ab-exec-sol-point">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <p>${text}</p>
                    <span class="ab-exec-sol-chip" style="border-color:${color};color:${color}">${chip} Score: ${score}</span>
                  </div>
                </div>`).join('')}
            </div>
            <div class="ab-exec-bar-row">
              <span class="ab-exec-bar-label">Solution Fit</span>
              <span class="ab-exec-dots">${fitDots}</span>
              <span class="ab-exec-fit-label">Strong Fit</span>
            </div>
          </div>
        </div>
      </section>`,
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

  // URL param ?company=slug takes priority (used from companies overview page)
  const urlParam = new URLSearchParams(window.location.search).get('company');
  const rawSlug = urlParam || session.company || 'wehkamp';
  const slug = rawSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  try {
    const doc = await fetchReport(slug);
    const meta = parseKV(doc, 'aibootcamp-report-meta');
    const yourRequest = parseBlock(doc, 'aibootcamp-report-your-request');
    const execOverview = parseBlock(doc, 'aibootcamp-report-executive-overview');
    const worldSeesYou = parseBlock(doc, 'aibootcamp-report-world-sees-you');
    const whyAdobe = parseBlock(doc, 'aibootcamp-report-why-adobe');
    const priorityIssues = parseBlock(doc, 'aibootcamp-report-priority-issues');
    const perf = parseBlock(doc, 'aibootcamp-report-performance');
    const perfPages = parseBlock(doc, 'aibootcamp-report-performance-pages');
    const perfNarrative = parseBlock(doc, 'aibootcamp-report-performance-narrative');
    const perfInsights = parseBlock(doc, 'aibootcamp-report-performance-insights');
    const seo = parseKV(doc, 'aibootcamp-report-seo');
    const seoNarrative = parseBlock(doc, 'aibootcamp-report-seo-narrative');
    const seoCountries = parseBlock(doc, 'aibootcamp-report-seo-countries');
    const keywords = parseBlock(doc, 'aibootcamp-report-seo-keywords');
    const seoKeyInsights = parseBlock(doc, 'aibootcamp-report-seo-key-insights');
    const seoTrafficData = parseBlock(doc, 'aibootcamp-report-traffic-data');
    const ai = parseKV(doc, 'aibootcamp-report-ai');
    const aiCompetitive = parseBlock(doc, 'aibootcamp-report-ai-competitive');
    const aiWhatAiSees = parseKV(doc, 'aibootcamp-report-ai-what-ai-sees');
    const aiTrendData = parseBlock(doc, 'aibootcamp-report-ai-trend-data');
    const solutions = parseBlock(doc, 'aibootcamp-report-solutions');
    const roadmapResults = parseBlock(doc, 'aibootcamp-report-roadmap-results');
    const success = parseKV(doc, 'aibootcamp-report-success');
    const nextSteps = parseBlock(doc, 'aibootcamp-report-next-steps');

    const builders = {
      // eslint-disable-next-line max-len
      overview: () => buildOverview(meta, yourRequest, execOverview, worldSeesYou, whyAdobe, priorityIssues),
      // eslint-disable-next-line max-len
      performance: () => buildPerformance(perf, perfNarrative, perfInsights, meta.domain, perfPages),
      // eslint-disable-next-line max-len
      seo: () => buildSeo(seo, seoNarrative, seoCountries, keywords, seoKeyInsights, seoTrafficData),
      'ai-visibility': () => buildAiVisibility(ai, aiCompetitive, aiWhatAiSees, aiTrendData, meta.domain),
      solutions: () => buildSolutions(solutions, roadmapResults, success, nextSteps),
    };

    let activeTab = 'overview';

    const render = () => {
      block.innerHTML = renderLayout(meta, builders[activeTab](), activeTab);

      // Populate user avatar
      const nameParts = session.name ? session.name.trim().split(/\s+/) : [];
      const abbr = nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : (session.name || session.email || 'U').slice(0, 2).toUpperCase();
      block.querySelector('.ab-topbar-logo-link')?.addEventListener('click', () => {
        window.location.href = '/aibootcamp/listcompanies';
      });

      block.querySelectorAll('.ab-user-avatar').forEach((el) => { el.textContent = abbr; });
      block.querySelectorAll('.ab-user-name').forEach((el) => {
        el.textContent = session.name || session.email || '';
      });
      if (block.querySelector('#ab-dropdown-email')) {
        block.querySelector('#ab-dropdown-email').textContent = session.email || '';
        block.querySelector('#ab-dropdown-name').textContent = session.name || '';
        block.querySelector('#ab-dropdown-avatar').textContent = abbr;
      }

      // User dropdown toggle
      const trigger = block.querySelector('.ab-user-trigger');
      const dropdown = block.querySelector('.ab-user-dropdown');
      if (trigger && dropdown) {
        trigger.addEventListener('click', () => {
          dropdown.hidden = !dropdown.hidden;
        });
        document.addEventListener('click', (e) => {
          if (!block.querySelector('.ab-user-menu')?.contains(e.target)) dropdown.hidden = true;
        }, { once: false });
      }

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
