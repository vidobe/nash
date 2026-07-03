/*
 * Opp Management form for a Nash assessment.
 *
 * Captures the Workfront "TPS Tech Driver Project" fields. For now everything is
 * simulated and stored on the assessment (assessment.opp); the field config and
 * the save hook are structured so this can later read/write Workfront directly
 * (via the WFT MCP / API) without touching the UI.
 *
 * NOTE: the dropdown option lists below are best-guess defaults — confirm/adjust
 * them against the real Workfront custom-form values when we connect.
 */

const STATUS = ['Not Started', 'In Progress', 'Complete', 'Not Required'];

const OPP_FORM = [
  {
    title: 'Opportunity',
    note: 'From CRM — read-only once connected',
    fields: [
      { key: 'oppName', label: 'Opportunity & Tech Driver', type: 'text' },
      { key: 'techDriver', label: 'Tech Driver', type: 'text' },
      { key: 'primaryEa', label: 'Primary EA', type: 'text' },
      { key: 'dynamicsUrl', label: 'Dynamics 365 Opp URL', type: 'text' },
    ],
  },
  {
    title: 'CRM Overview',
    fields: [
      { key: 'businessDriver', label: 'Business Driver', type: 'text' },
      { key: 'closeDate', label: 'Close Date', type: 'date' },
      {
        key: 'salesStage',
        label: 'Sales Stage',
        type: 'select',
        options: ['Stage 1 - Discover', 'Stage 2 - Scope', 'Stage 3 - Qualification', 'Stage 4 - Propose', 'Stage 5 - Negotiate', 'Closed Won', 'Closed Lost'],
      },
      { key: 'gnarr', label: 'DX Total GNARR', type: 'text' },
      { key: 'renewedArr', label: 'DX Total Renewed ARR', type: 'text' },
    ],
  },
  {
    title: 'Tech Driver Status',
    fields: [
      {
        key: 'disengaged', label: 'Tech Driver Disengaged', type: 'select', options: ['No', 'Yes'],
      },
      {
        key: 'techFit', label: 'Opp Tech Fit', type: 'select', options: ['Not Started', 'In Progress', 'Confirmed', 'At Risk'],
      },
      {
        key: 'techWin', label: 'Opp Tech Win', type: 'select', options: ['Not Started', 'In Progress', 'Won', 'Lost'],
      },
      {
        key: 'archDesign', label: 'Opp Architecture Design', type: 'select', options: STATUS,
      },
      {
        key: 'povStatus', label: 'POV Status', type: 'select', options: STATUS,
      },
      {
        key: 'techCase', label: 'Opp Tech Case', type: 'select', options: ['Not Required', 'Required', 'In Progress', 'Complete'],
      },
      {
        key: 'techRisk', label: 'Opp Tech Risk', type: 'select', options: ['Low Risk', 'Medium Risk', 'High Risk'],
      },
      {
        key: 'techRiskCategory',
        label: 'Opp Tech Risk Category',
        type: 'select',
        options: ['None', 'Technical Gap', 'Competitive', 'Commercial', 'Security / Compliance', 'Resourcing', 'Timeline'],
      },
      { key: 'riskComments', label: 'Opp Tech Risk Comments / Mitigation', type: 'textarea' },
    ],
  },
  {
    title: 'Additional Details',
    fields: [
      { key: 'businessObjectives', label: 'Top 3-4 Business Objectives', type: 'textarea' },
      { key: 'pains', label: 'Top 3-4 Pains / Challenges', type: 'textarea' },
      { key: 'techStack', label: 'Current Tech Stack', type: 'textarea' },
      { key: 'successLooksLike', label: 'What Does Success Look Like?', type: 'textarea' },
      { key: 'useCases', label: 'Top 3-4 Use Cases', type: 'textarea' },
      { key: 'execSummary', label: 'Executive Summary', type: 'textarea' },
    ],
  },
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Colour tone for a status/risk value — drives the coloured pill on selects. */
function toneFor(value) {
  const s = String(value).toLowerCase();
  if (!s || /not required|not started|n\/a|none/.test(s)) return '';
  if (/high risk|at risk|lost|blocked|no fit/.test(s)) return 'danger';
  if (/in progress|medium|pending|required/.test(s)) return 'warn';
  if (/low risk|complete|confirmed|won|good fit|strong/.test(s)) return 'ok';
  return '';
}

/* Values seeded from the assessment so the form starts useful, not blank. */
export function defaultOpp(a, userName = '') {
  let techRisk = '';
  if (typeof a.score === 'number') {
    if (a.score >= 70) techRisk = 'Low Risk';
    else if (a.score >= 45) techRisk = 'Medium Risk';
    else techRisk = 'High Risk';
  }
  return {
    oppName: [a.dr, a.company].filter(Boolean).join(' - '),
    techDriver: userName,
    salesStage: 'Stage 3 - Qualification',
    techFit: 'In Progress',
    techWin: 'In Progress',
    techCase: 'Not Required',
    techRisk,
    techStack: a.cms && a.cms.toLowerCase() !== 'n/a' ? a.cms : '',
  };
}

function fieldHtml(f, value) {
  const id = `opp-${f.key}`;
  const label = `<span class="nash-session-opp-label">${esc(f.label)}</span>`;
  if (f.type === 'textarea') {
    return `<label class="nash-session-opp-field wide" for="${id}">${label}
      <textarea id="${id}" name="${f.key}" rows="2" class="nash-session-opp-textarea">${esc(value)}</textarea></label>`;
  }
  if (f.type === 'select') {
    const opts = ['', ...f.options]
      .map((o) => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${o ? esc(o) : '—'}</option>`)
      .join('');
    return `<label class="nash-session-opp-field" for="${id}">${label}
      <select id="${id}" name="${f.key}" class="nash-session-opp-select" data-tone="${toneFor(value)}">${opts}</select></label>`;
  }
  const type = f.type === 'date' ? 'date' : 'text';
  return `<label class="nash-session-opp-field" for="${id}">${label}
    <input id="${id}" name="${f.key}" type="${type}" class="nash-session-opp-input" value="${esc(value)}"></label>`;
}

/** Returns the Opp Management form HTML for an assessment. */
export function renderOppPanel(a, userName = '') {
  const opp = { ...defaultOpp(a, userName), ...(a.opp || {}) };
  const sections = OPP_FORM.map((s) => `
    <section class="nash-session-opp-section">
      <div class="nash-session-opp-sechead">
        <h3>${esc(s.title)}</h3>
        ${s.note ? `<span>${esc(s.note)}</span>` : ''}
      </div>
      <div class="nash-session-opp-grid">
        ${s.fields.map((f) => fieldHtml(f, opp[f.key] ?? '')).join('')}
      </div>
    </section>`).join('');
  return `<form class="nash-session-opp" autocomplete="off">
    <div class="nash-session-opp-banner">
      <span>Simulated — these fields will sync with Workfront once connected.</span>
      <button type="button" class="nash-session-opp-prefill">Prefill from assessment</button>
    </div>
    ${sections}
    <div class="nash-session-opp-savebar">
      <span class="nash-session-opp-saved" aria-live="polite"></span>
      <button type="submit" class="nash-session-opp-save">Save</button>
    </div>
  </form>`;
}

/**
 * Wires the Opp form: tone updates, auto-growing textareas, prefill, and save.
 * @param {Element} block the nash-session block
 * @param {object} a the assessment
 * @param {(data:object)=>void} onSave called with the collected field values
 * @param {string} userName signed-in user, for prefill
 */
export function wireOppPanel(block, a, onSave, userName = '') {
  const form = block.querySelector('.nash-session-opp');
  if (!form) return;

  const grow = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };
  form.querySelectorAll('.nash-session-opp-textarea').forEach((t) => {
    t.addEventListener('input', () => grow(t));
    grow(t);
  });
  form.querySelectorAll('.nash-session-opp-select').forEach((sel) => {
    sel.addEventListener('change', () => { sel.dataset.tone = toneFor(sel.value); });
  });

  const saved = form.querySelector('.nash-session-opp-saved');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    onSave(data);
    saved.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  form.querySelector('.nash-session-opp-prefill')?.addEventListener('click', () => {
    const defaults = defaultOpp(a, userName);
    Object.entries(defaults).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el && !el.value && v) {
        el.value = v;
        if (el.matches('select')) el.dataset.tone = toneFor(v);
      }
    });
    form.querySelectorAll('.nash-session-opp-textarea').forEach(grow);
  });
}
