/*
 * Opp Management for a Nash assessment — a left icon-nav with four views:
 * Adobe info, Customer info, Touchpoints, and Request. Mirrors the Workfront
 * "TPS Tech Driver Project" + "TPS Opportunity Touchpoints" data.
 *
 * Everything is simulated and stored on assessment.opp; the field config, the
 * touchpoint types, and the single save hook are structured so this can later
 * read/write Workfront (via the WFT MCP / API) without touching the UI.
 *
 * NOTE: dropdown option lists are best-guess defaults — confirm against the real
 * Workfront custom-form values when we connect.
 */

const ICON = {
  adobe: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5 20.5 20h-5.2L12 12.4 8.7 20H3.5z"/></svg>',
  customer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V7l7-4 7 4v14"/><path d="M17 11h4v10"/><path d="M7 8h.01M10 8h.01M7 12h.01M10 12h.01M7 16h.01M10 16h.01"/></svg>',
  touchpoints: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 6H14a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h.5"/></svg>',
  request: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1z"/><path d="M9 4h6"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M10 9l4 2.5-4 2.5z" fill="currentColor"/><line x1="8" y1="22" x2="16" y2="22"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a1.5 1.5 0 0 0-3 0v5m0-1V4.5a1.5 1.5 0 0 0-3 0V11m0-1.5v-4a1.5 1.5 0 0 0-3 0V13m0-3.5a1.5 1.5 0 0 0-3 0V16a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6v-3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  lifebuoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.9" y1="4.9" x2="9.2" y2="9.2"/><line x1="14.8" y1="14.8" x2="19.1" y2="19.1"/><line x1="14.8" y1="9.2" x2="19.1" y2="4.9"/><line x1="4.9" y1="19.1" x2="9.2" y2="14.8"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

const STATUS = ['Not Started', 'In Progress', 'Complete', 'Not Required'];
const SALES_STAGES = ['Stage 1 - Discover', 'Stage 2 - Scope', 'Stage 3 - Qualification', 'Stage 4 - Propose', 'Stage 5 - Negotiate', 'Closed Won', 'Closed Lost'];
const TP_STATUS = ['New', 'In Progress', 'Complete', 'Non-Applicable'];

const NAV = [
  { id: 'request', label: 'Request', icon: 'request' },
  { id: 'adobe', label: 'Adobe info', icon: 'adobe' },
  { id: 'customer', label: 'Customer info', icon: 'customer' },
  { id: 'touchpoints', label: 'Touchpoints', icon: 'touchpoints' },
];

// Fields per view (Touchpoints is handled separately).
const VIEW_FIELDS = {
  request: [
    {
      key: 'oppName', label: 'Opportunity & Tech Driver', type: 'text', wide: true,
    },
    {
      key: 'dynamicsUrl', label: 'Dynamics 365 Opp URL', type: 'text', wide: true,
    },
    { key: 'businessDriver', label: 'Business Driver', type: 'text' },
    { key: 'closeDate', label: 'Close Date', type: 'date' },
    {
      key: 'salesStage', label: 'Sales Stage', type: 'select', options: SALES_STAGES,
    },
    { key: 'gnarr', label: 'DX Total GNARR', type: 'text' },
    { key: 'renewedArr', label: 'DX Total Renewed ARR', type: 'text' },
    {
      key: 'requestSummary', label: 'Request Summary', type: 'textarea', wide: true,
    },
  ],
  adobe: [
    { key: 'techDriver', label: 'Tech Driver', type: 'text' },
    { key: 'primaryEa', label: 'Primary EA', type: 'text' },
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
      key: 'techRiskCategory', label: 'Opp Tech Risk Category', type: 'select', options: ['None', 'Technical Gap', 'Competitive', 'Commercial', 'Security / Compliance', 'Resourcing', 'Timeline'],
    },
    {
      key: 'riskComments', label: 'Tech Risk Comments / Mitigation', type: 'textarea', wide: true,
    },
  ],
  customer: [
    {
      key: 'businessObjectives', label: 'Top 3-4 Business Objectives', type: 'textarea', wide: true,
    },
    {
      key: 'pains', label: 'Top 3-4 Pains / Challenges', type: 'textarea', wide: true,
    },
    {
      key: 'techStack', label: 'Current Tech Stack', type: 'textarea', wide: true,
    },
    {
      key: 'successLooksLike', label: 'What Does Success Look Like?', type: 'textarea', wide: true,
    },
    {
      key: 'useCases', label: 'Top 3-4 Use Cases', type: 'textarea', wide: true,
    },
    {
      key: 'execSummary', label: 'Executive Summary', type: 'textarea', wide: true,
    },
  ],
};

