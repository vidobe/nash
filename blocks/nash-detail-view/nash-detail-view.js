/**
 * loads and decorates the nash-detail-view block
 * Reads qualification metadata from the page head (og:title, meta[name=status], etc.)
 * @param {Element} block The block element
 */

const STEPS = [
  {
    id: 'discovery',
    name: 'Page Discovery & Competitor ID',
    desc: 'Page Discovery & Competitor ID',
    subtasks: [
      { name: 'Discover site pages', time: '0m 42s' },
      { name: 'Identify CMS platform', time: '0m 18s' },
      { name: 'Find competitor domains', time: '1m 04s' },
    ],
  },
  {
    id: 'collection',
    name: 'Data Collection',
    desc: 'Data Collection',
    subtasks: [
      { name: 'Fetch SEO signals', time: '1m 12s' },
      { name: 'Capture performance metrics', time: '2m 08s' },
      { name: 'Screenshot key pages', time: '0m 55s' },
    ],
  },
  {
    id: 'analysis',
    name: 'Core Analysis',
    desc: 'Core Analysis',
    subtasks: [
      { name: 'Strategic fit scoring', time: '1m 30s' },
      { name: 'Technical fit scoring', time: '1m 22s' },
      { name: 'Competitive position', time: '0m 58s' },
    ],
  },
  {
    id: 'product',
    name: 'Product Assessment & Success Story',
    desc: 'Product Assessment & Success Story',
    subtasks: [
      { name: 'Assess Edge Delivery', time: '1m 38s' },
      { name: 'Assess Sites Optimizer', time: '2m 22s' },
      { name: 'Assess LLM Optimizer', time: '1m 38s' },
      { name: 'Find success stories', time: '1m 15s' },
    ],
  },
];

