/**
 * aibootcamp-results block
 * Auth-gated brand visibility dashboard.
 * Fetches /aibootcamp/reports/{company}.plain.html, parses structured
 * sections, and renders a tabbed report with sidebar navigation.
 */

const LOGIN_PAGE = '/aibootcamp/';
const REPORTS_BASE = '/aibootcamp/reports/';
const SESSION_KEY = 'aibootcamp-auth';

function requireAuth() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const session = auth && Date.now() < auth.expires ? auth : null;
    if (!session) { window.location.href = LOGIN_PAGE; return null; }
    return session;
  } catch {
    window.location.href = LOGIN_PAGE;
    return null;
  }
}

async function fetchReport(slug) {
  const resp = await fetch(`${REPORTS_BASE}${slug}.plain.html`);
  if (!resp.ok) throw new Error(`Report not found: ${slug}`);
  return new DOMParser().parseFromString(await resp.text(), 'text/html');
}

function parseBlock(doc, name) {
  const el = doc.querySelector(`.${name}`);
  if (!el) return [];
  return [...el.querySelectorAll(':scope > div')].map((row) => [...row.querySelectorAll(':scope > div')].map((c) => c.textContent.trim()));
}

function parseKV(doc, name) {
  return Object.fromEntries(parseBlock(doc, name).map(([k, v]) => [k, v]));
}

function scoreColor(val, max) {
  if (!max || !val) return 'neutral';
  const pct = (parseFloat(val) / parseFloat(max)) * 100;
  if (pct >= 70) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function pageScoreColor(n) {
  if (n >= 90) return 'green';
  if (n >= 50) return 'amber';
  return 'red';
}

function badge(priority) {
  const map = { high: 'red', medium: 'amber', low: 'gray' };
  const color = map[priority] || 'gray';
  const label = priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : '';
  return `<span class="ab-badge ab-badge-${color}">${label} Priority</span>`;
}

// ─── Topbar ────────────────────────────────────────────────────
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
    </header>
  `;
}

// ─── Tab definitions ───────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'seo', label: 'SEO' },
  { id: 'ai-visibility', label: 'AI Visibility' },
  { id: 'solutions', label: 'Solutions' },
];

function renderTabNav(activeTab) {
  return `
    <nav class="ab-tabnav" aria-label="Report sections">
      <div class="ab-tabnav-inner">
        ${TABS.map((t) => `
          <button class="ab-tabnav-btn${t.id === activeTab ? ' ab-tabnav-btn-active' : ''}"
            data-tab="${t.id}" type="button">${t.label}</button>
        `).join('')}
      </div>
    </nav>
  `;
}

// ─── Tab content builders ──────────────────────────────────────
function buildOverview(meta, scores, opps) {
  const anchors = ['Summary', 'Key Scores', 'Opportunities'];
  const scoreCards = scores.map(([label, value, max, desc]) => {
    const color = scoreColor(value, max);
    return `
      <div class="ab-score-card ab-score-card-${color}">
        <p class="ab-score-card-label">${label}</p>
        <p class="ab-score-card-value">${value}${max ? `<span class="ab-score-card-max"> /${max}</span>` : ''}</p>
        <p class="ab-score-card-desc">${desc}</p>
      </div>`;
  }).join('');

  const oppCards = opps.map(([title, desc, priority]) => `
    <div class="ab-card">
      <div class="ab-card-head">
        <h3 class="ab-card-title">${title}</h3>
        ${badge(priority)}
      </div>
      <p class="ab-card-desc">${desc}</p>
    </div>`).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="summary">
        <div class="ab-section-intro">
          <h2 class="ab-section-title">About ${meta.company || 'your company'}</h2>
          <p class="ab-section-desc">${meta.summary || ''}</p>
        </div>
      </section>
      <section class="ab-section" id="key-scores">
        <h2 class="ab-section-title">Key Scores</h2>
        <div class="ab-scores-grid">${scoreCards}</div>
      </section>
      <section class="ab-section" id="opportunities">
        <h2 class="ab-section-title">Platform Opportunities</h2>
        <div class="ab-cards-grid">${oppCards}</div>
      </section>
    `,
  };
}

