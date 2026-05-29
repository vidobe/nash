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

function scoreColor(val) {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return 'neutral';
  if (n >= 70) return 'green';
  if (n >= 50) return 'amber';
  return 'red';
}

function cwvColor(status) {
  if (status === 'good') return 'green';
  if (status === 'needs-work') return 'amber';
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

const buildOverview = (meta, scores, solutions) => {
  const anchors = ['Executive Summary', 'Key Scores', 'Growth Opportunities'];

  const scoreCards = scores.map(([label, value, max, desc]) => {
    const color = scoreColor(value);
    return `
      <div class="ab-score-card ab-score-card-${color}">
        <p class="ab-score-card-label">${label}</p>
        <p class="ab-score-card-value">${value}${max ? `<span class="ab-score-card-max"> /${max}</span>` : ''}</p>
        <p class="ab-score-card-desc">${desc}</p>
      </div>`;
  }).join('');

  const oppCards = solutions.map(([name, priority, desc]) => `
    <div class="ab-card">
      <div class="ab-card-head">
        <h3 class="ab-card-title">${name}</h3>
        ${badge(priority)}
      </div>
      <p class="ab-card-desc">${desc}</p>
    </div>`).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="executive-summary">
        <div class="ab-section-intro">
          <h1 class="ab-company-name">${meta.company || ''}</h1>
          <span class="ab-domain-chip">${meta.domain || ''}</span>
          <p class="ab-section-desc">${meta.summary || ''}</p>
          <div class="ab-scores-grid ab-scores-grid-inline">${scoreCards}</div>
        </div>
      </section>
      <section class="ab-section" id="key-scores">
        <h2 class="ab-section-title">Key Scores</h2>
        <div class="ab-scores-grid">${scoreCards}</div>
      </section>
      <section class="ab-section" id="growth-opportunities">
        <h2 class="ab-section-title">Growth Opportunities</h2>
        <div class="ab-cards-list">${oppCards}</div>
      </section>
    `,
  };
};

const buildPerformance = (perfRows) => {
  const anchors = ['Core Web Vitals', 'Business Impact'];

  // Filter out "note" row for metrics display
  const metrics = perfRows.filter(([name]) => name !== 'note');
  const noteRow = perfRows.find(([name]) => name === 'note');

  const metricCards = metrics.map(([name, value, target, status]) => {
    const color = cwvColor(status);
    const statusLabel = status === 'needs-work' ? 'Needs Work' : status.charAt(0).toUpperCase() + status.slice(1);
    return `
      <div class="ab-cwv-card ab-cwv-card-${color}">
        <div class="ab-cwv-card-head">
          <span class="ab-cwv-name">${name}</span>
          <span class="ab-cwv-status ab-cwv-status-${color}">${statusLabel}</span>
        </div>
        <p class="ab-cwv-value">${value}</p>
        <p class="ab-cwv-target">Target: ${target}</p>
      </div>`;
  }).join('');

  const impactCards = [
    ['Bounce Rate', 'Slow cold-load pages increase bounce rate by up to 90%. At 12.4s LCP, first-time visitors abandon before content renders — losing high-intent shoppers who will not return.', 'red'],
    ['Revenue Impact', 'Every 100ms improvement in load time correlates with a 1% increase in conversion rate. Closing the 9.9s gap to the 2.5s LCP target could unlock significant incremental revenue.', 'amber'],
    ['Search Rankings', 'Google uses Core Web Vitals as a ranking signal. The 42/100 PageSpeed score and poor LCP actively suppress organic rankings, compounding the 20.4% traffic decline.', 'red'],
    ['Mobile Experience', 'INP of 327ms (needs work) means interactive elements feel sluggish on mobile devices — critical in a market where 60%+ of e-commerce sessions are mobile.', 'amber'],
  ].map(([title, desc, color]) => `
    <div class="ab-card ab-impact-card-${color}">
      <h3 class="ab-card-title">${title}</h3>
      <p class="ab-card-desc">${desc}</p>
    </div>`).join('');

  const noteHtml = noteRow ? `
    <div class="ab-note-card">
      <span class="ab-note-icon">ℹ</span>
      <p>${noteRow[1]}</p>
    </div>` : '';

  return {
    anchors,
    html: `
      <section class="ab-section" id="core-web-vitals">
        <h2 class="ab-section-title">Core Web Vitals</h2>
        <div class="ab-cwv-grid">${metricCards}</div>
        ${noteHtml}
      </section>
      <section class="ab-section" id="business-impact">
        <h2 class="ab-section-title">Business Impact</h2>
        <div class="ab-cards-grid">${impactCards}</div>
      </section>
    `,
  };
};

const buildSeo = (seo, keywords) => {
  const anchors = ['Traffic Overview', 'Branded vs Non-Branded', 'Keyword Opportunities'];

  const trafficStats = [
    ['Monthly Traffic', seo['Monthly Traffic']],
    ['YoY Growth', seo['YoY Growth']],
    ['Traffic Value', seo['Traffic Value']],
    ['Non-Branded Traffic', seo['Non-Branded Traffic']],
  ].filter(([, v]) => v);

  const statCards = trafficStats.map(([label, value]) => {
    const isNeg = value && value.startsWith('-');
    return `
      <div class="ab-stat-card${isNeg ? ' ab-stat-card-red' : ''}">
        <p class="ab-stat-card-value">${value}</p>
        <p class="ab-stat-card-label">${label}</p>
      </div>`;
  }).join('');

  const branded = parseFloat(seo['Branded Traffic'] || '86');
  const nonBranded = parseFloat(seo['Non-Branded Traffic'] || '14');

  const kwRows = keywords.map(([kw, vol, pos, clicks, rationale]) => `
    <tr>
      <td class="ab-kw-term">${kw}</td>
      <td>${vol}</td>
      <td>${pos}</td>
      <td>${clicks}</td>
      <td class="ab-kw-rationale">${rationale}</td>
    </tr>`).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="traffic-overview">
        <h2 class="ab-section-title">Traffic Overview</h2>
        <div class="ab-stat-row">${statCards}</div>
      </section>
      <section class="ab-section" id="branded-vs-non-branded">
        <h2 class="ab-section-title">Branded vs Non-Branded</h2>
        <div class="ab-card">
          <div class="ab-brand-bar-wrap">
            <div class="ab-brand-bar">
              <div class="ab-brand-bar-fill ab-brand-bar-fill-branded" style="width:${branded}%">
                <span>${branded}% Branded</span>
              </div>
              <div class="ab-brand-bar-fill ab-brand-bar-fill-nonbranded" style="width:${nonBranded}%">
                <span>${nonBranded}% Non-Branded</span>
              </div>
            </div>
          </div>
          <p class="ab-card-desc" style="margin-top:16px">
            Industry benchmark for healthy e-commerce is <strong>40–60% non-branded traffic</strong>.
            At 14% non-branded, Wehkamp is heavily dependent on existing brand awareness —
            leaving significant organic discovery revenue on the table.
          </p>
          <div class="ab-kw-chips-row">
            <div>
              <p class="ab-kw-label">Top Branded</p>
              <p class="ab-kw-value">${seo['Top Branded Keywords'] || ''}</p>
            </div>
            <div>
              <p class="ab-kw-label">Non-Branded Opportunities</p>
              <p class="ab-kw-value">${seo['Top Non-Branded Opportunities'] || ''}</p>
            </div>
          </div>
        </div>
      </section>
      <section class="ab-section" id="keyword-opportunities">
        <h2 class="ab-section-title">Keyword Opportunities</h2>
        <div class="ab-table-wrap">
          <table class="ab-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Volume</th>
                <th>Position</th>
                <th>Est. Clicks</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>${kwRows}</tbody>
          </table>
        </div>
      </section>
    `,
  };
};

