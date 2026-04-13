/**
 * nash-new-analysis block
 * Multi-step wizard: Quick Setup → Customize → Review
 * @param {Element} block
 */

const STEPS = ['Quick Setup', 'Customize', 'Review'];

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Belgium', 'Brazil', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia',
  'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany',
  'Greece', 'Hong Kong', 'Hungary', 'India', 'Indonesia', 'Ireland', 'Israel',
  'Italy', 'Japan', 'Malaysia', 'Mexico', 'Netherlands', 'New Zealand',
  'Norway', 'Philippines', 'Poland', 'Portugal', 'Romania', 'Saudi Arabia',
  'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Vietnam',
];

function buildStepBar(current) {
  return `
    <div class="nash-wizard-steps" role="list" aria-label="Wizard steps">
      ${STEPS.map((label, i) => {
    let state = 'pending';
    if (i < current) state = 'done';
    else if (i === current) state = 'active';
    return `
          <div class="nash-wizard-step ${state}" role="listitem" aria-current="${state === 'active' ? 'step' : 'false'}">
            <div class="nash-wizard-step-track">
              <div class="nash-wizard-step-line left${i === 0 ? ' hidden' : ''}"></div>
              <div class="nash-wizard-step-dot">
                ${state === 'done' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
              </div>
              <div class="nash-wizard-step-line right${i === STEPS.length - 1 ? ' hidden' : ''}"></div>
            </div>
            <span class="nash-wizard-step-label">${label}</span>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function buildQuickSetup() {
  const countryOptions = COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  return `
    <form class="nash-wizard-form" id="nash-step-0" novalidate>
      <h2 class="nash-wizard-form-title">Quick Setup</h2>

      <div class="nash-wizard-grid">
        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="company-name">
            Company Name
            <span class="nash-wizard-required">Required</span>
          </label>
          <p class="nash-wizard-hint">The company that owns the website</p>
          <input class="nash-wizard-input" id="company-name" name="company" type="text"
            placeholder="e.g. Telenet, BMW, Unilever" required autocomplete="organization"/>
        </div>

        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="dr-id">
            Deal Registration ID
            <span class="nash-wizard-required">Required</span>
          </label>
          <p class="nash-wizard-hint">Salesforce DR ID for this opportunity</p>
          <input class="nash-wizard-input" id="dr-id" name="drId" type="text"
            placeholder="DR3513652" required/>
          <label class="nash-wizard-checkbox-label" for="no-dr">
            <input class="nash-wizard-checkbox" id="no-dr" name="noDr" type="checkbox"/>
            I don&rsquo;t have a DR ID
          </label>
        </div>

        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="website">
            Website
            <span class="nash-wizard-required">Required</span>
          </label>
          <p class="nash-wizard-hint">Main website to analyze</p>
          <input class="nash-wizard-input" id="website" name="website" type="text"
            placeholder="e.g. telenet.be or hyundai.com/au/en" required autocomplete="url"/>
        </div>

        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="seo-market">
            SEO Market
            <span class="nash-wizard-required">Required</span>
          </label>
          <p class="nash-wizard-hint">Primary country for SEO analysis</p>
          <select class="nash-wizard-select" id="seo-market" name="seoMarket" required>
            <option value="" disabled selected>Select country</option>
            ${countryOptions}
          </select>
        </div>
      </div>

      <div class="nash-wizard-url-hint" id="url-hint" hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span><strong>Enter the website to analyze</strong> &mdash; use the main domain for full analysis, or add a regional path for country-specific insights.</span>
        <div class="nash-wizard-url-chips" id="url-chips"></div>
      </div>

      <div class="nash-wizard-grid">
        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="target-date">Target Date</label>
          <p class="nash-wizard-hint">Meeting, pitch, or deadline when you need this report</p>
          <input class="nash-wizard-input" id="target-date" name="targetDate" type="date"/>
        </div>

        <div class="nash-wizard-field">
          <label class="nash-wizard-label" for="campaign-tag">Campaign Tag</label>
          <p class="nash-wizard-hint">Group related report requests together</p>
          <input class="nash-wizard-input" id="campaign-tag" name="campaignTag" type="text"
            placeholder="e.g. Q2 EMEA Push"/>
        </div>
      </div>
    </form>
  `;
}

function buildCustomize() {
  return `
    <div class="nash-wizard-form" id="nash-step-1">
      <h2 class="nash-wizard-form-title">Customize</h2>
      <div class="nash-wizard-placeholder">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
        <p>Customize options coming soon.</p>
      </div>
    </div>
  `;
}

function buildReview() {
  return `
    <div class="nash-wizard-form" id="nash-step-2">
      <h2 class="nash-wizard-form-title">Review</h2>
      <div class="nash-wizard-placeholder">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>Review and submit coming soon.</p>
      </div>
    </div>
  `;
}

const STEP_BUILDERS = [buildQuickSetup, buildCustomize, buildReview];

function buildUrlChips(url) {
  if (!url) return '';
  const trimmed = url.trim().replace(/^https?:\/\//, '');
  const withProtocol = `https://${trimmed}`;
  const domain = trimmed.split('/')[0];
  const chips = [];

  if (trimmed !== domain) chips.push({ label: domain, valid: true });
  chips.push({ label: trimmed, valid: true });
  if (trimmed !== url.trim()) chips.push({ label: url.trim(), valid: false });
  if (url.trim().startsWith('https://')) chips.push({ label: withProtocol, valid: false });

  const seen = new Set();
  return [...chips, { label: withProtocol, valid: true }]
    .filter((c) => { if (seen.has(c.label)) return false; seen.add(c.label); return true; })
    .slice(0, 4)
    .map((c) => `<span class="nash-wizard-chip ${c.valid ? 'valid' : 'invalid'}">${c.label}</span>`)
    .join('');
}

export default async function decorate(block) {
  let currentStep = 0;

  function wireStep(step) {
    block.querySelector('.nash-wizard-next-btn').addEventListener('click', () => {
      if (step < STEPS.length - 1) {
        currentStep += 1;
        render(); // eslint-disable-line no-use-before-define
      }
    });

    const backBtn = block.querySelector('.nash-wizard-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        currentStep -= 1;
        render(); // eslint-disable-line no-use-before-define
      });
    }

    if (step === 0) {
      const websiteInput = block.querySelector('#website');
      const hint = block.querySelector('#url-hint');
      const chips = block.querySelector('#url-chips');
      const noDr = block.querySelector('#no-dr');
      const drInput = block.querySelector('#dr-id');

      websiteInput.addEventListener('input', () => {
        const val = websiteInput.value.trim();
        if (val.length > 3) {
          hint.hidden = false;
          chips.innerHTML = buildUrlChips(val);
        } else {
          hint.hidden = true;
        }
      });

      noDr.addEventListener('change', () => {
        drInput.disabled = noDr.checked;
        drInput.required = !noDr.checked;
        if (noDr.checked) drInput.value = '';
      });
    }
  }

  function render() {
    block.innerHTML = `
      <div class="nash-wizard-shell">
        <div class="nash-wizard-card">
          ${buildStepBar(currentStep)}
          <div class="nash-wizard-body">
            ${STEP_BUILDERS[currentStep]()}
          </div>
          <div class="nash-wizard-footer">
            ${currentStep > 0 ? '<button class="nash-wizard-back-btn" type="button">← Back</button>' : '<span></span>'}
            <button class="nash-wizard-next-btn" type="button">
              ${currentStep < STEPS.length - 1 ? 'Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    `;

    wireStep(currentStep);
  }

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'New Analysis' }, bubbles: true }));
  render();
}