function buildPerformance(pages) {
  const anchors = pages.map(([name]) => name);
  const cards = pages.map(([name, score, load, interact, desc]) => {
    const n = parseInt(score, 10);
    const color = pageScoreColor(n);
    return `
      <div class="ab-card" id="${name.toLowerCase().replace(/\s+/g, '-')}">
        <div class="ab-perf-card-head">
          <div>
            <h3 class="ab-card-title">${name}</h3>
            <div class="ab-perf-stats">
              ${load ? `<span class="ab-stat-chip">${load} load</span>` : ''}
              ${interact ? `<span class="ab-stat-chip">${interact} interact</span>` : ''}
            </div>
          </div>
          <div class="ab-perf-score ab-perf-score-${color}">
            ${score}<span class="ab-perf-score-max">/100</span>
          </div>
        </div>
        <div class="ab-bar-track">
          <div class="ab-bar ab-bar-${color}" style="width:${Math.max(n, 2)}%"></div>
        </div>
        <p class="ab-card-desc">${desc}</p>
      </div>`;
  }).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="performance-overview">
        <div class="ab-section-intro">
          <h2 class="ab-section-title">Website Performance</h2>
          <p class="ab-section-desc">Google PageSpeed Insights scores in mobile mode. Each 0.1s delay reduces conversions by up to 8%.</p>
        </div>
        <div class="ab-cards-list">${cards}</div>
      </section>
    `,
  };
}

function buildSeo(seo) {
  const stats = [
    ['Domain Authority', seo['Domain Authority']],
    ['Monthly Visitors', seo['Monthly Visitors']],
    ['YoY Growth', seo['YoY Growth']],
    ['Organic Value', seo['Organic Traffic Value']],
    ['Branded Traffic', seo['Branded Traffic Share']],
  ].filter(([, v]) => v);

  const statCards = stats.map(([label, value]) => `
    <div class="ab-stat-card">
      <p class="ab-stat-card-value">${value}</p>
      <p class="ab-stat-card-label">${label}</p>
    </div>`).join('');

  const branded = seo['Top Branded Keywords'] || '';
  const nonBranded = seo['Top Non-Branded Opportunities'] || '';
  const anchors = ['SEO Health', 'Keywords'];

  return {
    anchors,
    html: `
      <section class="ab-section" id="seo-health">
        <h2 class="ab-section-title">SEO Health</h2>
        <div class="ab-stat-row">${statCards}</div>
      </section>
      <section class="ab-section" id="keywords">
        <h2 class="ab-section-title">Keywords</h2>
        <div class="ab-kw-row">
          <div class="ab-card">
            <p class="ab-kw-label">Branded Keywords</p>
            <p class="ab-card-desc">${branded}</p>
          </div>
          <div class="ab-card">
            <p class="ab-kw-label">Non-Branded Opportunities</p>
            <p class="ab-card-desc">${nonBranded}</p>
          </div>
        </div>
      </section>
    `,
  };
}

function buildAiVisibility(solutions) {
  const llm = solutions.find(([name]) => name.toLowerCase().includes('llm')) || [];
  const anchors = ['AI Search Overview', 'Why It Matters'];
  return {
    anchors,
    html: `
      <section class="ab-section" id="ai-search-overview">
        <div class="ab-section-intro ab-section-intro-tinted">
          <p class="ab-section-eyebrow">AI Visibility</p>
          <h2 class="ab-section-title">Your Brand in AI-Powered Search</h2>
          <p class="ab-section-desc">Adobe LLM Optimizer tracks how often your brand appears in answers from ChatGPT, Gemini, Google AI Overview/Mode, Perplexity, and Copilot — and where competitors win answers your brand is missing from.</p>
        </div>
      </section>
      <section class="ab-section" id="why-it-matters">
        <h2 class="ab-section-title">Why It Matters</h2>
        <div class="ab-card">
          <div class="ab-ai-stat-row">
            <div class="ab-ai-stat">
              <p class="ab-ai-stat-value">800%</p>
              <p class="ab-ai-stat-label">LLM referral traffic growth YoY</p>
            </div>
            <div class="ab-ai-stat">
              <p class="ab-ai-stat-value">60%</p>
              <p class="ab-ai-stat-label">of searches via AI platforms by 2027</p>
            </div>
            <div class="ab-ai-stat">
              <p class="ab-ai-stat-value">93%</p>
              <p class="ab-ai-stat-label">branded traffic — non-branded opportunity</p>
            </div>
          </div>
          ${llm[2] ? `<p class="ab-card-desc" style="margin-top:16px">${llm[2]}</p>` : ''}
        </div>
      </section>
    `,
  };
}

function buildSolutions(solutions, nextSteps) {
  const anchors = ['Recommended Solutions', 'Next Steps'];
  const solCards = solutions.map(([name, priority, desc, tags]) => {
    const tagChips = (tags || '').split('·').map((t) => `<span class="ab-tag">${t.trim()}</span>`).join('');
    return `
      <div class="ab-card">
        <div class="ab-card-head">
          <h3 class="ab-card-title">${name}</h3>
          ${badge(priority)}
        </div>
        <p class="ab-card-desc">${desc}</p>
        <div class="ab-tags">${tagChips}</div>
      </div>`;
  }).join('');

  const stepItems = nextSteps.map(([title, desc], i) => `
    <div class="ab-step">
      <div class="ab-step-num">${i + 1}</div>
      <div>
        <h3 class="ab-step-title">${title}</h3>
        <p class="ab-step-desc">${desc}</p>
      </div>
    </div>`).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="recommended-solutions">
        <h2 class="ab-section-title">Recommended Solutions</h2>
        <div class="ab-cards-list">${solCards}</div>
      </section>
      <section class="ab-section" id="next-steps">
        <h2 class="ab-section-title">Next Steps</h2>
        <div class="ab-card">
          <div class="ab-steps-list">${stepItems}</div>
          <p class="ab-steps-cta">Ready to explore these opportunities? Your Adobe team will be in touch to schedule a personalised workshop.</p>
        </div>
      </section>
    `,
  };
}