const buildAiVisibility = (ai) => {
  const anchors = ['Visibility Score', 'By Engine', 'Competitive Position', 'What AI Sees'];

  // parse known rows
  const kv = Object.fromEntries(ai.map(([k, v, , note]) => [k, { v, note }]));

  const scoreVal = kv['Visibility Score'] ? kv['Visibility Score'].v : '62';
  const scoreNote = kv['Visibility Score'] ? kv['Visibility Score'].note : '-8 points over 3 months';

  const statItems = [
    ['Brand Mentions', kv['Brand Mentions'] ? kv['Brand Mentions'].v : '', kv['Brand Mentions'] ? ai.find(([k]) => k === 'Brand Mentions')?.[3] : ''],
    ['Citations', kv.Citations ? kv.Citations.v : '', ai.find(([k]) => k === 'Citations')?.[3] || ''],
    ['Audience Reach', kv['Audience Reach'] ? kv['Audience Reach'].v : '', ai.find(([k]) => k === 'Audience Reach')?.[3] || ''],
  ].map(([label, value, note]) => `
    <div class="ab-ai-stat">
      <p class="ab-ai-stat-value">${value}</p>
      <p class="ab-ai-stat-label">${label}</p>
      ${note ? `<p class="ab-ai-stat-note">${note}</p>` : ''}
    </div>`).join('');

  const engines = [
    ['Google AI Overviews', kv['AI Overview Score'] ? kv['AI Overview Score'].v : '74', 'green'],
    ['Google AI Mode', kv['AI Mode Score'] ? kv['AI Mode Score'].v : '72', 'green'],
    ['Gemini', kv['Gemini Score'] ? kv['Gemini Score'].v : '61', 'amber'],
    ['ChatGPT', kv['ChatGPT Score'] ? kv['ChatGPT Score'].v : '55', 'amber'],
  ].map(([engine, score, color]) => `
    <div class="ab-engine-row">
      <span class="ab-engine-name">${engine}</span>
      <div class="ab-engine-bar-track">
        <div class="ab-engine-bar ab-engine-bar-${color}" style="width:${score}%"></div>
      </div>
      <span class="ab-engine-score ab-engine-score-${color}">${score}</span>
    </div>`).join('');

  const compRank = ai.find(([k]) => k === 'Competitive Rank');
  const compNote = compRank ? compRank[3] : 'h&m leads with 80% share of voice';
  const compVal = compRank ? compRank[1] : '#2 of 5';

  const aiSummaryRow = ai.find(([k]) => k === 'AI Summary');
  const aiSummary = aiSummaryRow ? aiSummaryRow[1] : '';

  const assocRow = ai.find(([k]) => k === 'Top Associations');
  const associations = assocRow ? assocRow[1].split(',').map((a) => `<span class="ab-tag">${a.trim()}</span>`).join('') : '';

  const color62 = scoreColor(scoreVal);

  return {
    anchors,
    html: `
      <section class="ab-section" id="visibility-score">
        <h2 class="ab-section-title">Visibility Score</h2>
        <div class="ab-ai-score-row">
          <div class="ab-score-card ab-score-card-hero ab-score-card-${color62}">
            <p class="ab-score-card-label">Overall AI Visibility</p>
            <p class="ab-score-card-value">${scoreVal}<span class="ab-score-card-max"> /100</span></p>
            <p class="ab-score-card-desc">${scoreNote}</p>
          </div>
          <div class="ab-ai-stat-row">${statItems}</div>
        </div>
      </section>
      <section class="ab-section" id="by-engine">
        <h2 class="ab-section-title">By Engine</h2>
        <div class="ab-card">
          <div class="ab-engines-list">${engines}</div>
        </div>
      </section>
      <section class="ab-section" id="competitive-position">
        <h2 class="ab-section-title">Competitive Position</h2>
        <div class="ab-card">
          <div class="ab-comp-row">
            <div class="ab-comp-rank">
              <p class="ab-comp-rank-value">${compVal}</p>
              <p class="ab-comp-rank-label">Competitive Rank</p>
            </div>
            <p class="ab-card-desc">${compNote.charAt(0).toUpperCase() + compNote.slice(1)}.</p>
          </div>
        </div>
      </section>
      <section class="ab-section" id="what-ai-sees">
        <h2 class="ab-section-title">What AI Sees</h2>
        <div class="ab-card">
          ${aiSummary ? `<p class="ab-card-desc">${aiSummary}</p>` : ''}
          ${associations ? `<div class="ab-tags" style="margin-top:16px">${associations}</div>` : ''}
        </div>
      </section>
    `,
  };
};