const TOUCHPOINT_TYPES = [
  { type: 'internal-alignment', label: 'Internal Alignment', icon: 'users' },
  { type: 'discovery', label: 'Discovery', icon: 'search' },
  { type: 'customer-journey', label: 'Customer Journey', icon: 'route' },
  { type: 'rfx-advisory', label: 'RFx Advisory', icon: 'clipboard' },
  { type: 'architecture-review', label: 'Architecture Review', icon: 'layers' },
  { type: 'live-demo', label: 'Live Demo', icon: 'play' },
  { type: 'hands-on', label: 'Hands-On Experience', icon: 'hand' },
  { type: 'security-review', label: 'Security Review', icon: 'shield' },
  { type: 'customer-meeting', label: 'Customer Meeting', icon: 'calendar' },
  { type: 'deal-sizing', label: 'Deal Sizing', icon: 'dollar' },
  { type: 'post-sales', label: 'Post-Sales Support', icon: 'lifebuoy' },
  { type: 'nsom', label: 'Northstar Operating Model', icon: 'target' },
];

function typeMeta(type) {
  return TOUCHPOINT_TYPES.find((t) => t.type === type) || { label: type, icon: 'clipboard' };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toneFor(value) {
  const s = String(value).toLowerCase();
  if (!s || /not required|not started|non-applicable|n\/a|none|^new$/.test(s)) return '';
  if (/high risk|at risk|lost|blocked|no fit/.test(s)) return 'danger';
  if (/in progress|medium|pending|required/.test(s)) return 'warn';
  if (/low risk|complete|confirmed|won|good fit|strong/.test(s)) return 'ok';
  return '';
}

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
  const wide = f.wide ? ' wide' : '';
  const label = `<span class="nash-session-opp-label">${esc(f.label)}</span>`;
  if (f.type === 'textarea') {
    return `<label class="nash-session-opp-field${wide}" for="${id}">${label}
      <textarea id="${id}" name="${f.key}" rows="2" class="nash-session-opp-textarea">${esc(value)}</textarea></label>`;
  }
  if (f.type === 'select') {
    const opts = ['', ...f.options]
      .map((o) => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${o ? esc(o) : '—'}</option>`)
      .join('');
    return `<label class="nash-session-opp-field${wide}" for="${id}">${label}
      <select id="${id}" name="${f.key}" class="nash-session-opp-select" data-tone="${toneFor(value)}">${opts}</select></label>`;
  }
  const type = f.type === 'date' ? 'date' : 'text';
  return `<label class="nash-session-opp-field${wide}" for="${id}">${label}
    <input id="${id}" name="${f.key}" type="${type}" class="nash-session-opp-input" value="${esc(value)}"></label>`;
}

function viewFieldsHtml(viewId, opp) {
  return `<div class="nash-session-opp-grid">${
    VIEW_FIELDS[viewId].map((f) => fieldHtml(f, opp[f.key] ?? '')).join('')
  }</div>`;
}

function statusOptions(status) {
  return TP_STATUS.map((o) => `<option value="${o}"${o === status ? ' selected' : ''}>${o}</option>`).join('');
}

/* A saved touchpoint shown on the main screen as a compact icon tile. */
function tileHtml(tp) {
  const meta = typeMeta(tp.type);
  return `<button type="button" class="nash-opp-tptile" data-tp-id="${esc(tp.id)}" data-tone="${toneFor(tp.status)}">
    <span class="nash-opp-tptile-remove" data-remove aria-label="Remove">${ICON.close}</span>
    <span class="nash-opp-tptile-icon">${ICON[meta.icon] || ICON.clipboard}</span>
    <span class="nash-opp-tptile-name">${esc(tp.name || meta.label)}</span>
    <span class="nash-opp-tptile-status">${esc(tp.status || '')}</span>
  </button>`;
}

function touchpointsAreaHtml(touchpoints) {
  if (!touchpoints.length) {
    return `<div class="nash-opp-empty">
      <button type="button" class="nash-opp-addbig" aria-label="Add touchpoints">${ICON.plus}</button>
      <p>No touchpoints yet.<br>Add the engagement touchpoints for this opportunity.</p>
    </div>`;
  }
  return `<div class="nash-opp-tpgrid">
    ${touchpoints.map(tileHtml).join('')}
    <button type="button" class="nash-opp-tptile nash-opp-tptile-add" aria-label="Add touchpoints">
      <span class="nash-opp-tptile-icon">${ICON.plus}</span>
      <span class="nash-opp-tptile-name">Add</span>
    </button>
  </div>`;
}

/* One touchpoint's editable detail block — shown inside the modal. */
function detailHtml(meta, tp = {}) {
  const idAttr = tp.id ? ` data-tp-id="${esc(tp.id)}"` : '';
  const status = tp.status || 'New';
  return `<div class="nash-opp-detail" data-type="${meta.type}"${idAttr}>
    <div class="nash-opp-detail-head">
      <span class="nash-opp-detail-icon">${ICON[meta.icon] || ICON.clipboard}</span>
      <input class="nash-opp-detail-name" data-detail-field="name" value="${esc(tp.name || meta.label)}" aria-label="Touchpoint name">
      <select class="nash-session-opp-select nash-opp-detail-status" data-detail-field="status" data-tone="${toneFor(status)}">${statusOptions(status)}</select>
    </div>
    <textarea class="nash-session-opp-textarea" data-detail-field="comments" rows="2" placeholder="Solution comments…">${esc(tp.comments || '')}</textarea>
    <div class="nash-opp-detail-row">
      <label class="nash-session-opp-field"><span class="nash-session-opp-label">Date</span>
        <input type="date" class="nash-session-opp-input" data-detail-field="date" value="${esc(tp.date || '')}"></label>
      <label class="nash-session-opp-field"><span class="nash-session-opp-label">Assignments</span>
        <input type="text" class="nash-session-opp-input" data-detail-field="assignments" value="${esc(tp.assignments || '')}"></label>
      <label class="nash-session-opp-field"><span class="nash-session-opp-label">Links</span>
        <input type="text" class="nash-session-opp-input" data-detail-field="links" value="${esc(tp.links || '')}"></label>
    </div>
  </div>`;
}

function modalHtml() {
  const cards = TOUCHPOINT_TYPES.map((t) => `
    <button type="button" class="nash-opp-typecard" data-type="${t.type}">
      <span class="nash-opp-typecard-icon">${ICON[t.icon]}</span>
      <span>${esc(t.label)}</span>
    </button>`).join('');
  return `<div class="nash-opp-modal" hidden data-mode="add">
    <div class="nash-opp-modal-card" role="dialog" aria-modal="true" aria-label="Touchpoints">
      <div class="nash-opp-modal-head">
        <h3 class="nash-opp-modal-title">Add touchpoints</h3>
        <button type="button" class="nash-opp-modal-close" aria-label="Close">${ICON.close}</button>
      </div>
      <p class="nash-opp-modal-sub">Choose one or more types, then fill in the details below.</p>
      <div class="nash-opp-typegrid">${cards}</div>
      <div class="nash-opp-details"></div>
      <div class="nash-opp-modal-foot">
        <button type="button" class="nash-opp-modal-cancel">Cancel</button>
        <button type="button" class="nash-opp-modal-add" disabled>Save</button>
      </div>
    </div>
  </div>`;
}

/** Returns the Opp Management HTML (icon-nav + views + touchpoint modal). */
export function renderOppPanel(a, userName = '') {
  const opp = { ...defaultOpp(a, userName), ...(a.opp || {}) };
  const touchpoints = Array.isArray(opp.touchpoints) ? opp.touchpoints : [];
  const nav = NAV.map((n, i) => `
    <button type="button" class="nash-opp-navbtn${i === 0 ? ' active' : ''}" data-view="${n.id}" title="${n.label}">
      ${ICON[n.icon]}<span>${n.label}</span>
    </button>`).join('');
  const view = (id, inner) => `<div class="nash-opp-view${id === 'request' ? ' active' : ''}" data-view="${id}">${inner}</div>`;
  return `<form class="nash-session-opp" autocomplete="off">
    <div class="nash-session-opp-banner">
      <span>Simulated — syncs with Workfront once connected.</span>
      <span class="nash-opp-bannerright">
        <span class="nash-session-opp-saved" aria-live="polite"></span>
        <button type="button" class="nash-session-opp-prefill">Prefill from assessment</button>
      </span>
    </div>
    <div class="nash-session-opp-main">
      <nav class="nash-session-opp-nav">${nav}</nav>
      <div class="nash-session-opp-body">
        ${view('request', viewFieldsHtml('request', opp))}
        ${view('adobe', viewFieldsHtml('adobe', opp))}
        ${view('customer', viewFieldsHtml('customer', opp))}
        ${view('touchpoints', `<div class="nash-opp-tparea">${touchpointsAreaHtml(touchpoints)}</div>`)}
      </div>
    </div>
    ${modalHtml()}
  </form>`;
}

/**
 * Wires the Opp panel: nav switching, auto-save, prefill, touchpoint add/edit/remove.
 * @param {Element} block the nash-session block
 * @param {object} a the assessment
 * @param {(data:object)=>void} onSave called with the full opp state on any change
 * @param {string} userName signed-in user, for prefill
 */
export function wireOppPanel(block, a, onSave, userName = '') {
  const form = block.querySelector('.nash-session-opp');
  if (!form) return;
  const stored = Array.isArray(a.opp?.touchpoints) ? a.opp.touchpoints : [];
  const touchpoints = stored.map((t) => ({ ...t }));
  const saved = form.querySelector('.nash-session-opp-saved');
  const tparea = form.querySelector('.nash-opp-tparea');
  const modal = form.querySelector('.nash-opp-modal');

  const grow = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };
  const growAll = () => form.querySelectorAll('.nash-session-opp-textarea').forEach(grow);

  const collect = () => {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    data.touchpoints = touchpoints;
    return data;
  };
  const save = () => {
    onSave(collect());
    saved.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Nav switching.
  form.querySelectorAll('.nash-opp-navbtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.nash-opp-navbtn').forEach((b) => b.classList.toggle('active', b === btn));
      form.querySelectorAll('.nash-opp-view').forEach((v) => v.classList.toggle('active', v.dataset.view === btn.dataset.view));
      growAll();
    });
  });

  // Auto-save + tone on the main fields.
  form.addEventListener('input', (e) => {
    if (e.target.matches('.nash-session-opp-textarea')) grow(e.target);
    if (e.target.closest('.nash-opp-tp')) return; // touchpoints handled below
    if (e.target.matches('[name]')) save();
  });
  form.addEventListener('change', (e) => {
    if (e.target.matches('.nash-session-opp-select') && !e.target.closest('.nash-opp-tp')) {
      e.target.dataset.tone = toneFor(e.target.value);
    }
    if (e.target.matches('[name]') && !e.target.closest('.nash-opp-tp')) save();
  });

  // Prefill.
  form.querySelector('.nash-session-opp-prefill')?.addEventListener('click', () => {
    const defaults = defaultOpp(a, userName);
    Object.entries(defaults).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el && !el.value && v) {
        el.value = v;
        if (el.matches('select')) el.dataset.tone = toneFor(v);
      }
    });
    growAll();
    save();
  });

  // ── Touchpoints ──
  const details = modal.querySelector('.nash-opp-details');
  const modalTitle = modal.querySelector('.nash-opp-modal-title');
  const modalAdd = modal.querySelector('.nash-opp-modal-add');
  let editingId = null;

  const renderTp = () => { tparea.innerHTML = touchpointsAreaHtml(touchpoints); };
  const growModal = () => details.querySelectorAll('.nash-session-opp-textarea').forEach(grow);
  const refreshAddState = () => {
    if (modal.dataset.mode === 'add') modalAdd.disabled = !details.querySelector('.nash-opp-detail');
  };
  const newId = () => `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const closeModal = () => { modal.hidden = true; };

  const openAdd = () => {
    editingId = null;
    modal.dataset.mode = 'add';
    modalTitle.textContent = 'Add touchpoints';
    modal.querySelectorAll('.nash-opp-typecard').forEach((c) => c.classList.remove('selected'));
    details.innerHTML = '';
    modalAdd.disabled = true;
    modal.hidden = false;
  };
  const openEdit = (tp) => {
    editingId = tp.id;
    modal.dataset.mode = 'edit';
    modalTitle.textContent = 'Edit touchpoint';
    details.innerHTML = detailHtml(typeMeta(tp.type), tp);
    modalAdd.disabled = false;
    modal.hidden = false;
    growModal();
  };

  const collectDetail = (b) => {
    const d = { type: b.dataset.type };
    b.querySelectorAll('[data-detail-field]').forEach((el) => { d[el.dataset.detailField] = el.value; });
    return d;
  };

  tparea.addEventListener('click', (e) => {
    if (e.target.closest('.nash-opp-addbig, .nash-opp-tptile-add')) { openAdd(); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      e.stopPropagation();
      const id = rm.closest('.nash-opp-tptile').dataset.tpId;
      const idx = touchpoints.findIndex((t) => t.id === id);
      if (idx > -1) { touchpoints.splice(idx, 1); renderTp(); save(); }
      return;
    }
    const tile = e.target.closest('.nash-opp-tptile');
    if (tile && tile.dataset.tpId) {
      const tp = touchpoints.find((t) => t.id === tile.dataset.tpId);
      if (tp) openEdit(tp);
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.nash-opp-modal-close, .nash-opp-modal-cancel')) {
      closeModal();
      return;
    }
    // Toggle a type (add mode) → show/hide its detail block.
    const card = e.target.closest('.nash-opp-typecard');
    if (card && modal.dataset.mode === 'add') {
      const { type } = card.dataset;
      card.classList.toggle('selected');
      const existing = details.querySelector(`.nash-opp-detail[data-type="${type}"]`);
      if (card.classList.contains('selected') && !existing) {
        details.insertAdjacentHTML('beforeend', detailHtml(typeMeta(type)));
        growModal();
      } else if (existing) {
        existing.remove();
      }
      refreshAddState();
      return;
    }
    // Save.
    if (e.target.closest('.nash-opp-modal-add')) {
      if (modal.dataset.mode === 'edit') {
        const b = details.querySelector('.nash-opp-detail');
        const tp = touchpoints.find((t) => t.id === editingId);
        if (tp && b) Object.assign(tp, collectDetail(b));
      } else {
        details.querySelectorAll('.nash-opp-detail').forEach((b) => {
          touchpoints.push({
            id: newId(), status: 'New', comments: '', date: '', assignments: '', links: '', ...collectDetail(b),
          });
        });
      }
      closeModal();
      renderTp();
      save();
    }
  });

  // Detail-block interactions inside the modal.
  modal.addEventListener('input', (e) => { if (e.target.matches('.nash-session-opp-textarea')) grow(e.target); });
  modal.addEventListener('change', (e) => {
    if (e.target.matches('.nash-opp-detail-status')) e.target.dataset.tone = toneFor(e.target.value);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  growAll();
}