// ─── Layout ────────────────────────────────────────────────────
function renderLayout(meta, tabContent, activeTab) {
  const { anchors, html } = tabContent;
  const sidebarLinks = anchors.map((a) => `
    <a class="ab-sidebar-link" href="#${a.toLowerCase().replace(/\s+/g, '-')}">${a}</a>`).join('');

  return `
    ${renderTopbar()}
    <div class="ab-page-chrome">
      <div class="ab-tabnav-wrap">
        ${renderTabNav(activeTab)}
      </div>
      <div class="ab-page-body">
        <div class="ab-domain-bar">
          <span class="ab-domain">${meta.website || ''}</span>
        </div>
        <div class="ab-content-wrap">
          <aside class="ab-sidebar">
            <p class="ab-sidebar-heading">On this page</p>
            <nav>${sidebarLinks}</nav>
          </aside>
          <div class="ab-content">${html}</div>
        </div>
      </div>
    </div>
    <footer class="ab-report-footer">
      <p>Confidential · Adobe Digital Insights · ${meta.date || ''}</p>
    </footer>
  `;
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

  const slug = (session.company || 'test-report').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  try {
    const doc = await fetchReport(slug);
    const meta = parseKV(doc, 'aibootcamp-report-meta');
    const scores = parseBlock(doc, 'aibootcamp-report-scores');
    const opps = parseBlock(doc, 'aibootcamp-report-opportunities');
    const pages = parseBlock(doc, 'aibootcamp-report-pages');
    const seo = parseKV(doc, 'aibootcamp-report-seo');
    const solutions = parseBlock(doc, 'aibootcamp-report-solutions');
    const nextSteps = parseBlock(doc, 'aibootcamp-report-nextsteps');

    const tabBuilders = {
      overview: () => buildOverview(meta, scores, opps),
      performance: () => buildPerformance(pages),
      seo: () => buildSeo(seo),
      'ai-visibility': () => buildAiVisibility(solutions),
      solutions: () => buildSolutions(solutions, nextSteps),
    };

    let activeTab = 'overview';

    const render = () => {
      const content = tabBuilders[activeTab]();
      block.innerHTML = renderLayout(meta, content, activeTab);

      block.querySelector('.ab-topbar-logout')?.addEventListener('click', () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = LOGIN_PAGE;
      });

      block.querySelectorAll('.ab-tabnav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          render();
          block.querySelector('.ab-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      block.querySelectorAll('.ab-sidebar-link').forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = block.querySelector(link.getAttribute('href'));
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    };

    render();
  } catch (err) {
    block.innerHTML = `
      <div class="ab-error">
        <p class="ab-error-title">Report unavailable</p>
        <p class="ab-error-msg">${err.message}</p>
      </div>`;
  }
}