const buildSolutions = (solutions, success) => {
  const anchors = ['Recommended Solutions', 'Customer Success'];

  const solCards = solutions.map(([name, priority, desc, tags]) => {
    const tagChips = (tags || '').split('·').map((t) => `<span class="ab-tag">${t.trim()}</span>`).join('');
    // Extract quick win from desc (after "Quick win:")
    const qwIdx = desc.indexOf('Quick win:');
    const mainDesc = qwIdx > -1 ? desc.slice(0, qwIdx).trim() : desc;
    const quickWin = qwIdx > -1 ? desc.slice(qwIdx) : '';
    return `
      <div class="ab-card">
        <div class="ab-card-head">
          <h3 class="ab-card-title">${name}</h3>
          ${badge(priority)}
        </div>
        <p class="ab-card-desc">${mainDesc}</p>
        ${quickWin ? `<div class="ab-quick-win"><span class="ab-quick-win-label">Quick Win</span><p>${quickWin.replace('Quick win: ', '')}</p></div>` : ''}
        <div class="ab-tags">${tagChips}</div>
      </div>`;
  }).join('');

  const statNums = ['stat1', 'stat2', 'stat3', 'stat4'];
  const statBoxes = statNums.map((prefix) => {
    const val = success[`${prefix}-value`];
    const lbl = success[`${prefix}-label`];
    if (!val) return '';
    return `
      <div class="ab-success-stat">
        <p class="ab-success-stat-value">${val}</p>
        <p class="ab-success-stat-label">${lbl || ''}</p>
      </div>`;
  }).join('');

  return {
    anchors,
    html: `
      <section class="ab-section" id="recommended-solutions">
        <h2 class="ab-section-title">Recommended Solutions</h2>
        <div class="ab-cards-list">${solCards}</div>
      </section>
      <section class="ab-section" id="customer-success">
        <h2 class="ab-section-title">Customer Success</h2>
        <div class="ab-card ab-success-card">
          <div class="ab-success-head">
            <div>
              <h3 class="ab-card-title">${success.company || ''}</h3>
              <p class="ab-success-industry">${success.industry || ''} · ${success.solution || ''}</p>
            </div>
          </div>
          <div class="ab-success-stats">${statBoxes}</div>
          <p class="ab-card-desc">${success.description || ''}</p>
          ${success.relevance ? `<div class="ab-relevance-card"><p class="ab-relevance-label">Why this matters for you</p><p>${success.relevance}</p></div>` : ''}
        </div>
      </section>
    `,
  };
};

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
          <span class="ab-domain">${meta.domain || meta.website || ''}</span>
          <span class="ab-industry">${meta.industry || ''}</span>
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
    const perfRows = parseBlock(doc, 'aibootcamp-report-performance');
    const seo = parseKV(doc, 'aibootcamp-report-seo');
    const keywords = parseBlock(doc, 'aibootcamp-report-seo-keywords');
    const aiRows = parseBlock(doc, 'aibootcamp-report-ai');
    const solutions = parseBlock(doc, 'aibootcamp-report-solutions');
    const successKV = parseKV(doc, 'aibootcamp-report-success');

    const tabBuilders = {
      overview: () => buildOverview(meta, scores, solutions),
      performance: () => buildPerformance(perfRows),
      seo: () => buildSeo(seo, keywords),
      'ai-visibility': () => buildAiVisibility(aiRows),
      solutions: () => buildSolutions(solutions, successKV),
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
