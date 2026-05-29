/**
 * aibootcamp-results block
 * Checks auth session, fetches the company's report doc from
 * /aibootcamp/reports/{company-slug}.plain.html, parses structured
 * block sections, and renders a brand visibility dashboard.
 */

import { getSession } from '../aibootcamp-login/aibootcamp-login.js';

const LOGIN_PAGE = '/aibootcamp/';
const REPORTS_BASE = '/aibootcamp/reports/';

// ─── Auth guard ───────────────────────────────────────────────
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = LOGIN_PAGE;
    return null;
  }
  return session;
}

// ─── Fetch & parse report doc ─────────────────────────────────
async function fetchReport(slug) {
  const url = `${REPORTS_BASE}${slug}.plain.html`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Report not found: ${slug}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc;
}

function parseBlock(doc, name) {
  const el = doc.querySelector(`.${name}`);
  if (!el) return [];
  return [...el.querySelectorAll(':scope > div')].map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.map((c) => c.textContent.trim());
  });
}

function parseKV(doc, name) {
  const rows = parseBlock(doc, name);
  return Object.fromEntries(rows.map(([k, v]) => [k, v]));
}

// ─── Score helpers ────────────────────────────────────────────
function scoreColor(val, max) {
  if (!max) return '';
  const pct = (parseFloat(val) / parseFloat(max)) * 100;
  if (pct >= 70) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function pageScoreColor(score) {
  const n = parseInt(score, 10);
  if (n >= 90) return 'green';
  if (n >= 50) return 'amber';
  return 'red';
}

function priorityLabel(p) {
  if (p === 'high') return '<span class="ab-badge ab-badge--red">High Priority</span>';
  if (p === 'medium') return '<span class="ab-badge ab-badge--amber">Medium Priority</span>';
  return '<span class="ab-badge ab-badge--gray">Low Priority</span>';
}

// ─── Render sections ──────────────────────────────────────────
function renderHeader(meta) {
  return `
    <header class="ab-report-header">
      <div class="ab-report-header__left">
        <svg class="ab-report-header__logo" width="72" height="25" viewBox="0 0 240 84" xmlns="http://www.w3.org/2000/svg" aria-label="Adobe">
          <path fill="#eb1000" d="M97.87 0H0v84L97.87 0zM142.13 0H240v84L142.13 0zM120 31.08L157.5 84h-24.7l-10.4-26.54H97.7L120 31.08z"/>
        </svg>
        <div class="ab-report-header__title-group">
          <p class="ab-report-header__eyebrow">Digital Insights Report</p>
          <h1 class="ab-report-header__company">${meta.company || 'Your Company'}</h1>
        </div>
      </div>
      <div class="ab-report-header__right">
        <span class="ab-report-header__meta">${meta.industry || ''}</span>
        <span class="ab-report-header__sep">·</span>
        <span class="ab-report-header__meta">${meta.market || ''}</span>
        <span class="ab-report-header__sep">·</span>
        <span class="ab-report-header__meta">${meta.date || ''}</span>
      </div>
    </header>
  `;
}

function renderScores(scores) {
  const cards = scores.map(([label, value, max, desc]) => {
    const color = scoreColor(value, max);
    return `
      <div class="ab-score-card ab-score-card--${color}">
        <p class="ab-score-card__label">${label}</p>
        <p class="ab-score-card__value">${value}${max ? `<span class="ab-score-card__max"> /${max}</span>` : ''}</p>
        <p class="ab-score-card__desc">${desc}</p>
      </div>
    `;
  }).join('');
  return `<section class="ab-section ab-scores-grid">${cards}</section>`;
}

function renderSummary(meta) {
  if (!meta.summary) return '';
  return `
    <section class="ab-section ab-summary">
      <p class="ab-summary__text">${meta.summary}</p>
    </section>
  `;
}

function renderOpportunities(opps) {
  if (!opps.length) return '';
  const items = opps.map(([title, desc, priority]) => `
    <div class="ab-opp-card">
      <div class="ab-opp-card__head">
        <h3 class="ab-opp-card__title">${title}</h3>
        ${priorityLabel(priority)}
      </div>
      <p class="ab-opp-card__desc">${desc}</p>
    </div>
  `).join('');
  return `
    <section class="ab-section">
      <h2 class="ab-section__heading">Platform Evolution Opportunities</h2>
      <div class="ab-opp-grid">${items}</div>
    </section>
  `;
}

function renderPages(pages) {
  if (!pages.length) return '';
  const rows = pages.map(([name, score, load, interact, desc]) => {
    const color = pageScoreColor(score);
    const barW = Math.max(parseInt(score, 10), 2);
    return `
      <div class="ab-page-card">
        <div class="ab-page-card__head">
          <span class="ab-page-card__name">${name}</span>
          <span class="ab-page-card__score ab-page-card__score--${color}">${score}<span class="ab-page-card__score-max">/100</span></span>
        </div>
        <div class="ab-page-card__bar-track">
          <div class="ab-page-card__bar ab-page-card__bar--${color}" style="width:${barW}%"></div>
        </div>
        <div class="ab-page-card__stats">
          ${load ? `<span class="ab-stat"><strong>${load}</strong> load time</span>` : ''}
          ${interact ? `<span class="ab-stat"><strong>${interact}</strong> interactivity</span>` : ''}
        </div>
        <p class="ab-page-card__desc">${desc}</p>
      </div>
    `;
  }).join('');
  return `
    <section class="ab-section">
      <h2 class="ab-section__heading">Website Performance Analysis</h2>
      <p class="ab-section__sub">Google PageSpeed Insights · Mobile · <a href="https://www.vodafone.nl" target="_blank" rel="noopener">vodafone.nl</a></p>
      <div class="ab-pages-grid">${rows}</div>
    </section>
  `;
}

function renderSeo(seo) {
  if (!Object.keys(seo).length) return '';
  const stats = [
    { label: 'Domain Authority', value: seo['Domain Authority'] },
    { label: 'Monthly Visitors', value: seo['Monthly Visitors'] },
    { label: 'YoY Growth', value: seo['YoY Growth'] },
    { label: 'Organic Value', value: seo['Organic Traffic Value'] },
    { label: 'Branded Traffic', value: seo['Branded Traffic Share'] },
  ].filter((s) => s.value);

  const statCards = stats.map((s) => `
    <div class="ab-stat-card">
      <p class="ab-stat-card__value">${s.value}</p>
      <p class="ab-stat-card__label">${s.label}</p>
    </div>
  `).join('');

  const branded = seo['Top Branded Keywords'] || '';
  const nonBranded = seo['Top Non-Branded Opportunities'] || '';

  return `
    <section class="ab-section">
      <h2 class="ab-section__heading">SEO Health</h2>
      <div class="ab-stat-row">${statCards}</div>
      ${branded ? `
        <div class="ab-kw-row">
          <div class="ab-kw-group">
            <p class="ab-kw-group__label">Branded Keywords</p>
            <p class="ab-kw-group__values">${branded}</p>
          </div>
          <div class="ab-kw-group">
            <p class="ab-kw-group__label">Non-Branded Opportunities</p>
            <p class="ab-kw-group__values">${nonBranded}</p>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderSolutions(solutions) {
  if (!solutions.length) return '';
  const cards = solutions.map(([name, priority, desc, tags]) => {
    const tagChips = (tags || '').split('·').map((t) => `<span class="ab-tag">${t.trim()}</span>`).join('');
    return `
      <div class="ab-solution-card">
        <div class="ab-solution-card__head">
          ${priorityLabel(priority)}
        </div>
        <h3 class="ab-solution-card__name">${name}</h3>
        <p class="ab-solution-card__desc">${desc}</p>
        <div class="ab-solution-card__tags">${tagChips}</div>
      </div>
    `;
  }).join('');
  return `
    <section class="ab-section">
      <h2 class="ab-section__heading">Recommended Adobe Solutions</h2>
      <div class="ab-solutions-grid">${cards}</div>
    </section>
  `;
}

function renderNextSteps(steps) {
  if (!steps.length) return '';
  const items = steps.map(([title, desc], i) => `
    <div class="ab-step">
      <div class="ab-step__num">${i + 1}</div>
      <div class="ab-step__body">
        <h3 class="ab-step__title">${title}</h3>
        <p class="ab-step__desc">${desc}</p>
      </div>
    </div>
  `).join('');
  return `
    <section class="ab-section ab-nextsteps">
      <h2 class="ab-section__heading">Recommended Next Steps</h2>
      <div class="ab-steps-list">${items}</div>
      <p class="ab-nextsteps__cta">Ready to explore these opportunities? Your Adobe team will be in touch to schedule a personalised workshop.</p>
    </section>
  `;
}

function renderError(msg) {
  return `
    <div class="ab-error">
      <p class="ab-error__title">Report unavailable</p>
      <p class="ab-error__msg">${msg}</p>
    </div>
  `;
}

function renderLoading() {
  return `<div class="ab-loading"><div class="ab-loading__spinner"></div><p>Loading your report…</p></div>`;
}

// ─── Main ─────────────────────────────────────────────────────
export default async function decorate(block) {
  const session = requireAuth();
  if (!session) return;

  block.innerHTML = renderLoading();

  // Company slug: from session or block content fallback (for testing)
  let slug = session.company || block.querySelector('p')?.textContent.trim() || 'test-report';
  slug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  try {
    const doc = await fetchReport(slug);

    const meta = parseKV(doc, 'aibootcamp-report-meta');
    const scores = parseBlock(doc, 'aibootcamp-report-scores');
    const opps = parseBlock(doc, 'aibootcamp-report-opportunities');
    const pages = parseBlock(doc, 'aibootcamp-report-pages');
    const seoRaw = parseKV(doc, 'aibootcamp-report-seo');
    const solutions = parseBlock(doc, 'aibootcamp-report-solutions');
    const nextSteps = parseBlock(doc, 'aibootcamp-report-nextsteps');

    block.innerHTML = `
      <div class="ab-report">
        ${renderHeader(meta)}
        <div class="ab-report__body">
          ${renderScores(scores)}
          ${renderSummary(meta)}
          ${renderOpportunities(opps)}
          ${renderPages(pages)}
          ${renderSeo(seoRaw)}
          ${renderSolutions(solutions)}
          ${renderNextSteps(nextSteps)}
        </div>
        <footer class="ab-report-footer">
          <p>Confidential · Adobe Digital Insights · ${meta.date || ''}</p>
          <button class="ab-report-footer__logout" type="button">Sign out</button>
        </footer>
      </div>
    `;

    block.querySelector('.ab-report-footer__logout')?.addEventListener('click', () => {
      localStorage.removeItem('aibootcamp-auth');
      window.location.href = LOGIN_PAGE;
    });
  } catch (err) {
    block.innerHTML = renderError(err.message);
  }
}