function statusIcon(status) {
  if (status === 'done') {
    return `<svg class="nash-detail-step-icon done" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`;
  }
  if (status === 'running') {
    return `<svg class="nash-detail-step-icon running" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`;
  }
  return `<svg class="nash-detail-step-icon waiting" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}

function buildStepRow(step, stepStatus, expanded) {
  const row = document.createElement('div');
  row.className = `nash-detail-step${stepStatus === 'running' ? ' running' : ''}${expanded ? ' expanded' : ''}`;
  row.dataset.stepId = step.id;

  const statusLabel = stepStatus === 'done' ? 'Complete' : stepStatus === 'running' ? 'Running' : 'Waiting';
  const labelClass = `nash-detail-step-status ${stepStatus}`;

  row.innerHTML = `
    <button class="nash-detail-step-toggle" type="button" aria-expanded="${expanded}" aria-label="Toggle ${step.name}">
      <svg class="nash-detail-step-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    ${statusIcon(stepStatus)}
    <div class="nash-detail-step-info">
      <div class="nash-detail-step-name">${step.name}</div>
      <div class="nash-detail-step-desc">${step.desc}</div>
    </div>
    <span class="${labelClass}">${statusLabel}</span>
  `;

  if (stepStatus !== 'waiting') {
    const sub = document.createElement('div');
    sub.className = 'nash-detail-subtasks';
    sub.hidden = !expanded;
    step.subtasks.forEach((t) => {
      sub.innerHTML += `
        <div class="nash-detail-subtask">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          <span class="nash-detail-subtask-name">${t.name}</span>
          <span class="nash-detail-subtask-time">${t.time}</span>
        </div>
      `;
    });
    row.appendChild(sub);

    row.querySelector('.nash-detail-step-toggle').addEventListener('click', () => {
      const isExpanded = row.classList.toggle('expanded');
      sub.hidden = !isExpanded;
      row.querySelector('.nash-detail-step-toggle').setAttribute('aria-expanded', isExpanded);
    });
  }

  return row;
}

export default async function decorate(block) {
  const meta = (name) => document.head.querySelector(`meta[name="${name}"]`)?.content || '';
  const ogTitle = document.head.querySelector('meta[property="og:title"]')?.content || document.title || 'Company';

  const company = ogTitle.replace(' | Nash', '').trim();
  const status = meta('status') || 'done';
  const score = parseInt(meta('score'), 10) || null;
  const cms = meta('cms') || 'Unknown';
  const user = meta('user') || '';
  const version = meta('version') || '1';

  const statusLabel = status === 'generating' ? 'GENERATING' : 'COMPLETE';
  const statusClass = status === 'generating' ? 'gen' : 'done';

  // Determine step statuses (all done for complete, last one running for generating)
  const stepStatuses = STEPS.map((_, i) => {
    if (status === 'done') return 'done';
    if (i < STEPS.length - 1) return 'done';
    return 'running';
  });

  const completedSteps = stepStatuses.filter((s) => s === 'done').length;
  const totalSteps = STEPS.length;
  const pct = status === 'done' ? 100 : Math.round((completedSteps / totalSteps) * 100);

  block.innerHTML = `
    <div class="nash-detail-header">
      <a class="nash-detail-back" href="/">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Requests &amp; Reports
      </a>
      <div class="nash-detail-title-row">
        <h1 class="nash-detail-company">${company}</h1>
        <span class="nash-detail-version">v${version}</span>
        <span class="nash-detail-badge ${statusClass}">${statusLabel}</span>
      </div>
      <nav class="nash-detail-tabs" role="tablist">
        <button class="nash-detail-tab" role="tab" aria-selected="false" data-tab="request" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Request Details
        </button>
        <button class="nash-detail-tab" role="tab" aria-selected="false" data-tab="insights" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Insights
        </button>
        <button class="nash-detail-tab active" role="tab" aria-selected="true" data-tab="generation" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Generation
        </button>
        <button class="nash-detail-tab" role="tab" aria-selected="false" data-tab="issue" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Report Issue
        </button>
      </nav>
    </div>

    <div class="nash-detail-content">
      <div class="nash-detail-panel" data-panel="request" hidden>
        <p class="nash-detail-placeholder">Request details will appear here once available.</p>
      </div>

      <div class="nash-detail-panel" data-panel="insights" hidden>
        <p class="nash-detail-placeholder">Insights will appear here once the report is complete.</p>
      </div>

      <div class="nash-detail-panel" data-panel="generation">
        <div class="nash-detail-explainer">
          <h2>How reports are generated</h2>
          <p>Every report goes through three automated stages before it reaches an admin for review.</p>
          <div class="nash-detail-stages">
            <div class="nash-detail-stage">
              <div class="nash-detail-stage-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              </div>
              <div>
                <strong>1. Data Collection</strong>
                <p>Gathers SEO signals, performance metrics, and screenshots from external APIs.</p>
              </div>
            </div>
            <div class="nash-detail-stage">
              <div class="nash-detail-stage-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <strong>2. AI Analysis</strong>
                <p>Claude analyzes the data and compiles insights, recommendations, and product assessments.</p>
              </div>
            </div>
            <div class="nash-detail-stage">
              <div class="nash-detail-stage-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <strong>3. Report Pages</strong>
                <p>Each page is generated independently, validated for quality, then compiled into the final report.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="nash-detail-pipeline">
          <div class="nash-detail-pipeline-header">
            <div class="nash-detail-pipeline-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <div>
                <div class="nash-detail-pipeline-name">Insights Pipeline</div>
                <div class="nash-detail-pipeline-sub">Data collection, analysis, and insights compilation</div>
              </div>
            </div>
            <span class="nash-detail-pipeline-badge ${statusClass}">${status === 'generating' ? 'Running' : 'Completed'}</span>
          </div>
          <div class="nash-detail-pipeline-progress">
            <span>${completedSteps} / ${totalSteps} steps</span>
            <span>${pct}%</span>
          </div>
          <div class="nash-detail-progress-track">
            <div class="nash-detail-progress-fill ${status === 'generating' ? 'running' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="nash-detail-steps" id="nash-detail-steps"></div>
        </div>
      </div>

      <div class="nash-detail-panel" data-panel="issue" hidden>
        <p class="nash-detail-placeholder">Use this form to report issues with your qualification report.</p>
      </div>
    </div>
  `;

  // Build step rows
  const stepsContainer = block.querySelector('#nash-detail-steps');
  STEPS.forEach((step, i) => {
    const isExpanded = stepStatuses[i] === 'running';
    stepsContainer.appendChild(buildStepRow(step, stepStatuses[i], isExpanded));
  });

  // Tab switching
  block.querySelectorAll('.nash-detail-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      block.querySelectorAll('.nash-detail-tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      block.querySelectorAll('.nash-detail-panel').forEach((p) => { p.hidden = true; });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      block.querySelector(`[data-panel="${tab.dataset.tab}"]`).hidden = false;
    });
  });

  // Update page title in topbar
  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: company }, bubbles: true }));
}
