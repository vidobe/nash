/* eslint-disable no-use-before-define */

import { streamQualification } from '../../scripts/fluffyjaws.js';
import {
  saveAssessment, getAssessment, newAssessmentId,
} from '../../scripts/nash-assessments.js';
import { isAuthenticated, login, getUserInfo } from '../../scripts/nash-auth.js';
import { publishAssessment } from '../../scripts/da-publish.js';
import { renderOppPanel, wireOppPanel } from '../../scripts/nash-opp.js';
import { logActivity } from '../../scripts/nash-activity.js';
import {
  PILLARS, SOLUTION_PILLARS, SOLUTION_TILES,
} from '../nash-solutions/nash-solutions.js';

let previousResponseId = null;
let current = null; // assessment being viewed in chat mode
// True while an assessment is actively streaming from FluffyJaws. Used to warn
// before navigating away (the stream can't survive a full page load) and to
// resume an interrupted run when the session is re-opened.
let isRunning = false;
// Whether FluffyJaws already has this assessment's context in the current thread.
// Reset on every (re)open so the first follow-up re-sends the report — FluffyJaws
// response IDs expire server-side, so we can't rely on a stored previousResponseId.
let chatGrounded = false;
// Documents attached in the composer, to fold into the next Fluffy message.
let pendingDocs = [];
let publishRetryTimer = null;

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  layers: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  attach: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  send: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  upload: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  doc: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1z"/><path d="M9 4h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>',
  quality: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  sales: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  postsales: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>',
  experiment: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v6.2l-5.3 8.6A2.1 2.1 0 0 0 6.5 21h11a2.1 2.1 0 0 0 1.8-3.2L14 9.2V3"/><path d="M8 15h8"/></svg>',
  plusadd: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

const EXPERIMENT_USER_EMAIL = 'vgabriel@adobe.com';

const TABS = [
  { tab: 'assessment', icon: 'clipboard', label: 'Assessment' },
  {
    tab: 'experiment', icon: 'experiment', label: 'Experimental report', experiment: true,
  },
  { tab: 'decision', icon: 'quality', label: 'Decision quality' },
  { tab: 'da', icon: 'cloud', label: 'DA content' },
  { tab: 'opp', icon: 'briefcase', label: 'Opp management' },
  // Audience-targeted outputs — placeholders for now, no generation logic yet.
  { tab: 'sales', icon: 'sales', label: 'Sales content' },
  { tab: 'postsales', icon: 'postsales', label: 'Post-sales content' },
];

function canViewReportExperiment() {
  return getUserInfo()?.email?.trim().toLowerCase() === EXPERIMENT_USER_EMAIL;
}

function visibleTabs() {
  return TABS.filter((tab) => !tab.experiment || canViewReportExperiment());
}

const SETUP_PROGRESS_MESSAGES = [
  'Reading the fine print so you do not have to…',
  'Separating customer needs from procurement poetry…',
  'Checking which Adobe products have earned a seat at the table…',
  'Following the evidence, not the logo count…',
];

// Small banner marking a tab whose content is still being built.
function constructionNote() {
  return '<div class="nash-session-wip" role="note">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    + '<span>This section is still in construction — content and layout may change.</span></div>';
}

// Placeholder panel for an audience tab that has no generation logic yet.
function audiencePlaceholder(label) {
  return `<div class="nash-session-placeholder">
      <p class="nash-session-placeholder-title">${escapeHtml(label)}</p>
      <p class="nash-session-placeholder-note">Coming soon — this view will generate ${escapeHtml(label.toLowerCase())} tailored to its audience.</p>
    </div>`;
}

/* Pre-assessment interview. Nash extracts what it can from the uploaded docs,
   then interviews the analyst about ONLY the gaps. The first three items are
   analyst knowledge that's rarely written in an RFP/RFI, so they're asked
   unless the documents explicitly cover them. Solution-agnostic by design. */
const INTERVIEW_ITEMS = [
  { key: 'meetingNotes', q: 'Any meeting notes or call summaries we should factor in? Paste the key points (or say "none").' },
  { key: 'rfpInfluence', q: 'Did we (Adobe) help shape or influence this RFI/RFP? If so, how — and does the wording favour us?' },
  { key: 'champions', q: 'Do we have known champions or blockers on the customer side? Who are they, and where do they stand?' },
  { key: 'customerContext', q: 'Customer context not already in the docs — industry, segment, and geography?' },
  { key: 'techStack', q: 'Current tech stack (CMS / MarTech / CRM / CDP / analytics / commerce) and any existing Adobe footprint?' },
  { key: 'competitors', q: 'Known incumbents or competitors in play — is this a competitive bake-off?' },
  { key: 'kpis', q: 'Target KPIs, success metrics, or ROI expectations?' },
  { key: 'budgetTiming', q: 'Budget signals, fiscal-year timing, or urgency?' },
  { key: 'decisionCriteria', q: 'The main criteria the customer will judge the decision on?' },
  { key: 'useCases', q: 'Specific capabilities or use cases the customer has explicitly asked for?' },
];
// Analyst-knowledge items — asked unless the docs EXPLICITLY cover them.
const MANDATORY_INTERVIEW_KEYS = ['meetingNotes', 'rfpInfluence', 'champions'];

const LAUNCH = [
  {
    action: 'new', icon: 'plus', text: 'Create a new analysis', desc: 'Upload an RFP and start a qualification',
  },
  {
    action: 'find', icon: 'search', text: 'Find a previous analysis', desc: 'Browse your assessments',
  },
  {
    action: 'skills', icon: 'layers', text: 'Skills & solution files', desc: 'Review what Nash scores against',
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function splitRow(line) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/* Minimal, safe markdown → HTML for replies (escapes first). Handles headings,
   lists, inline styles, links, and GFM tables.
   With `{ headings: 'real' }` it emits real <h2>–<h6> tags (used for the
   published page, where the nash-qualification block splits the report into
   sections by heading and EDS strips custom <p> classes); otherwise it emits
   styled `<p class="nash-md-h">` for the in-app chat/preview. */
function renderMarkdown(src, { headings = 'p' } = {}) {
  const lines = escapeHtml(src).split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const isSep = (l) => l && /\|/.test(l) && /^[\s|:-]+$/.test(l.trim()) && l.includes('-');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (line.includes('|') && isSep(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i].trimEnd()));
        i += 1;
      }
      out.push(`<table class="nash-md-table"><thead><tr>${header.map((h) => `<th>${inlineMd(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else {
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      const ul = line.match(/^[-*]\s+(.*)$/);
      const ol = line.match(/^\d+\.\s+(.*)$/);
      if (h) {
        closeList();
        if (headings === 'real') {
          // Offset by one so the page's single <h1> title stays unique and the
          // top-level "N. …" sections land on <h2> (what the block splits on).
          const lvl = Math.min(h[1].length + 1, 6);
          out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`);
        } else {
          out.push(`<p class="nash-md-h" data-lvl="${h[1].length}">${inlineMd(h[2])}</p>`);
        }
      } else if (ul) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inlineMd(ul[1])}</li>`);
      } else if (ol) {
        if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${inlineMd(ol[1])}</li>`);
      } else if (!line) {
        closeList();
      } else {
        closeList();
        out.push(`<p>${inlineMd(line)}</p>`);
      }
      i += 1;
    }
  }
  closeList();
  return out.join('');
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
}

/* ── Architecture diagram (Spectrum-styled, no build/deps) ──────────────
   FluffyJaws emits a machine-readable NASH_ARCH block in Section 4; we render
   it as a layered boxes-and-arrows SVG. A mermaid flowchart fence is accepted
   as a fallback so older/looser output still draws instead of dumping text. */

const ARCH_FLOWS = ['ingress', 'intra', 'egress'];

function parseArch(text) {
  const arch = {
    layers: [], groups: [], nodes: [], edges: [],
  };
  text.split('\n').forEach((line) => {
    const l = line.trim();
    if (!l) return;
    let m = l.match(/^layers?\s*:\s*(.+)$/i);
    if (m) { arch.layers = m[1].split(/[;|]/).map((s) => s.trim()).filter(Boolean); return; }
    m = l.match(/^group\s*:\s*(.+)$/i);
    if (m) {
      const p = m[1].split('|').map((s) => s.trim());
      if (p[0]) arch.groups.push({ id: p[0], label: p[1] || p[0], layer: p[2] || '' });
      return;
    }
    m = l.match(/^node\s*:\s*(.+)$/i);
    if (m) {
      const p = m[1].split('|').map((s) => s.trim());
      if (p[0]) {
        arch.nodes.push({
          id: p[0], label: p[1] || p[0], layer: p[2] || '', group: p[3] || '',
        });
      }
      return;
    }
    m = l.match(/^edge\s*:\s*(.+)$/i);
    if (m) {
      const p = m[1].split('|').map((s) => s.trim());
      if (p[0] && p[1]) {
        let type = 'intra';
        let label = p[2] || '';
        if (p[2] && ARCH_FLOWS.includes(p[2].toLowerCase())) { type = p[2].toLowerCase(); label = p[3] || ''; }
        arch.edges.push({
          from: p[0], to: p[1], type, label,
        });
      }
    }
  });
  return arch;
}

/* Best-effort parse of a mermaid flowchart into the same node/edge model. */
function parseMermaidFlow(code) {
  const arch = {
    layers: [], groups: [], nodes: [], edges: [],
  };
  const labels = new Map();
  const grab = (token) => {
    const m = (token || '').trim().match(/^([A-Za-z0-9_]+)\s*(?:\[(.+?)\]|\((.+?)\)|\{(.+?)\})?$/);
    if (!m) return null;
    return { id: m[1], label: (m[2] || m[3] || m[4] || '').trim() };
  };
  code.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line || /^(flowchart|graph|subgraph|end|%%)/i.test(line)) return;
    if (line.includes('-->')) {
      const parts = line.split('-->').map((s) => s.trim());
      for (let k = 0; k < parts.length - 1; k += 1) {
        let right = parts[k + 1];
        let elabel = '';
        const lm = right.match(/^\|(.+?)\|\s*(.*)$/);
        if (lm) { [, elabel, right] = lm; parts[k + 1] = right; }
        const L = grab(parts[k]);
        const R = grab(right);
        if (L) labels.set(L.id, L.label || labels.get(L.id) || L.id);
        if (R) labels.set(R.id, R.label || labels.get(R.id) || R.id);
        if (L && R) {
          arch.edges.push({
            from: L.id, to: R.id, type: 'intra', label: elabel,
          });
        }
      }
    } else {
      const N = grab(line);
      if (N) labels.set(N.id, N.label || labels.get(N.id) || N.id);
    }
  });
  arch.nodes = [...labels].map(([id, label]) => ({
    id, label, layer: '', group: '',
  }));
  return arch;
}

/* Assign each node a column index: by declared layers, else by flow depth. */
function archColumnIndex(arch) {
  const byId = new Map(arch.nodes.map((n) => [n.id, n]));
  const groupById = new Map(arch.groups.map((g) => [g.id, g]));
  const colOf = new Map();
  if (arch.layers.length) {
    const idx = new Map(arch.layers.map((l, i) => [l.toLowerCase(), i]));
    const extra = arch.layers.length;
    arch.nodes.forEach((n) => {
      let c = idx.has((n.layer || '').toLowerCase()) ? idx.get((n.layer || '').toLowerCase()) : -1;
      if (c < 0 && n.group && groupById.has(n.group)) {
        const gl = (groupById.get(n.group).layer || '').toLowerCase();
        if (idx.has(gl)) c = idx.get(gl);
      }
      colOf.set(n.id, c < 0 ? extra : c);
    });
    return colOf;
  }
  // No layers → longest-path levelling from the roots.
  const adj = new Map(arch.nodes.map((n) => [n.id, []]));
  const indeg = new Map(arch.nodes.map((n) => [n.id, 0]));
  arch.edges.forEach((e) => {
    if (adj.has(e.from) && byId.has(e.to)) {
      adj.get(e.from).push(e.to);
      indeg.set(e.to, indeg.get(e.to) + 1);
    }
  });
  const queue = arch.nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  const seen = new Set(queue);
  queue.forEach((id) => colOf.set(id, 0));
  for (let h = 0; h < queue.length; h += 1) {
    const u = queue[h];
    (adj.get(u) || []).forEach((v) => {
      colOf.set(v, Math.max(colOf.get(v) || 0, (colOf.get(u) || 0) + 1));
      if (!seen.has(v)) { seen.add(v); queue.push(v); }
    });
  }
  arch.nodes.forEach((n) => { if (!colOf.has(n.id)) colOf.set(n.id, 0); });
  return colOf;
}

/* Build ordered columns of cells (a cell is a standalone node or a group box). */
function archColumns(arch) {
  const groupById = new Map(arch.groups.map((g) => [g.id, g]));
  const colOf = archColumnIndex(arch);
  const numCols = Math.max(0, ...colOf.values()) + 1;
  const columns = Array.from({ length: numCols }, () => ({ label: '', cells: [], byGroup: new Map() }));
  arch.layers.forEach((l, i) => { if (columns[i]) columns[i].label = l; });
  arch.nodes.forEach((n) => {
    const col = columns[colOf.get(n.id)];
    if (!col) return;
    if (n.group && groupById.has(n.group)) {
      let gc = col.byGroup.get(n.group);
      if (!gc) {
        gc = { type: 'group', group: groupById.get(n.group), nodes: [] };
        col.byGroup.set(n.group, gc);
        col.cells.push(gc);
      }
      gc.nodes.push(n);
    } else {
      col.cells.push({ type: 'node', node: n });
    }
  });
  return columns.filter((c) => c.cells.length);
}

/* Collapse duplicate nodes: exact id repeats are dropped, and same label+layer
   nodes with different ids are merged (edges re-pointed to the kept node).
   Also removes duplicate and self edges so the diagram stays clean. */
function dedupeArch(arch) {
  const byId = new Set();
  const byLabel = new Map();
  const alias = new Map();
  const nodes = [];
  arch.nodes.forEach((n) => {
    if (byId.has(n.id)) return;
    const lk = `${(n.label || '').toLowerCase()}|${(n.layer || '').toLowerCase()}`;
    if (byLabel.has(lk)) { alias.set(n.id, byLabel.get(lk)); return; }
    byId.add(n.id);
    byLabel.set(lk, n.id);
    nodes.push(n);
  });
  const seen = new Set();
  const edges = [];
  arch.edges.forEach((e) => {
    const from = alias.get(e.from) || e.from;
    const to = alias.get(e.to) || e.to;
    if (from === to) return;
    const k = `${from}>${to}>${e.type}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ ...e, from, to });
  });
  return { ...arch, nodes, edges };
}

function archToHtml(archIn) {
  if (!archIn || !archIn.nodes.length) return '';
  const arch = dedupeArch(archIn);
  const cols = archColumns(arch);
  if (!cols.length) return '';
  const showLayers = cols.some((c) => c.label);
  const BW = 178; const BH = 50; const CG = 92; const RG = 20; const PAD = 16;
  const GH = 24; const GP = 10; const LH = showLayers ? 26 : 0;
  const colX = (ci) => PAD + ci * (BW + CG);
  const nodeBox = (n, x, y) => `<foreignObject x="${x}" y="${y}" width="${BW}" height="${BH}"><div xmlns="http://www.w3.org/1999/xhtml" class="nash-arch-node"><span>${escapeHtml(n.label)}</span></div></foreignObject>`;
  const pos = new Map();
  const boxes = [];
  const groups = [];
  let maxBottom = 0;
  cols.forEach((col, ci) => {
    const x = colX(ci);
    let y = PAD + LH;
    col.cells.forEach((cell) => {
      if (cell.type === 'node') {
        pos.set(cell.node.id, { x, y });
        boxes.push(nodeBox(cell.node, x, y));
        y += BH + RG;
        return;
      }
      const top = y;
      const innerTop = top + GH + GP;
      cell.nodes.forEach((n, ri) => {
        const ny = innerTop + ri * (BH + RG);
        pos.set(n.id, { x, y: ny });
        boxes.push(nodeBox(n, x, ny));
      });
      const gh = GH + GP * 2 + cell.nodes.length * BH + Math.max(0, cell.nodes.length - 1) * RG;
      groups.push(`<rect class="nash-arch-group" x="${x - GP}" y="${top}" width="${BW + GP * 2}" height="${gh}" rx="8"/><rect class="nash-arch-ghead" x="${x - GP}" y="${top}" width="${BW + GP * 2}" height="${GH}" rx="8"/><text class="nash-arch-gtext" x="${x + BW / 2}" y="${top + 16}" text-anchor="middle">${escapeHtml(cell.group.label)}</text>`);
      y = top + gh + RG;
    });
    maxBottom = Math.max(maxBottom, y);
  });
  const W = PAD * 2 + cols.length * BW + (cols.length - 1) * CG;
  const H = maxBottom - RG + PAD;
  const uid = `n${Math.random().toString(36).slice(2, 8)}`;
  const used = new Set();
  const wires = arch.edges.map((e) => {
    const a = pos.get(e.from); const b = pos.get(e.to);
    if (!a || !b) return '';
    used.add(e.type);
    const sx = a.x + BW; const sy = a.y + BH / 2; const tx = b.x; const ty = b.y + BH / 2;
    let d;
    if (tx > sx) {
      const dx = Math.max(30, (tx - sx) / 2);
      d = `M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx} ${ty}`;
    } else {
      const my = Math.max(sy, ty) + BH;
      d = `M${sx} ${sy} C${sx + 44} ${my} ${tx - 44} ${my} ${tx} ${ty}`;
    }
    return `<path class="nash-arch-wire ${e.type}" d="${d}" marker-end="url(#${uid}-${e.type})"/>`;
  }).join('');
  const layerLabels = cols.map((c, ci) => (c.label ? `<text class="nash-arch-layer" x="${colX(ci) + BW / 2}" y="${PAD + 14}" text-anchor="middle">${escapeHtml(c.label)}</text>` : '')).join('');
  const mk = (id, color) => `<marker id="${uid}-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;
  const defs = mk('ingress', '#1473e6') + mk('intra', '#6b6b6b') + mk('egress', '#eb1000');
  const legNames = { ingress: 'Ingress', intra: 'Intra-system', egress: 'Egress' };
  const order = ARCH_FLOWS.filter((t) => used.has(t));
  const legend = order.length > 1
    ? `<div class="nash-arch-legend">${order.map((t) => `<span class="nash-arch-leg ${t}"><i></i>${legNames[t]}</span>`).join('')}</div>`
    : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Target architecture diagram" preserveAspectRatio="xMidYMid meet"><defs>${defs}</defs>${layerLabels}${groups.join('')}${wires}${boxes.join('')}</svg>`;
  return `<div class="nash-arch">${svg}${legend}</div>`;
}

/* Render report markdown, swapping any NASH_ARCH block (or mermaid fence) for a
   rendered Spectrum diagram. */
/* Replace each NASH_ARCH block with a rendered-diagram token, tolerating a
   missing NASH_ARCH_END (the model often omits it): from a `NASH_ARCH:` line,
   consume the following layers/group/node/edge lines until a non-matching line. */
function stripArchBlocks(src, tokenFor) {
  const lines = src.split('\n');
  const out = [];
  const isArchLine = (l) => /^\s*(layers?|group|node|edge)\s*:/i.test(l);
  let i = 0;
  while (i < lines.length) {
    if (/^\s*NASH_ARCH\b/i.test(lines[i]) && !/^\s*NASH_ARCH_END/i.test(lines[i])) {
      i += 1;
      const body = [];
      while (i < lines.length) {
        if (/^\s*NASH_ARCH_END/i.test(lines[i])) { i += 1; break; }
        if (!isArchLine(lines[i]) && !/^\s*$/.test(lines[i])) break;
        body.push(lines[i]);
        i += 1;
      }
      out.push(tokenFor(archToHtml(parseArch(body.join('\n')))));
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return out.join('\n');
}

function evidenceMarkerHtml(id, evidence) {
  const item = evidence.find((entry) => entry.id.toLowerCase() === id.toLowerCase());
  if (!item) return `[[${escapeHtml(id)}]]`;
  const label = [item.source, item.locator].filter(Boolean).join(', ');
  return `<button type="button" class="nash-session-citation" data-evidence-ref="${escapeHtml(item.id)}" aria-label="View evidence ${escapeHtml(item.id)}${label ? `: ${escapeHtml(label)}` : ''}">${escapeHtml(item.id)}</button>`;
}

function renderReportMarkdown(src, opts = {}, evidence = []) {
  const diagrams = [];
  const tokenFor = (html) => {
    if (!html) return '';
    const tok = `ARCH${diagrams.length}`;
    diagrams.push({ tok, html });
    return `\n\n${tok}\n\n`;
  };
  const cleaned = stripArchBlocks(src || '', tokenFor)
    .replace(/```mermaid\s*([\s\S]*?)```/gi, (m, code) => tokenFor(archToHtml(parseMermaidFlow(code))));
  let html = renderMarkdown(cleaned, opts);
  diagrams.forEach(({ tok, html: d }) => {
    html = html.split(`<p>${tok}</p>`).join(d).split(tok).join(d);
  });
  if (evidence.length) {
    html = html.replace(/\[\[([a-z0-9_-]+)\]\]/gi, (match, id) => evidenceMarkerHtml(id, evidence));
  }
  return html;
}

/* ── Launcher ────────────────────────────────────────── */

function renderLauncher(block, name) {
  block.classList.remove('wide');
  block.innerHTML = `
    <div class="nash-session-hero">
      <div class="nash-session-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>
      </div>
      <h1 class="nash-session-greeting">${greeting()}, ${name}</h1>
      <p class="nash-session-sub">What would you like to do?</p>
      <div class="nash-session-launch">
        ${LAUNCH.map((l) => `
          <button class="nash-session-launch-btn" data-action="${l.action}" type="button">
            <span class="nash-session-launch-icon" aria-hidden="true">${ICONS[l.icon]}</span>
            <span class="nash-session-launch-text">
              <span class="nash-session-launch-title">${l.text}</span>
              <span class="nash-session-launch-desc">${l.desc}</span>
            </span>
          </button>
        `).join('')}
      </div>
      <div class="nash-session-conn">
        ${isAuthenticated()
    ? '<span class="nash-session-conn-ok"><span class="nash-session-conn-dot"></span>Connected to FluffyJaws</span>'
    : '<button class="nash-session-conn-btn" type="button">Connect to FluffyJaws to run live assessments</button>'}
      </div>
    </div>
  `;

  block.querySelectorAll('.nash-session-launch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { action } = btn.dataset;
      if (action === 'new') startNewAnalysis(block);
      else if (action === 'find') window.location.href = '/';
      else if (action === 'skills') window.location.href = '/solutions/';
    });
  });

  block.querySelector('.nash-session-conn-btn')?.addEventListener('click', () => login());
}

/* Read every uploaded file: parse spreadsheets/CSV to text in the browser
   (FluffyJaws doesn't reliably mount uploads), else keep the raw bytes. */
async function processFiles(fileList) {
  const files = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const f of fileList) {
    const mime = f.type || '';
    // eslint-disable-next-line no-await-in-loop
    const text = await extractFileText(f);
    let data = '';
    if (!text && f.size <= 4 * 1024 * 1024) {
      // eslint-disable-next-line no-await-in-loop
      data = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => resolve('');
        fr.readAsDataURL(f);
      });
    }
    files.push({
      name: f.name, mime, text, data,
    });
  }
  return files;
}

/* Start a brand-new analysis: open a fresh session and collect the intake
   (customer, DR, documents, solutions) as the first card of the questionnaire,
   rather than in a separate modal. Not persisted until intake is submitted. */
function startNewAnalysis(block) {
  const assessment = {
    id: newAssessmentId(),
    company: '',
    status: 'draft',
    createdAt: Date.now(),
    solutions: [],
    files: [],
    messages: [],
  };
  current = assessment;
  previousResponseId = null;
  window.history.pushState({}, '', `/indextest?a=${encodeURIComponent(assessment.id)}`);
  renderAssessment(block, assessment, true);
}

function setSetupAvailability(block, unavailable) {
  block.classList.toggle('is-setting-up', unavailable);
  block.querySelectorAll('.nash-session-tab').forEach((tab) => {
    tab.disabled = unavailable;
  });
  const input = block.querySelector('.nash-session-input');
  const sendButton = block.querySelector('.nash-session-send');
  if (input) {
    input.disabled = unavailable;
    input.placeholder = unavailable
      ? 'Chat becomes available after setup…'
      : 'Ask Fluffy about this assessment, or add context…';
  }
  if (sendButton) sendButton.disabled = unavailable || !input?.value.trim();
}

function renderIntake() {
  return `<form class="nash-session-intake nash-session-intake-focused">
      <div class="nash-session-intake-copy">
        <span class="nash-session-kicker">New opportunity</span>
        <h2>Start with the customer documents</h2>
        <p>Upload the RFI, RFP, requirements, or discovery notes. Nash will extract
        the customer, objectives, challenges, and likely Adobe scope before asking
        only what is missing.</p>
      </div>
      <label class="nash-session-drop nash-session-drop-hero" for="na-file">
        <span class="nash-session-drop-icon" aria-hidden="true">${ICONS.upload}</span>
        <span class="nash-session-drop-text">Choose documents <span class="nash-session-drop-sub">PDF, Word, Excel, CSV, or text · multiple files welcome</span></span>
        <input id="na-file" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple hidden/>
      </label>
      <button type="button" class="nash-session-start-empty">Start without documents</button>
    </form>`;
}

const SETUP_EVIDENCE_STEPS = [
  'Customer documents loaded',
  'Objectives and requirements identified',
  'Likely Adobe solutions mapped',
  'Summary and questions prepared',
];

const ASSESSMENT_EVIDENCE_STEPS = [
  'Customer evidence collected',
  'Requirements mapped to Adobe',
  'Testing fit and competitive position',
  'Preparing the recommendation',
];

function evidenceStepsHtml(steps, activeIndex = 0) {
  return `<div class="nash-session-evidence-steps">
    ${steps.map((step, index) => {
    let state = '';
    let stateLabel = 'Next';
    if (index < activeIndex) {
      state = 'done';
      stateLabel = 'Done';
    } else if (index === activeIndex) {
      state = 'current';
      stateLabel = 'Working';
    }
    return `<div class="nash-session-evidence-step ${state}" data-step="${index}">
        <span class="nash-session-evidence-dot">${index < activeIndex ? '✓' : ''}</span>
        <span>${escapeHtml(step)}</span>
        <span class="nash-session-evidence-state">${stateLabel}</span>
      </div>`;
  }).join('')}
  </div>`;
}

function setEvidenceStep(host, activeIndex) {
  const steps = [...host.querySelectorAll('.nash-session-evidence-step')];
  steps.forEach((step, index) => {
    step.classList.toggle('done', index < activeIndex);
    step.classList.toggle('current', index === activeIndex);
    const dot = step.querySelector('.nash-session-evidence-dot');
    const state = step.querySelector('.nash-session-evidence-state');
    if (dot) dot.textContent = index < activeIndex ? '✓' : '';
    if (state) {
      state.textContent = 'Next';
      if (index < activeIndex) state.textContent = 'Done';
      else if (index === activeIndex) state.textContent = 'Working';
    }
  });
}

function setupProgressHtml() {
  return `<div class="nash-session-setup-progress" aria-live="polite">
      <p class="nash-session-progress-title">Reviewing the opportunity</p>
      <p class="nash-session-progress-message">${SETUP_PROGRESS_MESSAGES[0]}</p>
      ${evidenceStepsHtml(SETUP_EVIDENCE_STEPS)}
    </div>`;
}

function startSetupAnimation(host) {
  const message = host.querySelector('.nash-session-progress-message');
  let step = 0;
  const timer = window.setInterval(() => {
    step = Math.min(step + 1, SETUP_EVIDENCE_STEPS.length - 2);
    setEvidenceStep(host, step);
    if (message) {
      message.textContent = SETUP_PROGRESS_MESSAGES[step % SETUP_PROGRESS_MESSAGES.length];
    }
  }, 2400);
  return () => {
    window.clearInterval(timer);
    setEvidenceStep(host, SETUP_EVIDENCE_STEPS.length);
  };
}

function parseJsonObject(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function inferIntake(files, solutions) {
  const docText = files.filter((f) => f.text)
    .map((f) => `--- ${f.name} ---\n${f.text}`).join('\n\n').slice(0, MAX_DOC_CHARS);
  const attachments = files.filter((f) => f.data).map((f) => ({
    type: 'input_file',
    filename: f.name,
    file_data: f.data,
    ...(f.mime ? { mime_type: f.mime } : {}),
  }));
  if (!isAuthenticated() || (!docText && !attachments.length)) return null;
  const catalog = solutions.map((s) => `${s.slug} | ${s.name}`).join('\n');
  const prompt = `Read the customer material and prepare a concise Adobe opportunity intake.
Return ONLY valid JSON with this shape:
{"company":"","dr":"","website":"","objectives":[],"challenges":[],"requirements":[],"decisionContext":[],"competitiveSignals":[],"recommendedSolutions":[{"slug":"","reason":"","evidence":""}],"conflicts":[]}

Rules:
- Infer the official customer domain only when reasonably confident.
- Keep each array to 3-5 concise items.
- Recommend only products from the catalog below, using exact slugs.
- Each recommendation needs one short reason tied to a customer objective or requirement and a document locator.
- Surface contradictions between documents in conflicts.
- Do not invent missing information.

ADOBE PRODUCT CATALOG:
${catalog}

CUSTOMER MATERIAL:
${docText || 'Read the attached binary customer document(s).'}`;
  let answer = '';
  await streamQualification({
    messages: [{
      role: 'user',
      content: attachments.length
        ? [{ type: 'input_text', text: prompt }, ...attachments]
        : prompt,
    }],
    webSearch: true,
    reasoningEffort: 'low',
    onDelta: (delta) => { answer += delta; },
    onError: () => {},
  });
  return parseJsonObject(answer);
}

function solutionTileHtml(solution, inferred) {
  const recommendation = (inferred.recommendedSolutions || [])
    .find((item) => item.slug === solution.slug);
  const [symbol, number] = SOLUTION_TILES[solution.slug]
    || [solution.name.replace(/^Adobe\s+/i, '').split(/\W+/)
      .map((word) => word[0]).join('')
      .slice(0, 2), 0];
  const pillar = PILLARS.find((item) => item.id === SOLUTION_PILLARS[solution.slug]);
  return `<label class="nash-session-solution-tile${recommendation ? ' is-recommended' : ''}" style="--tile-accent:${pillar?.accent || '#6b7280'}">
      <input type="checkbox" name="solutions" value="${escapeHtml(solution.slug)}" data-name="${escapeHtml(solution.name)}"${recommendation ? ' checked' : ''}/>
      <span class="nash-session-solution-num">${String(number).padStart(3, '0')}</span>
      <strong>${escapeHtml(symbol)}</strong>
      <span>${escapeHtml(solution.name.replace(/^Adobe\s+/i, ''))}</span>
      ${recommendation ? `<small>${escapeHtml(recommendation.reason)}${recommendation.evidence ? ` · ${escapeHtml(recommendation.evidence)}` : ''}</small>` : ''}
    </label>`;
}

function summaryList(title, values) {
  if (!Array.isArray(values) || !values.length) return '';
  return `<section><h3>${title}</h3><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul></section>`;
}

function renderSetupReview(inferred, solutions, fileNames) {
  const recommendationReasons = (inferred.recommendedSolutions || [])
    .map((item) => {
      const solution = solutions.find((candidate) => candidate.slug === item.slug);
      if (!solution) return '';
      return `<li><strong>${escapeHtml(solution.name)}</strong> — ${escapeHtml(item.reason)}${item.evidence ? ` <span>${escapeHtml(item.evidence)}</span>` : ''}</li>`;
    }).filter(Boolean).join('');
  return `<form class="nash-session-setup-review">
      <header>
        <span class="nash-session-kicker">Document review</span>
        <h2>Here is what Nash understood</h2>
        <p>${escapeHtml(fileNames)} · Confirm the customer and Adobe scope. Everything else can be refined during the interview.</p>
      </header>
      <div class="nash-session-identity-row">
        <label>Customer name<input name="company" value="${escapeHtml(inferred.company || '')}" required/></label>
        <label>Official website<input name="website" value="${escapeHtml(inferred.website || '')}" placeholder="Inferred automatically"/></label>
        <label>DR <span>optional</span><input name="dr" value="${escapeHtml(inferred.dr || '')}" placeholder="Not found"/></label>
      </div>
      <div class="nash-session-extracted-summary">
        ${summaryList('Objectives', inferred.objectives)}
        ${summaryList('Challenges', inferred.challenges)}
        ${summaryList('Requirements', inferred.requirements)}
        ${summaryList('Decision context', inferred.decisionContext)}
        ${summaryList('Competitive signals', inferred.competitiveSignals)}
        ${summaryList('Conflicts to resolve', inferred.conflicts)}
      </div>
      <div class="nash-session-scope-head">
        <div><span class="nash-session-kicker">Recommended scope</span><h2>Confirm the Adobe solutions</h2></div>
        <p>Recommendations are tied to the customer evidence. Add or remove products freely.</p>
      </div>
      <div class="nash-session-periodic">${solutions.map((solution) => solutionTileHtml(solution, inferred)).join('')}</div>
      ${recommendationReasons ? `<ul class="nash-session-scope-reasons">${recommendationReasons}</ul>` : ''}
      <div class="nash-session-setup-actions">
        <button type="submit" class="nash-session-btn-primary">Continue to open questions</button>
      </div>
    </form>`;
}

function wireSetupReview(block, inferred, solutions, onConfirm = () => runInterview(block)) {
  const area = block.querySelector('.nash-session-report-area');
  area.innerHTML = renderSetupReview(inferred, solutions, current.fileName || 'No documents');
  const form = area.querySelector('.nash-session-setup-review');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = [...form.querySelectorAll('input[name="solutions"]:checked')]
      .map((input) => ({ slug: input.value, name: input.dataset.name }));
    if (!form.company.value.trim() || !selected.length) return;
    Object.assign(current, {
      company: form.company.value.trim(),
      website: form.website.value.trim(),
      dr: form.dr.value.trim(),
      solutions: selected,
      intake: inferred,
    });
    const title = block.querySelector('.nash-session-assess-title');
    if (title) title.textContent = current.company;
    persist(current);
    area.innerHTML = '';
    onConfirm();
  });
}

async function reviewDocuments(block, files, solutions) {
  const area = block.querySelector('.nash-session-report-area');
  area.innerHTML = setupProgressHtml(solutions);
  const stop = startSetupAnimation(area, solutions);
  const inferred = await inferIntake(files, solutions) || {
    company: '',
    dr: '',
    website: '',
    objectives: [],
    challenges: [],
    requirements: [],
    decisionContext: [],
    competitiveSignals: [],
    recommendedSolutions: [],
    conflicts: [],
  };
  stop();
  wireSetupReview(block, inferred, solutions);
}

/* First step of the questionnaire: documents first, with a lightweight
   company-only path when the analyst has no source material yet. */
async function runIntake(block) {
  const area = block.querySelector('.nash-session-report-area');
  const thread = block.querySelector('.nash-session-thread');
  const solutions = await loadSolutions();
  thread.innerHTML = '';
  area.innerHTML = renderIntake();
  setSetupAvailability(block, true);
  const form = area.querySelector('.nash-session-intake');
  const drop = form.querySelector('.nash-session-drop');
  const fileInput = form.querySelector('#na-file');

  const useFiles = async (fileList) => {
    const picked = [...fileList];
    if (!picked.length) return;
    drop.classList.add('has-file');
    drop.querySelector('.nash-session-drop-icon').innerHTML = ICONS.doc;
    drop.querySelector('.nash-session-drop-text').innerHTML = `Reading ${picked.length === 1 ? escapeHtml(picked[0].name) : `${picked.length} documents`}<span class="nash-session-drop-sub">Extracting customer needs and likely Adobe scope…</span>`;
    const files = await processFiles(picked);
    current.files = files;
    current.fileName = files.length === 1 ? files[0].name : `${files.length} files`;
    current.status = 'draft';
    persist(current);
    await reviewDocuments(block, files, solutions);
  };

  fileInput.addEventListener('change', () => useFiles(fileInput.files));
  ['dragover', 'dragenter'].forEach((name) => drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, () => drop.classList.remove('dragging')));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    useFiles(event.dataTransfer.files);
  });
  form.querySelector('.nash-session-start-empty').addEventListener('click', () => {
    area.innerHTML = `<form class="nash-session-empty-start">
      <span class="nash-session-kicker">No documents yet</span>
      <h2>Who is the customer?</h2>
      <p>Nash will guide you through the objectives and challenges one question at a time.</p>
      <label>Customer name<input name="company" required autofocus placeholder="e.g. Unilever"/></label>
      <button class="nash-session-btn-primary" type="submit">Continue</button>
    </form>`;
    area.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      current.company = event.currentTarget.company.value.trim();
      if (!current.company) return;
      current.solutions = [];
      persist(current);
      const title = block.querySelector('.nash-session-assess-title');
      if (title) title.textContent = current.company;
      area.innerHTML = '';
      runInterview(block);
    });
  });
}

/* ── Assessment view (with chat) ─────────────────────── */

/* Scroll the assessment column (or the thread itself) to the newest message. */
function scrollToBottom(thread) {
  const scroller = thread.closest('.nash-session-assess-scroll') || thread;
  scroller.scrollTop = scroller.scrollHeight;
}

function addMessage(thread, role, html) {
  const msg = document.createElement('div');
  msg.className = `nash-session-msg ${role}`;
  msg.innerHTML = role === 'assistant'
    ? `<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble">${html}</div>`
    : `<div class="nash-session-bubble">${html}</div>`;
  thread.append(msg);
  scrollToBottom(thread);
  return msg.querySelector('.nash-session-bubble');
}

function typingIndicator(thread) {
  const msg = document.createElement('div');
  msg.className = 'nash-session-msg assistant';
  msg.innerHTML = '<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble"><span class="nash-session-typing"><i></i><i></i><i></i></span></div>';
  thread.append(msg);
  scrollToBottom(thread);
  return msg;
}

const DIMENSIONS = ['Strategic Fit', 'Technical Fit', 'Functional Coverage', 'Commercial Viability', 'Competitive Position', 'Delivery Risk', 'AI & Agentic Fit'];

function dimColor(s) {
  if (s >= 70) return 'var(--green, #0d7a45)';
  if (s >= 50) return 'var(--amber, #b45309)';
  return 'var(--red, #eb1000)';
}

function verdictFor(score) {
  if (score >= 70) return { label: 'Go', cls: 'go' };
  if (score >= 50) return { label: 'Conditional', cls: 'conditional' };
  return { label: 'No-go', cls: 'nogo' };
}

/* Simulated report — stands in for a FluffyJaws run until the API is live. */
function simulateReport() {
  const dimensions = DIMENSIONS.map((name) => ({
    name, score: 45 + Math.floor(Math.random() * 50),
  }));
  const score = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  return {
    score,
    dimensions,
    cms: 'AEM Sites',
    summary: 'Strong content and digital-asset fit with clear alignment to AEM Sites and Assets. Commercial viability is the main watch-item — confirm budget band and hosting model early. Competitive position is contested; lead with Adobe stack integration depth.',
    overview: 'The opportunity centres on consolidating content operations across multiple brand sites, improving site performance, and strengthening personalisation. The customer runs a large, frequently-updated content footprint with a sizeable in-house creative team, and is evaluating a platform move within the next two quarters.',
    signals: [
      'High page volume across multiple brand and market sites',
      'Existing Adobe Analytics and Target in the martech stack',
      'Asset-heavy workflow with a large in-house creative team',
      'Core Web Vitals and page performance flagged as priorities',
      'Headless delivery to mobile app mentioned as a future need',
    ],
    strengths: [
      'Large multi-brand, multi-market content footprint',
      'Existing Adobe Analytics and Target in the stack',
      'Asset-heavy creative workflow — strong DAM case',
      'Executive sponsorship for a digital experience refresh',
    ],
    redFlags: [
      'On-premise hosting requirement may conflict with AEM as a Cloud Service.',
      'Aggressive go-live timeline relative to integration scope.',
      'Budget band not yet confirmed — commercial viability unclear.',
    ],
    products: ['AEM Sites', 'AEM Assets', 'Edge Delivery Services', 'Adobe Target'],
    competitors: 'Sitecore and Optimizely likely in play. Differentiate on asset-management depth, native Adobe data integration (Analytics, Target, RT-CDP), and Edge Delivery performance.',
    nextSteps: [
      'Confirm the hosting model (cloud vs on-premise) with the customer.',
      'Validate the budget band against an AEM as a Cloud Service + Assets bundle.',
      'Prepare a tailored demo focused on multi-site management and DAM.',
      'Map the RFP requirements to the AEM solution skills for the proposal.',
    ],
  };
}

/* Comma-separated names of the Adobe solutions selected for this assessment. */
function solutionsLabel(a) {
  if (a && Array.isArray(a.solutions) && a.solutions.length) {
    return a.solutions.map((s) => s.name).join(', ');
  }
  return (a && a.solutionNames) || '';
}

function reportPanel(report, company) {
  if (!report) {
    return `
      <div class="nash-session-run">
        <span class="nash-session-typing"><i></i><i></i><i></i></span>
        <p class="nash-session-run-text">Preparing the assessment for <strong>${escapeHtml(company)}</strong>…</p>
      </div>
    `;
  }
  const v = verdictFor(report.score);
  const dims = report.dimensions.map((d) => `
    <div class="nash-session-dim">
      <div class="nash-session-dim-head"><span>${d.name}</span><span>${d.score}</span></div>
      <div class="nash-session-dim-track"><div class="nash-session-dim-fill" style="width:${d.score}%;background:${dimColor(d.score)}"></div></div>
    </div>
  `).join('');
  const list = (items) => `<ul class="nash-session-report-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  const section = (title, body) => (body ? `<h3 class="nash-session-report-h">${title}</h3>${body}` : '');

  return `
    <div class="nash-session-report">
      <div class="nash-session-report-top">
        <div class="nash-session-score" style="color:${dimColor(report.score)}">${report.score}<span>/ 100</span></div>
        <span class="nash-session-verdict ${v.cls}">${v.label}</span>
        ${solutionsLabel(current) ? `<span class="nash-session-report-cms">${escapeHtml(solutionsLabel(current))}</span>` : ''}
      </div>
      ${report.summary ? `<p class="nash-session-report-lead">${escapeHtml(report.summary)}</p>` : ''}

      ${section('Opportunity overview', report.overview ? `<p class="nash-session-report-summary">${escapeHtml(report.overview)}</p>` : '')}
      ${section('Detected signals', report.signals ? list(report.signals) : '')}
      ${section('Scoring dimensions', `<div class="nash-session-dims">${dims}</div>`)}
      ${section('Strengths', report.strengths ? list(report.strengths) : '')}
      ${section('Red flags', report.redFlags ? list(report.redFlags) : '')}
      ${section('Recommended products', report.products ? `<div class="nash-session-report-chips">${report.products.map((p) => `<span class="nash-session-report-chip">${escapeHtml(p)}</span>`).join('')}</div>` : '')}
      ${section('Competitive position', report.competitors ? `<p class="nash-session-report-summary">${escapeHtml(report.competitors)}</p>` : '')}
      ${section('Recommended next steps', report.nextSteps ? list(report.nextSteps) : '')}
    </div>
  `;
}

/* Pull authored solution-skills content from DA as grounding text. */
async function fetchSkillsText(slugs) {
  const parts = await Promise.all(slugs.map(async (slug) => {
    try {
      const r = await fetch(`/solutions/${slug}.plain.html`);
      if (!r.ok) return '';
      const div = document.createElement('div');
      div.innerHTML = await r.text();
      return `## ${slug}\n${div.textContent.replace(/\n{3,}/g, '\n\n').trim()}`;
    } catch {
      return '';
    }
  }));
  return parts.filter(Boolean).join('\n\n');
}

// Largest amount of extracted document text we embed in the prompt.
const MAX_DOC_CHARS = 120000;

/*
 * Extracts readable text from a file in the browser so it can go straight into
 * the prompt — we never rely on FluffyJaws mounting the upload into its tool
 * runtime (PDFs were coming back "not readable in-session"). Spreadsheets/CSV via
 * SheetJS, PDFs via pdf.js, .docx via fflate (all loaded on demand). Returns ''
 * for formats we don't parse here (e.g. legacy binary .doc) — those still go to
 * the model as an input_file attachment.
 */
async function extractFileText(file) {
  const name = (file.name || '').toLowerCase();
  const isText = name.endsWith('.csv') || name.endsWith('.txt')
    || file.type === 'text/csv' || file.type === 'text/plain';
  if (isText) {
    const t = await file.text();
    return t.slice(0, MAX_DOC_CHARS);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      const sheetjsUrl = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
      const XLSX = await import(sheetjsUrl);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const text = wb.SheetNames
        .map((n) => `### Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
        .join('\n\n');
      return text.slice(0, MAX_DOC_CHARS);
    } catch (e) {
      return '';
    }
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const pdfjsBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build';
      const pdfjs = await import(`${pdfjsBase}/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${pdfjsBase}/pdf.worker.min.mjs`;
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const parts = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await pdf.getPage(i);
        // eslint-disable-next-line no-await-in-loop
        const content = await page.getTextContent();
        parts.push(content.items.map((it) => it.str).join(' '));
        if (parts.reduce((n, p) => n + p.length, 0) > MAX_DOC_CHARS) break;
      }
      return parts.join('\n\n').slice(0, MAX_DOC_CHARS);
    } catch (e) {
      return '';
    }
  }
  if (name.endsWith('.docx')) {
    try {
      const fflateUrl = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';
      const fflate = await import(fflateUrl);
      const zip = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
      const raw = zip['word/document.xml'];
      if (!raw) return '';
      // .docx is a ZIP; word/document.xml holds the body. Turn paragraph/line/tab
      // tags into whitespace, strip the rest, and decode entities.
      const text = fflate.strFromU8(raw)
        .replace(/<w:tab\b[^>]*\/?>/g, '\t')
        .replace(/<w:br\b[^>]*\/?>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return text.slice(0, MAX_DOC_CHARS);
    } catch (e) {
      return '';
    }
  }
  return '';
}

function buildQualPrompt({
  company, fileName, solutionNames, skills, maxSearches = 6, docText = '', interview = '',
}) {
  let docLine;
  if (docText) {
    docLine = `The full contents of the attached document(s) (${fileName}) are included at the END of this prompt under "=== ATTACHED DOCUMENT ===" (each preceded by its filename). Read them there directly — no tool or code interpreter is needed. These are the PRIMARY input for all five sections; ground the requirement analysis and scoring in them.`;
  } else if (fileName) {
    docLine = `MANDATORY FIRST STEP: Document(s) are attached (${fileName}). Before any web/internal search, OPEN AND READ them (use the code interpreter if needed). They are the PRIMARY input for all five sections and do NOT count against the search budget below. If you genuinely cannot open them, say so explicitly at the top and mark scoring provisional — do not silently proceed as if no document exists.`;
  } else {
    docLine = 'No document is attached — use the customer name and public data.';
  }
  return `You are an Adobe cross-functional deal team (Business Consultant + Solution Consultant + System Architect + Sales Strategist + Market Analyst).

Goal: qualify the opportunity for "${company}" for ${solutionNames}, and produce a structured, insight-rich qualification dossier suitable for sales, solutioning, and executive briefings.

Guidance:
- Ground your scoring strictly in the Adobe solution knowledge provided below — use ITS scoring dimensions, key signals, red flags, competitive alternatives, and recommended products. Do not invent competitors or criteria that contradict it.
- Use Adobe internal sources and reputable, recent public sources for the market/news section; include dates and links next to each claim. Prefer Adobe sources first.
- Be honest, objective and pragmatic — do NOT just say yes to please me.
- Quantify where possible; if the company is private and data is sparse, state uncertainties and use ranges.
- Tie market and competitor intelligence directly to the Decision and Evidence & Risks sections.
${interview ? '- Treat the ANALYST-PROVIDED CONTEXT (below) as authoritative first-party intelligence. Use champions, blockers, RFP influence, and meeting context in the Decision, Use Cases, and Evidence & Risks sections.\n' : ''}- CRITICAL — NO VERBATIM REPRODUCTION (a content filter will block the whole report otherwise): Write the entire dossier in your own words. Do NOT reproduce, echo, paste, or closely quote extended text from ANY source — not the attached document, and especially not analyst reports (Forrester Wave, Gartner, IDC) or other search results, which are copyrighted. When the code interpreter reads the spreadsheet, use the data for analysis but do NOT print or repeat raw rows in your answer. Do not copy competitor-comparison tables or analyst paragraphs verbatim — restate the finding in one original sentence and cite the source link. Any single quote must be under 15 words, in quotes, with attribution. Synthesise; never transcribe.
- EFFICIENCY (critical): After reading the attachment, perform AT MOST ${maxSearches} EXTERNAL searches (web + internal docs) total, batching related queries into a single call where possible, then STOP searching and write the full dossier. Reading the attached file is required and is NOT one of these searches. Do NOT exhaustively search every source — prioritise completing the report. A complete report from a few good sources beats an unfinished one.

${docLine}

Begin your response with these machine-readable lines EXACTLY in this format (the tool parses them and strips them from display):
NASH_META: score=<integer 0-100> | verdict=<Go|Conditional-Go|No-go> | cms=<detected current platform or n/a>
NASH_DIMS:
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale> | <evidence IDs, comma-separated>
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale> | <evidence IDs, comma-separated>
NASH_DIMS_END
Use the solution's ITS scoring dimensions for the NASH_DIMS rows (typically Strategic Fit, Technical Fit, Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk — or whatever the solution knowledge defines). ALWAYS add one more row named EXACTLY "AI & Agentic Fit" (weight ~10-15%) that scores how well Adobe Coworker, the in-scope Adobe products' agents, and their MCPs address this opportunity, and how ready the customer is to adopt them — even if the solution knowledge does not list it. Re-balance the other weights so all rows sum to 100%. The weighted scores must sum to the overall score, and Sections 1–2 must explain this row's reasoning. Every dimension MUST reference at least one evidence ID from NASH_EVIDENCE.
NASH_CONTEXT:
objectives: <top business objective>; <objective>; <objective>
challenges: <top pain or challenge>; <challenge>; <challenge>
tech_stack: <current tools/platforms the customer uses, or n/a>
success: <what success looks like for the customer in one or two sentences>
use_cases: <primary use case>; <use case>; <use case>
NASH_CONTEXT_END
For NASH_CONTEXT, uncover the customer's business objectives and their pains/challenges FIRST from the attached document, then from public evidence; base tech_stack, success, and use_cases on the same. If something isn't stated, infer conservatively and keep it short. Then continue with the dossier.
NASH_EVIDENCE:
E1 | <customer-document|analyst-context|adobe-knowledge|public-source> | <source title> | <page, section, topic, or URL> | <concise paraphrased evidence>
E2 | <customer-document|analyst-context|adobe-knowledge|public-source> | <source title> | <page, section, topic, or URL> | <concise paraphrased evidence>
NASH_EVIDENCE_END
Create a compact evidence register containing only evidence actually used in the assessment. Never invent a page, section, URL, or source title; use "Document-wide" when a precise location is unavailable. Prefer customer-document and analyst-context evidence for scoring. Use adobe-knowledge for scoring criteria and public-source for externally verified claims. EVERY public link cited anywhere in the dossier must have a matching public-source row whose locator is the exact URL. Reference evidence inline as [[E1]] after key claims, especially red flags and the final recommendation. Each evidence ID must exist in NASH_EVIDENCE, and every NASH_DIMS evidence ID must also appear inline in the dossier where its reasoning is explained.
NASH_CONFIDENCE:
<exact dimension name> | <High|Medium|Low> | <plausible score swing, e.g. ±3> | <fact evidence IDs, comma-separated> | <key assumption or none> | <critical unknown or none> | <specific validation that would change the score>
NASH_CONFIDENCE_END
Add one NASH_CONFIDENCE row for every NASH_DIMS row. Confidence reflects the quality and completeness of available evidence, not whether the score is high or low. Facts must reference IDs from NASH_EVIDENCE. Keep assumptions and unknowns distinct: an assumption is a provisional interpretation; an unknown is information not yet available. The score swing is the plausible change to the overall 0-100 score if the assumption or unknown proves materially favorable or unfavorable. The final field must state the single highest-impact question, document, or proof point to validate next.

Write for busy sales and solution leaders. Be concise: short bullets, compact tables, no repeated facts, no generic Adobe marketing language, and no paragraph longer than three sentences. Use progressive disclosure: put the decision and most important evidence first; place supporting detail under descriptive sub-headings.

Produce markdown with EXACTLY these five top-level sections and NO OTHERS. Use a single "# " heading only for these five:
# 1. Decision
# 2. Use Cases
# 3. Demo Storyline
# 4. Architecture
# 5. Evidence & Risks

Section 1 must answer whether Adobe should pursue this opportunity and why. Include: recommendation (Pursue / Pursue with conditions / Do not pursue), a 3-5 bullet Adobe-fit rationale tied to customer evidence, the recommended Adobe scope, the strongest reasons to win, the largest reasons to lose, and 3 concrete next actions. Explain HOW the selected Adobe products and features solve the customer's objectives—not merely that they fit.

Section 2 must organize the assessment around customer use cases. Create a compact markdown table with columns:
| Use case | Customer objective | Users | Current pain | Desired journey | Adobe product and specific features | Evidence | Business value | Gaps / validation |
Use only features that genuinely exist in the selected products. Each use case must be customer-specific, cite evidence IDs, and distinguish confirmed facts from assumptions. Prioritize the highest-value use cases first.

Section 3 must turn the highest-value use cases into one coherent demo narrative. Include the demo persona, setup, 4-7 sequenced scenes, exact Adobe products/features shown in each scene, the customer evidence it answers, and the business payoff. End with what must be configured or mocked before the demo. Do not produce one disconnected demo per product.

Section 4 must describe a customer-specific logical architecture: named customer systems, Adobe services, integrations, data flows, channels, security/governance considerations, and explicit assumptions requiring validation. Never invent a customer system. Unknown systems or flows must be labelled "Assumption — validate". Include the target architecture as a machine-readable NASH_ARCH block—never mermaid, ASCII art, or a code fence:
NASH_ARCH:
layers: <left-to-right layer names, semicolon-separated, e.g. Sources; Platform; Decisioning; Channels>
group: <groupId> | <Group label> | <layer name>
node: <id> | <short label> | <layer name> | <groupId or blank>
edge: <fromId> | <toId> | <flow type> | <optional short label>
NASH_ARCH_END
Flow type is ingress, intra, or egress. Use 4-7 layers and keep the node set minimal.

Section 5 must consolidate evidence, uncertainty, competition, and delivery risk. Include the top customer objectives and challenges in their original priority order, current stack, decision context, competitor signals, disqualifiers, assumptions, unknowns, score sensitivity, and the evidence register. Cite every public claim and include every public URL used in NASH_EVIDENCE. Unknown interview answers must remain visible as unknowns rather than being silently filled in.

=== ADOBE SOLUTION KNOWLEDGE (ground your analysis in this) ===
${skills}
${docText ? `\n=== ATTACHED DOCUMENT (${fileName}) — PRIMARY INPUT. Analyse it; do NOT reproduce it verbatim in your answer ===\n${docText}` : ''}${interview ? `\n\n=== ANALYST-PROVIDED CONTEXT (pre-assessment interview) — authoritative first-party intelligence; weight equally with the attached document ===\n${interview}` : ''}`;
}

function setStatusDone(block) {
  current.status = 'done';
  renderBelowBar(block);
  renderDecisionPanelContent(block);
  renderDaPanelContent(block);
}

/* Rendered report HTML for the published DA page body. */
function reportHtmlForPublish(a) {
  let header = `<h1>${escapeHtml(a.company)}</h1>`;
  if (typeof a.score === 'number') {
    const label = a.verdict || verdictFor(a.score).label;
    const platform = a.cms && a.cms.toLowerCase() !== 'n/a'
      ? ` · <strong>Platform:</strong> ${escapeHtml(a.cms)}` : '';
    header += `<p><strong>Fit score:</strong> ${a.score} / 100 — ${escapeHtml(label)}${platform}</p>`;
  }
  let body = '';
  if (a.reportMarkdown) body = renderReportMarkdown(a.reportMarkdown, { headings: 'real' }, a.evidence || []);
  else if (a.report) body = reportPanel(a.report, a.company);
  else if (a.reportHtml) body = a.reportHtml;
  return header + body;
}

/* Short relative time for the "Published … ago" label. */
function relTimeShort(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* Transient "✓ Published" confirmation so a (re)publish has a clear result. */
function flashPublished(block, message = '✓ Published to DA') {
  const footer = block.querySelector('.nash-session-footer');
  if (!footer) return;
  footer.querySelector('.nash-session-toast')?.remove();
  const toast = document.createElement('span');
  toast.className = 'nash-session-toast';
  toast.textContent = message;
  footer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('in'));
  setTimeout(() => { toast.classList.remove('in'); }, 2400);
  setTimeout(() => { toast.remove(); }, 2800);
}

/* Reflect on the Re-run button whether chat notes still need folding in. */
function renderRerunState(block) {
  const btn = block?.querySelector('.nash-session-rerun');
  if (!btn || !current) return;
  const pending = !!current.notesSinceRun;
  btn.classList.toggle('has-notes', pending);
  btn.innerHTML = pending ? '↻ Re-run to update' : '↻ Re-run';
  btn.title = pending
    ? 'You added notes in chat — re-run to fold them into the report'
    : 'Re-run the assessment, folding in your chat with Fluffy';
}

/* Shared publish action — drives the below-bar button and the DA-tab button. */
async function publishCurrent(block, trigger) {
  const original = trigger.textContent;
  trigger.disabled = true;
  trigger.textContent = 'Publishing…';
  block.querySelector('.nash-session-publish-error')?.remove();
  try {
    const res = await publishAssessment(current, reportHtmlForPublish(current), getUserInfo()?.email || '');
    current.publishedUrl = res.url;
    current.publishedSlug = res.slug;
    // Stamp each publish so the "Published" link is cache-busted (the live host
    // caches pages for 2h) and record which report version is now live, so the
    // button can show when a later re-run has moved ahead of the published copy.
    current.publishedAt = Date.now();
    current.publishedRev = current.reportRev || current.publishedRev || current.publishedAt;
    persist(current);
    renderBelowBar(block);
    renderDaPanelContent(block);
    flashPublished(block);
  } catch (e) {
    trigger.disabled = false;
    trigger.textContent = original;
    const note = document.createElement('p');
    note.className = 'nash-session-publish-error';
    note.textContent = e.message;
    trigger.parentElement.appendChild(note);
  }
}

async function publishAutomatically(block, attempt = 0) {
  if (!current || !(current.reportMarkdown || current.report)) return;
  if (publishRetryTimer) {
    window.clearTimeout(publishRetryTimer);
    publishRetryTimer = null;
  }
  current.publishState = 'publishing';
  delete current.publishError;
  persist(current);
  renderBelowBar(block);
  renderDaPanelContent(block);
  try {
    const res = await publishAssessment(
      current,
      reportHtmlForPublish(current),
      getUserInfo()?.email || '',
    );
    current.publishedUrl = res.url;
    current.publishedSlug = res.slug;
    current.publishedAt = Date.now();
    current.publishedRev = current.reportRev || current.publishedAt;
    current.publishState = 'published';
    delete current.publishError;
    persist(current);
    renderBelowBar(block);
    renderDaPanelContent(block);
    flashPublished(block, '✓ Assessment published automatically');
  } catch (error) {
    current.publishState = 'error';
    current.publishError = error.message;
    persist(current);
    renderBelowBar(block);
    renderDaPanelContent(block);
    const delays = [15000, 45000, 120000];
    if (attempt < delays.length) {
      publishRetryTimer = window.setTimeout(
        () => publishAutomatically(block, attempt + 1),
        delays[attempt],
      );
    }
  }
}

/* "Published" chip with a freshness stamp. Clicking it opens the DA content tab
   in-app (which renders the published document from current data) rather than the
   gated live page in a new tab — no re-auth, and never a stale cached copy. */
function publishedLink(a) {
  const when = a.publishedAt ? ` · ${relTimeShort(a.publishedAt)}` : '';
  return `<button type="button" class="nash-session-published" data-goto-da title="View the published document">Published${when}</button>`;
}

/* The area below the chat bar: Publish to DA (or the published link + re-publish).
   When a re-run has moved the report ahead of what's published, the button turns
   into an emphasised "Publish changes" so it's clear a re-publish is meaningful. */
function renderBelowBar(block) {
  const el = block.querySelector('.nash-session-belowbar');
  if (!el || !current) return;
  if (!(current.reportMarkdown || current.report)) { el.innerHTML = ''; return; }
  if (current.publishState === 'publishing') {
    el.innerHTML = '<span class="nash-session-publish-state">Publishing assessment…</span>';
  } else if (current.publishState === 'error') {
    el.innerHTML = `<span class="nash-session-publish-state is-error">Publishing failed · retrying automatically</span>
      <button type="button" class="nash-session-publish subtle">Retry now</button>`;
  } else if (current.publishedUrl) {
    el.innerHTML = `${publishedLink(current)}<span class="nash-session-publish-state">Auto-published</span>`;
  } else {
    el.innerHTML = '<span class="nash-session-publish-state">Publishing starts automatically when the assessment completes</span>';
  }
  el.querySelector('.nash-session-publish')?.addEventListener('click', (event) => {
    event.currentTarget.disabled = true;
    publishAutomatically(block);
  });
  el.querySelector('[data-goto-da]')?.addEventListener('click', () => switchTab(block, 'da'));
}

/* DA content tab body — the published page (rendered) + live link, or a CTA. */
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
// One distinct icon per section position (standard 7-section order).
// Section nav icons, keyed by label so re-ordering sections never misaligns them.
const SECTION_ICONS = {
  Decision: SVG('<path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-3z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>'),
  'Use Cases': SVG('<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="19" r="1"/>'),
  'Demo Storyline': SVG('<polygon points="5 3 19 12 5 21 5 3"/>'),
  Architecture: SVG('<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M10 6h4a3 3 0 0 1 3 3v6"/>'),
  'Evidence & Risks': SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h2"/>'),
  Overview: SVG('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  Market: SVG('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  Business: SVG('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  'Tech Fit': SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>'),
  Discovery: SVG('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  Competition: SVG('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  Recommendation: SVG('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
  Rationale: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>'),
  Accelerators: SVG('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  'AI & Agents': SVG('<path d="M12 3l1.8 4.4L18.2 9.2 13.8 11 12 15.4 10.2 11 5.8 9.2 10.2 7.4z"/><path d="M18.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>'),
};
function sectionIcon(label) {
  return SECTION_ICONS[label] || SECTION_ICONS.Overview;
}

/* Map a heading to one of the ten canonical section labels, or null if it isn't
   one (so sub-headings like "Customer Context" or "Budget Indication" don't
   become nav sections). */
function canonicalSectionLabel(title) {
  const t = title.toLowerCase();
  if (/evidence.*risk|risk.*evidence/.test(t)) return 'Evidence & Risks';
  if (/demo|storyline/.test(t)) return 'Demo Storyline';
  if (/use cases?/.test(t)) return 'Use Cases';
  if (/architect/.test(t)) return 'Architecture';
  if (/decision/.test(t)) return 'Decision';
  if (/coworker|agentic|agents?\b/.test(t)) return 'AI & Agents';
  if (/executive|overview/.test(t)) return 'Overview';
  if (/market|financial|intelligence/.test(t)) return 'Market';
  if (/business/.test(t)) return 'Business';
  if (/technical|architect|tech/.test(t)) return 'Tech Fit';
  if (/qualification|discovery|question/.test(t)) return 'Discovery';
  if (/rationale/.test(t)) return 'Rationale';
  if (/accelerat|reference/.test(t)) return 'Accelerators';
  if (/competitive|win|position/.test(t)) return 'Competition';
  if (/recommendation|scope|final|verdict/.test(t)) return 'Recommendation';
  return null;
}

/* Short nav label for a section, matched from its heading text. */
function sectionLabel(title) {
  return canonicalSectionLabel(title) || title.replace(/^\d+[.)]\s*/, '').slice(0, 24);
}

/* Split into the ten canonical report sections. Only a top-level (#) heading
   that maps to a canonical label starts a section, and each label is taken once
   (first occurrence) — so Rationale sub-headings (Customer Context, Budget
   Indication, a second "Recommendation Summary", …) and deeper headings stay in
   the body instead of exploding or duplicating the nav. */
function splitReportSections(md) {
  if (!md) return [];
  const lines = md.split('\n');
  const canonical = [];
  const seen = new Set();
  let cur = null;
  lines.forEach((line) => {
    const h = line.match(/^#(?!#)\s+(.+)$/);
    const label = h ? canonicalSectionLabel(h[1].trim()) : null;
    if (label && !seen.has(label)) {
      seen.add(label);
      cur = { title: h[1].trim(), md: '' };
      canonical.push(cur);
    } else if (cur) {
      cur.md += `${line}\n`;
    }
  });
  if (canonical.length >= 2) return canonical;
  // Fallback for reports that don't use canonical "# " section headings.
  const scan = (re) => {
    const out = [];
    let c = null;
    lines.forEach((line) => {
      const m = line.match(re);
      if (m) { c = { title: m[1].trim(), md: '' }; out.push(c); } else if (c) c.md += `${line}\n`;
    });
    return out;
  };
  const h1 = scan(/^#(?!#)\s+(.+)$/);
  return h1.length >= 2 ? h1 : scan(/^#{1,2}(?!#)\s+(.+)$/);
}

/* Scorecard cards from the parsed NASH_DIMS dimensions. */
// Each scored dimension links to the narrative section that justifies it, so a
// low score is traceable to its reasoning. Keyed by lower-cased dimension name;
// value is a section nav label (see sectionLabel).
const DIM_SECTION = {
  'strategic fit': 'Decision',
  'technical fit': 'Architecture',
  'functional coverage': 'Use Cases',
  'commercial viability': 'Decision',
  'competitive position': 'Evidence & Risks',
  'delivery risk': 'Evidence & Risks',
  'ai & agentic fit': 'Use Cases',
};

function scorecardCards(dims, availableLabels, confidence = []) {
  if (!dims || !dims.length) return '';
  const labels = availableLabels || new Set();
  return `<div class="nash-session-scorecard">${dims.map((d) => {
    const pct = d.max ? Math.round((d.scored / d.max) * 100) : 0;
    const target = DIM_SECTION[(d.dimension || '').toLowerCase()];
    const linked = target && labels.has(target);
    const confidenceItem = confidence.find(
      (item) => item.dimension.toLowerCase() === d.dimension.toLowerCase(),
    );
    const inner = `
      <div class="nash-session-sc-top"><span>${escapeHtml(d.dimension)}</span><span class="nash-session-sc-weight">${escapeHtml(d.weight)}</span></div>
      ${confidenceItem ? `<div class="nash-session-sc-confidence">
        <span class="is-${escapeHtml(confidenceItem.level.toLowerCase())}">${escapeHtml(confidenceItem.level)} confidence</span>
        ${confidenceItem.swing ? `<span>${escapeHtml(confidenceItem.swing)} potential</span>` : ''}
      </div>` : ''}
      <div class="nash-session-sc-score">${d.scored}<span> / ${d.max}</span></div>
      <div class="nash-session-sc-bar"><div style="width:${pct}%;background:${dimColor(pct)}"></div></div>
      ${d.notes ? `<p>${escapeHtml(d.notes)}</p>` : ''}
      ${d.evidenceRefs?.length ? `<div class="nash-session-sc-evidence" aria-label="Supporting evidence">${d.evidenceRefs.map((id) => `<span>${escapeHtml(id)}</span>`).join('')}</div>` : ''}
      ${linked ? `<span class="nash-session-sc-link">See ${escapeHtml(target)} &rarr;</span>` : ''}`;
    return linked
      ? `<button type="button" class="nash-session-sc-card is-linked" data-qsection="${escapeHtml(target)}">${inner}</button>`
      : `<div class="nash-session-sc-card">${inner}</div>`;
  }).join('')}</div>`;
}

function confidencePanelHtml(confidence, evidence) {
  if (!Array.isArray(confidence) || !confidence.length) return '';
  const evidenceById = new Map((evidence || []).map((item) => [item.id.toLowerCase(), item]));
  const renderList = (value, emptyLabel) => {
    const values = String(value || '').split(';').map((item) => item.trim())
      .filter((item) => item && item.toLowerCase() !== 'none');
    if (!values.length) return `<p class="nash-session-confidence-empty">${escapeHtml(emptyLabel)}</p>`;
    return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  };
  return `<section class="nash-session-confidence" aria-label="Score confidence and open questions">
    <div class="nash-session-confidence-head">
      <div>
        <span class="nash-session-evidence-eyebrow">Decision quality</span>
        <h2>Confidence and open questions</h2>
      </div>
      <p>See what is known, assumed, and still capable of moving the score.</p>
    </div>
    <div class="nash-session-confidence-list">${confidence.map((item, index) => {
    const facts = item.factRefs.map((id) => evidenceById.get(id.toLowerCase())).filter(Boolean);
    return `<details class="nash-session-confidence-item"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="nash-session-confidence-dimension">${escapeHtml(item.dimension)}</span>
          <span class="nash-session-confidence-summary">
            <span class="nash-session-confidence-level is-${escapeHtml(item.level.toLowerCase())}">${escapeHtml(item.level)}</span>
            ${item.swing ? `<span class="nash-session-confidence-swing">${escapeHtml(item.swing)}</span>` : ''}
          </span>
        </summary>
        <div class="nash-session-confidence-body">
          <div>
            <h3>Verified facts</h3>
            ${facts.length ? `<ul>${facts.map((fact) => `<li><strong>${escapeHtml(fact.id)}</strong> ${escapeHtml(fact.claim)}</li>`).join('')}</ul>` : '<p class="nash-session-confidence-empty">No verified fact linked.</p>'}
          </div>
          <div>
            <h3>Assumptions</h3>
            ${renderList(item.assumptions, 'No material assumption recorded.')}
          </div>
          <div>
            <h3>Unknowns</h3>
            ${renderList(item.unknowns, 'No critical unknown recorded.')}
          </div>
          <div class="nash-session-confidence-change">
            <h3>What would change this score?</h3>
            <p>${escapeHtml(item.scoreChanger)}</p>
          </div>
        </div>
      </details>`;
  }).join('')}</div>
  </section>`;
}

const EVIDENCE_TYPE_LABELS = {
  'customer-document': 'Customer document',
  'analyst-context': 'Analyst context',
  'adobe-knowledge': 'Adobe knowledge',
  'public-source': 'Public source',
};

function evidencePanelHtml(evidence) {
  if (!Array.isArray(evidence) || !evidence.length) return '';
  return `<section class="nash-session-evidence" aria-label="Evidence used">
    <div class="nash-session-evidence-head">
      <div>
        <span class="nash-session-evidence-eyebrow">Traceable assessment</span>
        <h2>Evidence used</h2>
      </div>
      <span class="nash-session-evidence-count">${evidence.length} ${evidence.length === 1 ? 'source' : 'sources'}</span>
    </div>
    <div class="nash-session-evidence-list">${evidence.map((item) => {
    const type = EVIDENCE_TYPE_LABELS[item.type] || 'Supporting evidence';
    const locator = /^https?:\/\//i.test(item.locator)
      ? `<a href="${escapeHtml(item.locator)}" target="_blank" rel="noopener">Open source</a>`
      : escapeHtml(item.locator);
    return `<article class="nash-session-evidence-item" data-evidence-id="${escapeHtml(item.id)}" tabindex="-1">
        <div class="nash-session-evidence-meta">
          <span class="nash-session-evidence-id">${escapeHtml(item.id)}</span>
          <span class="nash-session-evidence-type">${escapeHtml(type)}</span>
        </div>
        <h3>${escapeHtml(item.source)}</h3>
        ${locator ? `<div class="nash-session-evidence-locator">${locator}</div>` : ''}
        <p>${escapeHtml(item.claim)}</p>
      </article>`;
  }).join('')}</div>
  </section>`;
}

/* Rich, tabbed preview of the DA document — shown inside the assessment. */
function daPreviewHtml(a) {
  const sols = (a.solutions || []).map((s) => s.name).join(', ') || a.solutionNames || '';
  const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const metaBits = [date, a.opp?.salesStage]
    .filter(Boolean).map((b) => `<span>${escapeHtml(b)}</span>`).join('');
  const v = verdictFor(a.score);
  const sections = splitReportSections(a.reportMarkdown);
  const sectionLabels = new Set(sections.map((s) => sectionLabel(s.title)));
  const nav = sections.map((s, i) => {
    const label = sectionLabel(s.title);
    return `<button type="button" class="nash-session-qtab${i === 0 ? ' active' : ''}" data-qidx="${i}" title="${escapeHtml(s.title)}">${sectionIcon(label)}<span>${label}</span></button>`;
  }).join('');
  const panels = sections.map((s, i) => `<div class="nash-session-qpanel${i === 0 ? ' active' : ''}" data-qidx="${i}">
    ${i === 0 ? scorecardCards(a.dimensions, sectionLabels, a.confidence) : ''}
    <div class="nash-session-qcard">
      <h3 class="nash-session-qpanel-title">${escapeHtml(s.title)}</h3>
      <div class="nash-md">${renderReportMarkdown(s.md, {}, a.evidence || [])}</div>
    </div>
    ${sectionLabel(s.title) === 'Evidence & Risks' ? `${confidencePanelHtml(a.confidence, a.evidence)}${evidencePanelHtml(a.evidence)}` : ''}
  </div>`).join('');
  return `<div class="nash-session-qual">
    <div class="nash-session-qual-head">
      <div>
        <div class="nash-session-qual-account">${escapeHtml(a.company)}</div>
        ${sols ? `<div class="nash-session-qual-solution">${escapeHtml(sols)}</div>` : ''}
        ${metaBits ? `<div class="nash-session-qual-meta">${metaBits}</div>` : ''}
      </div>
      ${typeof a.score === 'number' ? `<div class="nash-session-qual-score">
        <div class="nash-session-qual-ring" style="color:${dimColor(a.score)}">${a.score}<span>/ 100</span></div>
        <span class="nash-session-verdict ${v.cls}">${escapeHtml(a.verdict || v.label)}</span>
      </div>` : ''}
    </div>
    <div class="nash-session-qual-layout">
      <nav class="nash-session-qual-nav">${nav}</nav>
      <div class="nash-session-qual-panels">${panels}</div>
    </div>
  </div>`;
}

function daPanelHtml(a) {
  const hasReport = a.reportMarkdown || a.report || a.reportHtml;
  if (!hasReport) {
    return `<div class="nash-session-comingsoon">
      ${ICONS.cloud}
      <h2>No document yet</h2>
      <p>Run the assessment first — the DA document is generated from it.</p>
    </div>`;
  }
  const bar = a.publishedUrl
    ? `<div class="nash-session-da-bar">
        ${publishedLink(a)}
        <span class="nash-session-da-note">Updated automatically after every successful assessment.</span>
      </div>`
    : `<div class="nash-session-da-bar">
        <span class="nash-session-da-note">${a.publishState === 'error' ? 'Publishing failed; Nash is retrying automatically.' : 'This document will publish automatically when the assessment completes.'}</span>
      </div>`;
  let body;
  if (a.reportMarkdown) body = daPreviewHtml(a);
  else if (a.reportHtml) body = `<div class="nash-session-report nash-md">${a.reportHtml}</div>`;
  else body = reportPanel(a.report, a.company);
  return `<div class="nash-session-da">${bar}${body}</div>`;
}

function wireDaPanel(block) {
  block.querySelector('[data-da-publish]')?.addEventListener('click', (e) => publishCurrent(block, e.currentTarget));
  const panel = block.querySelector('.nash-session-panel[data-panel="da"]');
  panel?.querySelector('[data-goto-da]')?.addEventListener('click', () => switchTab(block, 'da'));
  panel?.querySelectorAll('.nash-session-qtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.nash-session-qtab').forEach((b) => b.classList.toggle('active', b === tab));
      panel.querySelectorAll('.nash-session-qpanel').forEach((p) => p.classList.toggle('active', p.dataset.qidx === tab.dataset.qidx));
    });
  });
  // A scored dimension card jumps to the nav section that justifies its score.
  panel?.querySelectorAll('.nash-session-sc-card[data-qsection]').forEach((card) => {
    card.addEventListener('click', () => {
      const label = card.dataset.qsection;
      const tab = [...panel.querySelectorAll('.nash-session-qtab')]
        .find((b) => b.querySelector('span')?.textContent === label);
      tab?.click();
    });
  });
  wireEvidence(panel);
}

function renderDaPanelContent(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="da"]');
  if (!panel || !current) return;
  panel.innerHTML = daPanelHtml(current);
  wireDaPanel(block);
}

function decisionQualityHtml(a) {
  const hasQuality = a.confidence?.length || a.evidence?.length;
  if (!hasQuality) {
    return `<div class="nash-session-comingsoon">
      ${ICONS.quality}
      <h2>No decision-quality analysis yet</h2>
      <p>Run or re-run the assessment to identify facts, assumptions, unknowns, and score sensitivity.</p>
    </div>`;
  }
  return `<div class="nash-session-decision">
    <header class="nash-session-decision-head">
      <span class="nash-session-evidence-eyebrow">Assessment transparency</span>
      <h2>Decision quality</h2>
      <p>Understand how reliable the score is and what to validate before committing to the opportunity.</p>
    </header>
    ${confidencePanelHtml(a.confidence, a.evidence)}
    ${evidencePanelHtml(a.evidence)}
  </div>`;
}

function renderDecisionPanelContent(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="decision"]');
  if (!panel || !current) return;
  panel.innerHTML = decisionQualityHtml(current);
  wireEvidence(panel);
}

/* ── Sales content tab ─────────────────────────────────────────────
   A sales-facing view: Fluffy drafts pillars, tracks, plays and a
   sales rationale from the assessment; the analyst fills in stakeholders
   and a Next-actions card list. Everything is stored on a.sales. */

const SALES_ICONS = {
  overview: SVG('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  pillars: SVG('<path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 21.2l1.6-7L2 9.5l7.1-.6z"/>'),
  tracks: SVG('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>'),
  plays: SVG('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  stakeholders: SVG('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2"/><path d="M16 20a5 5 0 0 1 5-5"/>'),
  rationale: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>'),
  actions: SVG('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
};

const SALES_SECTIONS = [
  ['overview', 'Overview'],
  ['pillars', 'Strategic pillars'],
  ['tracks', 'Sales tracks & plays'],
  ['stakeholders', 'Stakeholders'],
  ['rationale', 'Rationale'],
  ['actions', 'Next actions'],
];

const ACTION_TYPES = ['—', 'Business', 'IT', 'Partner'];
const ACTION_STATUSES = ['Planned', 'In progress', 'Done'];

const ACTION_TYPE_ICON = {
  Business: SVG('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  IT: SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>'),
  Partner: SVG('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2"/>'),
  '—': SVG('<circle cx="12" cy="12" r="3"/>'),
};

function newActionId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function salesStakeholderRow(st, i) {
  return `<div class="nash-sales-stk" data-i="${i}">
    <input class="nash-sales-in nash-sales-stk-name" data-field="name" placeholder="Name" value="${escapeHtml(st.name || '')}"/>
    <input class="nash-sales-in nash-sales-stk-role" data-field="role" placeholder="Role" value="${escapeHtml(st.role || '')}"/>
    <input class="nash-sales-in nash-sales-stk-msg" data-field="message" placeholder="What resonates for them…" value="${escapeHtml(st.message || '')}"/>
    <button class="nash-sales-rowdel" type="button" data-del-stk="${i}" aria-label="Remove">${ICONS.close}</button>
  </div>`;
}

/* A read-only touchpoint record on the timeline; click it to edit in the popup. */
function salesActionRow(act) {
  const typeCls = { Business: 'biz', IT: 'it', Partner: 'partner' }[act.type] || 'na';
  const statusCls = { 'In progress': 'prog', Done: 'done' }[act.status] || 'planned';
  const icon = ACTION_TYPE_ICON[act.type] || ACTION_TYPE_ICON['—'];
  const sub = [act.who, act.type && act.type !== '—' ? act.type : ''].filter(Boolean).map(escapeHtml).join(' · ');
  return `<button type="button" class="nash-sales-tl-item ${typeCls} ${statusCls}" data-edit="${escapeHtml(act.id)}">
    <div class="nash-sales-tlcard-top">
      <span class="nash-sales-tlcard-ico" aria-hidden="true">${icon}</span>
      <span class="nash-sales-tlcard-title">${escapeHtml(act.title || 'Untitled touchpoint')}</span>
    </div>
    ${sub ? `<div class="nash-sales-tlcard-sub">${sub}</div>` : ''}
    <span class="nash-sales-tp-status">${escapeHtml(act.status || 'Planned')}</span>
  </button>`;
}

/* The add/edit touchpoint popup markup (hidden until opened). */
function salesTpModalHtml() {
  return `<div class="nash-sales-tpmodal" hidden>
    <div class="nash-sales-tpmodal-backdrop" data-tpclose></div>
    <div class="nash-sales-tpmodal-card" role="dialog" aria-modal="true" aria-label="Touchpoint">
      <h3 class="nash-sales-tpmodal-title">Touchpoint</h3>
      <label class="nash-sales-field"><span>Title</span><input class="nash-sales-min" data-f="title" placeholder="What's the touchpoint?"/></label>
      <div class="nash-sales-field-row">
        <label class="nash-sales-field"><span>Who</span><input class="nash-sales-min" data-f="who" placeholder="Stakeholder(s)"/></label>
        <label class="nash-sales-field"><span>Type</span><select class="nash-sales-msel" data-f="type">${ACTION_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select></label>
      </div>
      <div class="nash-sales-field-row">
        <label class="nash-sales-field"><span>When</span><input class="nash-sales-min" data-f="date" placeholder="e.g. Aug, Q3"/></label>
        <label class="nash-sales-field"><span>Status</span><select class="nash-sales-msel" data-f="status">${ACTION_STATUSES.map((st) => `<option value="${st}">${st}</option>`).join('')}</select></label>
      </div>
      <div class="nash-sales-tpmodal-actions">
        <button type="button" class="nash-sales-tpdel" hidden>Delete</button>
        <span class="nash-sales-tpmodal-spacer"></span>
        <button type="button" class="nash-sales-btn-ghost" data-tpclose>Cancel</button>
        <button type="button" class="nash-sales-tpsave">Save</button>
      </div>
    </div>
  </div>`;
}

/* Horizontal timeline: one column per distinct "When", touchpoints stack in
   their column. Adding a touchpoint drops a record onto the timeline. */
function salesTimelineBoard(actions) {
  if (!actions.length) {
    return '<div class="nash-sales-board nash-sales-board-empty"><p class="nash-sales-empty">No touchpoints yet — add one below and set its “When” to place it on the timeline.</p></div>';
  }
  const order = [];
  const buckets = new Map();
  actions.forEach((act) => {
    const key = (act.date || '').trim() || 'Unscheduled';
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(act);
  });
  const cols = order.map((label) => `<div class="nash-sales-tlcol">
      <div class="nash-sales-tlcol-h"><span class="nash-sales-tlcol-dot"></span>${escapeHtml(label)}</div>
      <div class="nash-sales-tlcol-body">${buckets.get(label).map(salesActionRow).join('')}</div>
    </div>`).join('');
  return `<div class="nash-sales-board"><div class="nash-sales-board-track">${cols}</div></div>`;
}

function salesPanelHtml(a) {
  if (!a.reportMarkdown && !a.report) {
    return `<div class="nash-session-comingsoon">${SALES_ICONS.overview}
      <p>Run the assessment first — the sales brief is generated from it.</p></div>`;
  }
  const s = a.sales || {};
  const has = !!s.generatedAt;
  const nav = SALES_SECTIONS.map(([key, label], i) => `<button type="button" class="nash-session-qtab${i === 0 ? ' active' : ''}" data-qidx="${i}" title="${label}">${SALES_ICONS[key]}<span>${label}</span></button>`).join('');

  const empty = (what) => `<p class="nash-sales-empty">Generate the sales brief to draft ${what} from the assessment.</p>`;
  const chip = (t) => `<span class="nash-sales-play">${escapeHtml(t)}</span>`;

  const overviewLead = s.summary
    ? escapeHtml(s.summary)
    : 'Generate the sales brief for a plain-English summary of the opportunity — why Adobe fits, the pillars, tracks and plays. Attach the account plan first to make it richer.';
  const v = verdictFor(a.score);
  const highlights = has ? `<div class="nash-sales-hl">
    ${typeof a.score === 'number' ? `<span class="nash-sales-hl-score" style="color:${dimColor(a.score)}">${a.score}<i>/100 fit</i></span>` : ''}
    ${a.verdict || v.label ? `<span class="nash-session-verdict ${v.cls}">${escapeHtml(a.verdict || v.label)}</span>` : ''}
    ${(s.pillars || []).map((p) => `<span class="nash-sales-hl-tag">${escapeHtml(p.name || '')}</span>`).join('')}
  </div>` : '';
  const allPlays = has ? [...new Set((s.tracks || []).flatMap((t) => t.plays || []))] : [];
  const overview = `<div class="nash-sales-overview">
    ${s.theme ? `<p class="nash-sales-theme">${escapeHtml(s.theme)}</p>` : ''}
    <p class="nash-sales-lead">${overviewLead}</p>
    ${highlights}
    ${allPlays.length ? `<div class="nash-sales-ovsub"><span class="nash-sales-lbl">Adobe solutions in play</span><div class="nash-sales-plays">${allPlays.map(chip).join('')}</div></div>` : ''}
  </div>`;

  const pillars = has && s.pillars?.length
    ? `<div class="nash-sales-pillars">${s.pillars.map((p) => `<div class="nash-sales-card nash-sales-pillar">
        <b>${escapeHtml(p.name || '')}</b>
        ${p.objective ? `<p class="nash-sales-pillar-obj"><span class="nash-sales-lbl">Objective / challenge</span>${escapeHtml(p.objective)}</p>` : ''}
        ${(p.benefit || p.goal) ? `<p class="nash-sales-pillar-benefit"><span class="nash-sales-lbl accent">Adobe benefit</span>${escapeHtml(p.benefit || p.goal)}</p>` : ''}
        ${(p.offerings || []).length ? `<div class="nash-sales-plays">${p.offerings.map(chip).join('')}</div>` : ''}
      </div>`).join('')}</div>`
    : empty('the customer’s strategic pillars');

  const tracks = has && s.tracks?.length
    ? s.tracks.map((t, i) => `<div class="nash-sales-card nash-sales-track">
        <div class="nash-sales-track-top"><span class="nash-sales-tnum">${i + 1}</span>
          <div><div class="nash-sales-tname">${escapeHtml(t.name || '')}</div><div class="nash-sales-tpos">${escapeHtml(t.positioning || '')}</div></div></div>
        ${(t.plays || []).length ? `<div class="nash-sales-plays">${t.plays.map(chip).join('')}</div>` : ''}
        ${(t.goals || []).length ? `<ul class="nash-sales-goals">${t.goals.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>` : ''}
        ${t.status ? `<div class="nash-sales-tstatus">${escapeHtml(t.status)}</div>` : ''}
      </div>`).join('')
    : empty('the sales tracks and the Adobe plays for each');

  const stakeholders = `<div class="nash-sales-stk-list">${(s.stakeholders || []).map(salesStakeholderRow).join('')}</div>
    <button class="nash-sales-add" type="button" data-add="stk">+ Add stakeholder</button>`;

  const reportSecs = splitReportSections(a.reportMarkdown || '');
  const reportRat = reportSecs.find((sec) => sectionLabel(sec.title) === 'Rationale');
  const reportRatHtml = reportRat ? renderReportMarkdown(reportRat.md) : '';
  let rationale;
  if (has && s.rationale) {
    rationale = `<div class="nash-md nash-sales-rationale">${renderMarkdown(s.rationale)}
      ${reportRatHtml ? `<div class="nash-sales-subh"><span class="nash-sales-lbl">From the assessment — Solution Rationale</span></div>${reportRatHtml}` : ''}
    </div>`;
  } else if (reportRatHtml) {
    rationale = `<div class="nash-md nash-sales-rationale">${reportRatHtml}</div>`;
  } else {
    rationale = empty('the exec summary, proposed solutions and why they fit');
  }

  const actions = `${salesTimelineBoard(s.nextActions || [])}
    <button class="nash-sales-add" type="button" data-add="act">+ Add touchpoint</button>`;

  const panels = [overview, pillars, tracks, stakeholders, rationale, actions]
    .map((html, i) => `<div class="nash-session-qpanel${i === 0 ? ' active' : ''}" data-qidx="${i}">
      <div class="nash-session-qcard"><h3 class="nash-session-qpanel-title">${SALES_SECTIONS[i][1]}</h3>${html}</div></div>`).join('');

  const planName = s.planName ? escapeHtml(s.planName) : '';
  return `<div class="nash-session-qual nash-sales">
    ${constructionNote()}
    <div class="nash-session-qual-head">
      <div>
        <div class="nash-session-qual-account">${escapeHtml(a.company || 'Sales content')}</div>
        <div class="nash-session-qual-solution">Sales content · drafted from the assessment${planName ? ` + ${planName}` : ''}</div>
      </div>
      <div class="nash-sales-genwrap">
        <label class="nash-sales-attach" title="Attach an account plan to enrich the brief">
          <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt" hidden/>
          ${ICONS.plusadd || ICONS.plus || '+'}<span>${planName || 'Attach account plan'}</span>
        </label>
        <button class="nash-sales-gen" type="button">${has ? '↻ Regenerate brief' : '✦ Generate sales brief'}</button>
      </div>
    </div>
    <div class="nash-session-qual-layout">
      <nav class="nash-session-qual-nav">${nav}</nav>
      <div class="nash-session-qual-panels">${panels}</div>
    </div>
    ${salesTpModalHtml()}
  </div>`;
}

/* Read the editable stakeholder rows back into a.sales (touchpoints are edited
   through the popup, not inline). */
function collectSales(panel) {
  const stakeholders = [...panel.querySelectorAll('.nash-sales-stk')].map((row) => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    role: row.querySelector('[data-field="role"]').value.trim(),
    message: row.querySelector('[data-field="message"]').value.trim(),
  })).filter((st) => st.name || st.role || st.message);
  current.sales = { ...(current.sales || {}), stakeholders };
  persist(current);
}

function renderSalesContent(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="sales"]');
  if (!panel || !current) return;
  const active = panel.querySelector('.nash-session-qtab.active')?.dataset.qidx;
  panel.innerHTML = salesPanelHtml(current);
  wireSalesPanel(block);
  if (active) panel.querySelector(`.nash-session-qtab[data-qidx="${active}"]`)?.click();
}

function wireSalesPanel(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="sales"]');
  if (!panel) return;

  panel.querySelectorAll('.nash-session-qtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.nash-session-qtab').forEach((b) => b.classList.toggle('active', b === tab));
      panel.querySelectorAll('.nash-session-qpanel').forEach((p) => p.classList.toggle('active', p.dataset.qidx === tab.dataset.qidx));
    });
  });

  panel.querySelector('.nash-sales-gen')?.addEventListener('click', () => generateSalesBrief(block));

  // Attach an account plan — its text enriches the generated brief.
  panel.querySelector('.nash-sales-attach input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await extractFileText(file);
    current.sales = { ...(current.sales || {}), planName: file.name, planText: text };
    persist(current);
    renderSalesContent(block);
  });

  // Add stakeholder (inline); add touchpoint opens the popup.
  panel.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    current.sales = current.sales || {};
    if (btn.dataset.add === 'stk') {
      current.sales.stakeholders = [...(current.sales.stakeholders || []), { name: '', role: '', message: '' }];
      persist(current);
      renderSalesContent(block);
    } else {
      openTpModal(panel, null);
    }
  }));

  panel.querySelectorAll('[data-del-stk]').forEach((btn) => btn.addEventListener('click', () => {
    collectSales(panel);
    current.sales.stakeholders.splice(Number(btn.dataset.delStk), 1);
    persist(current);
    renderSalesContent(block);
  }));

  // Click a timeline record to edit it in the popup.
  panel.querySelectorAll('.nash-sales-tl-item[data-edit]').forEach((card) => card.addEventListener('click', () => {
    const act = (current.sales?.nextActions || []).find((a) => a.id === card.dataset.edit);
    if (act) openTpModal(panel, act);
  }));

  wireTpModal(block, panel);

  panel.querySelectorAll('.nash-sales-stk .nash-sales-in').forEach((el) => {
    el.addEventListener('blur', () => collectSales(panel));
    el.addEventListener('change', () => collectSales(panel));
  });
}

/* Open the touchpoint popup; act === null adds a new one. */
function openTpModal(panel, act) {
  const modal = panel.querySelector('.nash-sales-tpmodal');
  if (!modal) return;
  modal.dataset.editing = act?.id || '';
  modal.querySelector('[data-f="title"]').value = act?.title || '';
  modal.querySelector('[data-f="who"]').value = act?.who || '';
  modal.querySelector('[data-f="type"]').value = act?.type || '—';
  modal.querySelector('[data-f="date"]').value = act?.date || '';
  modal.querySelector('[data-f="status"]').value = act?.status || 'Planned';
  modal.querySelector('.nash-sales-tpmodal-title').textContent = act ? 'Edit touchpoint' : 'New touchpoint';
  modal.querySelector('.nash-sales-tpdel').hidden = !act;
  modal.hidden = false;
  modal.querySelector('[data-f="title"]').focus();
}

function wireTpModal(block, panel) {
  const modal = panel.querySelector('.nash-sales-tpmodal');
  if (!modal) return;
  const close = () => { modal.hidden = true; };

  modal.querySelectorAll('[data-tpclose]').forEach((el) => el.addEventListener('click', close));

  modal.querySelector('.nash-sales-tpsave').addEventListener('click', () => {
    const val = (f) => modal.querySelector(`[data-f="${f}"]`).value.trim();
    const { editing } = modal.dataset;
    const data = {
      title: val('title'), who: val('who'), type: val('type'), date: val('date'), status: val('status'),
    };
    current.sales = current.sales || {};
    const list = current.sales.nextActions || [];
    if (editing) {
      current.sales.nextActions = list.map((a) => (a.id === editing ? { ...a, ...data } : a));
    } else {
      current.sales.nextActions = [...list, { id: newActionId(), ...data }];
    }
    persist(current);
    close();
    renderSalesContent(block);
  });

  modal.querySelector('.nash-sales-tpdel').addEventListener('click', () => {
    const { editing } = modal.dataset;
    current.sales.nextActions = (current.sales.nextActions || []).filter((a) => a.id !== editing);
    persist(current);
    close();
    renderSalesContent(block);
  });
}

function buildSalesPrompt(a) {
  const ctx = a.context || {};
  const ctxBlock = [
    ctx.objectives ? `Objectives: ${ctx.objectives}` : '',
    ctx.challenges ? `Challenges: ${ctx.challenges}` : '',
    ctx.success ? `Success looks like: ${ctx.success}` : '',
    ctx.use_cases ? `Use cases: ${ctx.use_cases}` : '',
    ctx.tech_stack ? `Current stack: ${ctx.tech_stack}` : '',
  ].filter(Boolean).join('\n');

  return `You are an Adobe sales strategist preparing an account plan for "${a.company}". Produce a rich, SALES-facing brief (value and outcomes, not deep technical detail) that is CONSISTENT WITH and BUILDS ON the qualification dossier below — especially its "Decision" and "Use Cases" sections. Do not contradict the dossier; reuse its named Adobe products and recommended scope.

Return ONLY a JSON object between the markers, no prose, no code fences, shaped EXACTLY like:
NASH_SALES:
{
  "theme": "<one-line north-star opportunity theme, in the customer's language if present>",
  "summary": "<2-3 sentence plain-English hook: the opportunity and why Adobe, for the Overview>",
  "pillars": [
    {
      "name": "<strategic pillar / ambition>",
      "objective": "<the customer objective or challenge this pillar addresses — grounded in the dossier>",
      "benefit": "<the concrete, ideally quantified, business benefit/outcome Adobe delivers against that objective>",
      "offerings": ["<official Adobe product name>"]
    }
  ],
  "tracks": [
    {
      "name": "<sales track>",
      "positioning": "<one-line sales positioning>",
      "plays": ["<official Adobe product name>"],
      "goals": ["<short goal grounded in the dossier>"],
      "status": "<current status in a short phrase>"
    }
  ],
  "rationale": "<MARKDOWN, 250-400 words, with EXACTLY these subsections and headings:\n### Why Adobe is a strong fit\n<executive summary: 3-4 sentences on why Adobe fits this opportunity>\n### Proposed solutions & why\n- **<official Adobe product>** — what it does for this customer and WHICH objective/challenge it addresses\n(one bullet per key product in the recommended scope)\n### How it maps to their objectives\n<2-3 sentences tying the solutions back to the customer's objectives and expected outcomes>>"
}
NASH_SALES_END

Rules:
- SUMMARY: a punchy 2-3 sentence hook for the Overview.
- PILLARS (2-3): each MUST explicitly LINK a customer objective/challenge to a concrete Adobe benefit (quantify where the dossier supports it) AND the Adobe offering(s) that deliver it.
- TRACKS (2-4): ground each in the dossier's recommended scope and customer use cases; give real goals and an honest status; list the Adobe products (plays) for each.
- RATIONALE: substantial and structured as specified — an exec summary, the proposed solutions and why (per product, tied to a challenge/objective), and how it maps to objectives. This is the centrepiece; make it complete, not short.
- ADOBE NAMING: use FULL, OFFICIAL Adobe product names — e.g. "Adobe Experience Manager Sites", "Adobe Experience Manager Assets", "Adobe Journey Optimizer", "Adobe Customer Journey Analytics", "Adobe Real-Time CDP", "Adobe Analytics", "Adobe Target", "Adobe Workfront", "Adobe Firefly", "Adobe GenStudio for Performance Marketing", "Adobe Commerce", "Adobe Experience Platform Agent Orchestrator". Do NOT use internal shorthand or acronyms (no "AEM", "AJO", "CJA", "AA", "AT", "LLMO", "aaC"). Expand every one.
- Be specific and substantive; avoid generic filler.

=== CUSTOMER CONTEXT (from the assessment) ===
${ctxBlock || 'n/a'}
${a.sales?.planText ? `\n=== ACCOUNT PLAN (analyst-provided — weave in its strategic pillars, sales tracks, plays, stakeholders and status) ===\n${a.sales.planText.slice(0, MAX_DOC_CHARS)}\n` : ''}
=== DOSSIER ===
${(a.reportMarkdown || '').slice(0, MAX_DOC_CHARS)}`;
}

function parseSales(text) {
  const block = text.match(/NASH_SALES:\s*([\s\S]*?)NASH_SALES_END/i);
  let raw = block ? block[1] : text;
  const brace = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (brace >= 0 && end > brace) raw = raw.slice(brace, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function generateSalesBrief(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="sales"]');
  const btn = panel?.querySelector('.nash-sales-gen');
  if (!current?.reportMarkdown) return;
  // Preserve the analyst-entered stakeholders/actions across a regenerate.
  if (panel) collectSales(panel);
  if (btn) { btn.disabled = true; btn.textContent = 'Drafting…'; }

  let answer = '';
  await streamQualification({
    messages: [{ role: 'user', content: buildSalesPrompt(current) }],
    reasoningEffort: 'medium',
    onDelta: (d) => { answer += d; },
    onError: () => {},
    onDone: () => {},
  });

  const parsed = parseSales(answer);
  if (parsed) {
    current.sales = {
      ...(current.sales || {}),
      theme: parsed.theme || '',
      summary: parsed.summary || '',
      pillars: Array.isArray(parsed.pillars) ? parsed.pillars : [],
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
      rationale: parsed.rationale || '',
      generatedAt: Date.now(),
    };
    persist(current);
  } else if (btn) {
    btn.textContent = 'Couldn’t draft — try again';
  }
  renderSalesContent(block);
}

/* Pull the NASH_META header out of a dossier; returns { meta, body }. */
function parseMeta(text) {
  const m = text.match(/NASH_META:\s*score=(\d+)\s*\|\s*verdict=([^|]+?)\s*\|\s*cms=([^\n]*)/i);
  const meta = m
    ? { score: parseInt(m[1], 10), verdict: m[2].trim(), cms: m[3].trim() }
    : null;

  // Optional structured scorecard between NASH_DIMS: and NASH_DIMS_END.
  const dimensions = [];
  const block = text.match(/NASH_DIMS:\s*([\s\S]*?)NASH_DIMS_END/i);
  if (block) {
    block[1].split('\n').forEach((line) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 4 && parts[0]) {
        dimensions.push({
          dimension: parts[0],
          weight: /%/.test(parts[1]) ? parts[1] : `${parts[1]}%`,
          scored: parseInt(parts[2], 10) || 0,
          max: parseInt(parts[3], 10) || 0,
          notes: parts[4] || '',
          evidenceRefs: (parts[5] || '').split(',').map((id) => id.trim()).filter(Boolean),
        });
      }
    });
  }

  // Optional customer context (objectives, challenges, tech stack, success, use cases).
  const context = {};
  const cblock = text.match(/NASH_CONTEXT:\s*([\s\S]*?)NASH_CONTEXT_END/i);
  if (cblock) {
    cblock[1].split('\n').forEach((line) => {
      const kv = line.match(/^\s*([a-z_]+)\s*:\s*(.+)$/i);
      if (kv) context[kv[1].toLowerCase()] = kv[2].trim();
    });
  }

  const evidence = [];
  const eblock = text.match(/NASH_EVIDENCE:\s*([\s\S]*?)NASH_EVIDENCE_END/i);
  if (eblock) {
    eblock[1].split('\n').forEach((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const id = parts[0] || '';
      if (/^[a-z0-9_-]+$/i.test(id) && parts.length >= 5) {
        evidence.push({
          id,
          type: parts[1].toLowerCase(),
          source: parts[2],
          locator: parts[3],
          claim: parts.slice(4).join(' | '),
        });
      }
    });
  }

  const knownUrls = new Set(evidence
    .filter((item) => /^https?:\/\//i.test(item.locator))
    .map((item) => item.locator));
  const knownIds = new Set(evidence.map((item) => item.id.toLowerCase()));
  let publicIndex = 1;
  [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].forEach((match) => {
    const source = match[1].trim();
    const locator = match[2].trim();
    if (knownUrls.has(locator)) return;
    let id = `P${publicIndex}`;
    while (knownIds.has(id.toLowerCase())) {
      publicIndex += 1;
      id = `P${publicIndex}`;
    }
    evidence.push({
      id,
      type: 'public-source',
      source,
      locator,
      claim: 'Public reference cited in the assessment.',
    });
    knownUrls.add(locator);
    knownIds.add(id.toLowerCase());
    publicIndex += 1;
  });

  const confidence = [];
  const confBlock = text.match(/NASH_CONFIDENCE:\s*([\s\S]*?)NASH_CONFIDENCE_END/i);
  if (confBlock) {
    confBlock[1].split('\n').forEach((line) => {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length >= 7 && parts[0] && /^(high|medium|low)$/i.test(parts[1])) {
        confidence.push({
          dimension: parts[0],
          level: parts[1][0].toUpperCase() + parts[1].slice(1).toLowerCase(),
          swing: parts[2],
          factRefs: parts[3].split(',').map((id) => id.trim()).filter(Boolean),
          assumptions: parts[4],
          unknowns: parts[5],
          scoreChanger: parts.slice(6).join(' | '),
        });
      }
    });
  }

  const body = text
    .replace(/NASH_META:[^\n]*\n?/i, '')
    .replace(/NASH_DIMS:[\s\S]*?NASH_DIMS_END\n?/i, '')
    .replace(/NASH_CONTEXT:[\s\S]*?NASH_CONTEXT_END\n?/i, '')
    .replace(/NASH_EVIDENCE:[\s\S]*?NASH_EVIDENCE_END\n?/i, '')
    .replace(/NASH_CONFIDENCE:[\s\S]*?NASH_CONFIDENCE_END\n?/i, '')
    .trimStart();
  return {
    meta, body, dimensions, context, evidence, confidence,
  };
}

function wireEvidence(root) {
  root?.querySelectorAll('[data-evidence-ref]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const scope = trigger.closest('.nash-session-panel') || root;
      const target = [...scope.querySelectorAll('[data-evidence-id]')]
        .find((item) => item.dataset.evidenceId === trigger.dataset.evidenceRef);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
      target.classList.add('is-highlighted');
      window.setTimeout(() => target.classList.remove('is-highlighted'), 1600);
    });
  });
}

function resultTabsHtml(a, head, body) {
  const sections = splitReportSections(a.reportMarkdown || '');
  if (sections.length < 2) return `${head}${body}`;
  const nav = sections.map((section, index) => {
    const label = sectionLabel(section.title);
    return `<button type="button" class="nash-session-result-tab${index === 0 ? ' active' : ''}" data-result-index="${index}" role="tab" aria-selected="${index === 0}">${sectionIcon(label)}<span>${escapeHtml(label)}</span></button>`;
  }).join('');
  const panels = sections.map((section, index) => {
    const label = sectionLabel(section.title);
    const evidence = label === 'Evidence & Risks' ? evidencePanelHtml(a.evidence) : '';
    return `<section class="nash-session-result-panel${index === 0 ? ' active' : ''}" data-result-index="${index}" role="tabpanel">
      ${index === 0 ? head : ''}
      <div class="nash-md">${renderReportMarkdown(section.md, {}, a.evidence || [])}</div>
      ${evidence}
    </section>`;
  }).join('');
  return `<div class="nash-session-results">
    <nav class="nash-session-result-tabs" role="tablist" aria-label="Assessment results">${nav}</nav>
    <div class="nash-session-result-panels">${panels}</div>
  </div>`;
}

function wireResultTabs(root) {
  root?.querySelectorAll('.nash-session-result-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.nash-session-result-tab').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      root.querySelectorAll('.nash-session-result-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.resultIndex === tab.dataset.resultIndex);
      });
    });
  });
}

function dossierHeader(a) {
  if (typeof a.score !== 'number') return '';
  const v = verdictFor(a.score);
  return `<div class="nash-session-report-top">
    <div class="nash-session-score" style="color:${dimColor(a.score)}">${a.score}<span>/ 100</span></div>
    <span class="nash-session-verdict ${v.cls}">${escapeHtml(a.verdict || v.label)}</span>
    ${solutionsLabel(a) ? `<span class="nash-session-report-cms">${escapeHtml(solutionsLabel(a))}</span>` : ''}
  </div>`;
}

function dossierBody(a) {
  return a.reportMarkdown
    ? renderReportMarkdown(a.reportMarkdown, {}, a.evidence || [])
    : (a.reportHtml || '');
}

/* The stable assessment keeps the original continuous report format. */
function renderDossier(a) {
  return `<div class="nash-session-report nash-md">${dossierHeader(a)}${dossierBody(a)}</div>`;
}

/* The five-view experiment is exposed only through Vitor's private lab tab. */
function renderExperimentalDossier(a) {
  const body = dossierBody(a);
  if (!body) {
    if (a.report) {
      return `<div class="nash-session-experiment-note" role="note">Experimental report format · visible only to you</div>
        ${reportPanel(a.report, a.company)}`;
    }
    return '<div class="nash-session-experiment-empty"><p>Run the assessment first to test the experimental report format.</p></div>';
  }
  return `<div class="nash-session-experiment-note" role="note">Experimental report format · visible only to you</div>
    <div class="nash-session-report nash-md">${resultTabsHtml(a, dossierHeader(a), body)}</div>`;
}

function refreshExperimentPanel(block) {
  const experiment = block.querySelector('.nash-session-experiment');
  if (!experiment) return;
  experiment.innerHTML = renderExperimentalDossier(current);
  wireResultTabs(experiment);
  wireEvidence(experiment);
}

function showExperimentRunning(block) {
  const experiment = block.querySelector('.nash-session-experiment');
  if (!experiment) return;
  experiment.innerHTML = '<div class="nash-session-experiment-empty"><p>The experimental view will refresh when this assessment finishes.</p></div>';
}

/* Legacy single-file assessments → a uniform files array. */
function assessmentFiles(a) {
  if (Array.isArray(a.files) && a.files.length) return a.files;
  if (a.fileText || a.fileData) {
    return [{
      name: a.fileName || 'document', mime: a.fileMime || '', text: a.fileText || '', data: a.fileData || '',
    }];
  }
  return [];
}

/* Persist an assessment without the large file bytes (keep localStorage small).
   Published views (reconstructed from a shared page) are read-only — never write
   them into this viewer's local list. */
function persist(a) {
  if (a.published) return;
  const copy = { ...a };
  delete copy.fileData;
  delete copy.fileText;
  if (Array.isArray(copy.files)) {
    let remainingText = 500000;
    const keepDraftText = copy.status === 'draft' || copy.status === 'running';
    copy.files = copy.files.map((file) => {
      const saved = { name: file.name, mime: file.mime };
      if (keepDraftText && file.text && remainingText > 0) {
        saved.text = file.text.slice(0, remainingText);
        remainingText -= saved.text.length;
      }
      return saved;
    });
  }
  // Keep the attached account-plan text out of localStorage (size); its name is
  // kept so the UI still shows what's attached.
  if (copy.sales && copy.sales.planText) {
    copy.sales = { ...copy.sales };
    delete copy.sales.planText;
  }
  saveAssessment(copy, getUserInfo()?.email || '');
}

/* Small 3×3 pixel cluster in the chat bar; animates while the AI is thinking. */
function pixelDots() {
  return Array.from({ length: 9 }).map(() => '<i></i>').join('');
}

/* Ask FluffyJaws which checklist items the uploaded docs already answer, so we
   interview the analyst only about the gaps. Returns an array of item keys to ask. */
/* Pull solution-authored interview questions from each in-scope solution's DA
   doc (an `interview-questions` block). Lets each expert own their discovery
   questions in DA without a code change. Returns [{ key, q }], de-duplicated. */
async function fetchSolutionQuestions(slugs) {
  const lists = await Promise.all((slugs || []).map(async (slug) => {
    try {
      const r = await fetch(`/solutions/${slug}.plain.html`);
      if (!r.ok) return [];
      const div = document.createElement('div');
      div.innerHTML = await r.text();
      const blockEl = div.querySelector('.interview-questions');
      if (!blockEl) return [];
      return [...blockEl.children].map((row) => row.textContent.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }));
  const seen = new Set();
  const out = [];
  lists.flat().forEach((q) => {
    const k = q.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push({ key: `sol-${out.length}`, q }); }
  });
  return out;
}

async function analyseInterviewGaps(items, docText) {
  const checklist = items.map((it) => `${it.key}: ${it.q}`).join('\n');
  const prompt = `You are prepping an Adobe opportunity qualification. Below is the text of the customer's uploaded document(s). For each checklist item, decide whether the document already contains enough to answer it.

Return ONLY a JSON object (no prose, no code fences) shaped exactly like {"missing":["key1","key2"]}, listing the keys NOT sufficiently covered by the document. Use the exact keys.
Important: for meetingNotes, rfpInfluence and champions, treat them as covered ONLY if the document explicitly addresses them; when in doubt, include them in "missing".

CHECKLIST:
${checklist}

=== DOCUMENT ===
${docText.slice(0, MAX_DOC_CHARS)}`;
  let out = '';
  try {
    await streamQualification({
      messages: [{ role: 'user', content: prompt }],
      reasoningEffort: 'low',
      onDelta: (d) => { out += d; },
      onError: () => {},
    });
    const match = out.match(/\{[\s\S]*\}/);
    if (!match) return MANDATORY_INTERVIEW_KEYS.slice();
    const missing = JSON.parse(match[0]).missing || [];
    return missing.filter((k) => items.some((it) => it.key === k));
  } catch {
    return MANDATORY_INTERVIEW_KEYS.slice();
  }
}

function renderInterviewForm(items, answers = {}) {
  return `<form class="nash-session-interview nash-session-interview-all">
      <header class="nash-session-interview-head">
        <span class="nash-session-kicker">${items.length} open question${items.length === 1 ? '' : 's'}</span>
        <h2>Complete what you know</h2>
        <p>Answer everything in one go. Leave an answer blank or mark it unknown when the information is not available.</p>
      </header>
      <div class="nash-session-interview-list">
        ${items.map((item, index) => {
    const answer = answers[item.key] || '';
    const unknown = answer === 'Unknown';
    return `<section class="nash-session-interview-item" data-key="${escapeHtml(item.key)}">
            <div class="nash-session-interview-question">
              <span>${String(index + 1).padStart(2, '0')}</span>
              <label class="nash-session-interview-q" for="iv-${index}">${escapeHtml(item.q)}</label>
            </div>
            <textarea class="nash-session-interview-a" id="iv-${index}" rows="3" placeholder="${unknown ? 'Marked as unknown' : 'Answer in your own words'}"${unknown ? ' disabled' : ''}>${unknown ? '' : escapeHtml(answer)}</textarea>
            <label class="nash-session-interview-unknown">
              <input type="checkbox"${unknown ? ' checked' : ''}/>
              <span>I don’t know yet</span>
            </label>
          </section>`;
  }).join('')}
      </div>
      <div class="nash-session-question-actions">
        <span>Blank answers will be saved as unknown.</span>
        <button type="submit" class="nash-session-interview-run">Continue to review</button>
      </div>
    </form>`;
}

function finalReviewHtml(a) {
  const answers = a.interview?.answers || {};
  const unknowns = Object.values(answers).filter((value) => value === 'Unknown').length;
  return `<div class="nash-session-final-review">
      <span class="nash-session-kicker">Ready to assess</span>
      <h2>One last check</h2>
      <div class="nash-session-final-grid">
        <div><small>Customer</small><strong>${escapeHtml(a.company)}</strong></div>
        <div><small>Documents</small><strong>${escapeHtml(a.fileName || 'No documents')}</strong></div>
        <div><small>Adobe scope</small><strong>${escapeHtml(solutionsLabel(a) || 'To be inferred')}</strong></div>
        <div><small>Open questions</small><strong>${Object.keys(answers).length} answered${unknowns ? ` · ${unknowns} unknown` : ''}</strong></div>
      </div>
      <p>Nash will now research public sources, score the opportunity, map customer use cases to specific Adobe features, build a demo storyline, and produce a customer-specific logical architecture.</p>
      <button type="button" class="nash-session-run-final">Run assessment</button>
    </div>`;
}

async function showFinalReview(block) {
  const area = block.querySelector('.nash-session-report-area');
  block.querySelector('.nash-session-thread').innerHTML = '';
  if (!current.solutions?.length) {
    const solutions = await loadSolutions();
    area.innerHTML = setupProgressHtml(solutions);
    const stop = startSetupAnimation(area, solutions);
    const interview = interviewText(current);
    const inferred = await inferIntake([{
      name: 'Analyst discovery',
      text: `Customer: ${current.company}\n${interview}`,
    }], solutions) || {
      company: current.company,
      objectives: [],
      challenges: [],
      requirements: [],
      decisionContext: [],
      competitiveSignals: [],
      recommendedSolutions: [],
      conflicts: [],
    };
    stop();
    inferred.company = current.company;
    wireSetupReview(block, inferred, solutions, () => showFinalReview(block));
    return;
  }
  area.innerHTML = finalReviewHtml(current);
  area.querySelector('.nash-session-run-final').addEventListener('click', () => {
    area.innerHTML = '';
    runAssessment(block);
  });
}

function askInterviewQuestions(block, items, answers = {}) {
  const area = block.querySelector('.nash-session-report-area');
  if (!items.length) {
    current.interview = { answers, items: [], at: Date.now() };
    persist(current);
    showFinalReview(block);
    return;
  }
  area.innerHTML = renderInterviewForm(items, answers);
  const form = area.querySelector('.nash-session-interview');
  form.querySelectorAll('.nash-session-interview-item').forEach((item) => {
    const textarea = item.querySelector('textarea');
    const unknown = item.querySelector('input[type="checkbox"]');
    textarea.addEventListener('input', () => autoResize(textarea));
    unknown.addEventListener('change', () => {
      textarea.disabled = unknown.checked;
      textarea.placeholder = unknown.checked ? 'Marked as unknown' : 'Answer in your own words';
      if (unknown.checked) textarea.value = '';
      if (!unknown.checked) textarea.focus();
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextAnswers = { ...answers };
    form.querySelectorAll('.nash-session-interview-item').forEach((item) => {
      const { key } = item.dataset;
      const textarea = item.querySelector('textarea');
      const unknown = item.querySelector('input[type="checkbox"]');
      nextAnswers[key] = unknown.checked || !textarea.value.trim()
        ? 'Unknown'
        : textarea.value.trim();
    });
    const priorItems = current.interview?.items || [];
    const allItems = new Map([...priorItems, ...items].map((item) => [item.key, item]));
    current.interview = {
      answers: nextAnswers,
      items: [...allItems.values()],
      at: Date.now(),
    };
    persist(current);
    showFinalReview(block);
  });
}

/* The interview step: extract from docs, ask about the gaps, then run.
   Candidate questions = base (code) + solution-authored (DA). */
async function runInterview(block) {
  const thread = block.querySelector('.nash-session-thread');
  const files = assessmentFiles(current);
  const docText = files.filter((f) => f.text).map((f) => f.text).join('\n\n');
  const solItems = await fetchSolutionQuestions((current.solutions || []).map((s) => s.slug));
  const conflictItems = (current.intake?.conflicts || []).map((conflict, index) => ({
    key: `conflict-${index}`,
    q: `The documents appear to disagree: ${conflict}. Which interpretation should Nash use?`,
  }));
  const candidates = [...conflictItems, ...INTERVIEW_ITEMS, ...solItems];

  let keys;
  if (!isAuthenticated() || !docText) {
    // No doc text to gap-check against → ask the base analyst-knowledge items
    // plus every solution-authored question.
    keys = [
      ...conflictItems.map((item) => item.key),
      ...MANDATORY_INTERVIEW_KEYS,
      ...solItems.map((it) => it.key),
    ];
  } else {
    // Show the "reviewing" beat as the assistant thinking in the chat thread.
    const pending = typingIndicator(thread);
    keys = await analyseInterviewGaps(candidates, docText);
    keys = [...new Set([...conflictItems.map((item) => item.key), ...keys])];
    pending.remove();
  }

  // Docs already cover everything → show the required final confirmation.
  if (!keys.length) { showFinalReview(block); return; }

  const items = candidates.filter((it) => keys.includes(it.key));
  thread.innerHTML = '';
  askInterviewQuestions(block, items, current.interview?.answers || {});
}

/* Analyst answers, formatted for the qualification prompt. */
function interviewText(a) {
  const ans = a.interview && a.interview.answers;
  if (!ans) return '';
  const all = [...INTERVIEW_ITEMS, ...(a.interview.items || [])];
  const byKey = new Map(all.map((it) => [it.key, it.q]));
  return Object.entries(ans)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${byKey.get(k) || k}\n  ${v}`)
    .join('\n');
}

async function runAssessment(block, attempt = 1, insights = '') {
  const area = block.querySelector('.nash-session-report-area');
  showExperimentRunning(block);

  // Not connected to FluffyJaws → simulated structured report.
  if (!isAuthenticated()) {
    area.innerHTML = '<div class="nash-session-run"><span class="nash-session-typing"><i></i><i></i><i></i></span><p class="nash-session-run-text">Running the assessment…</p></div>';
    window.setTimeout(() => {
      current.report = simulateReport();
      current.status = 'done';
      persist(current);
      area.innerHTML = reportPanel(current.report, current.company);
      refreshExperimentPanel(block);
      setSetupAvailability(block, false);
      setStatusDone(block);
    }, 1100);
    return;
  }

  // Live run — ground FluffyJaws in the in-scope solution skills, stream the dossier.
  const sols = (current.solutions && current.solutions.length)
    ? current.solutions
    : [{ slug: 'aem', name: 'Adobe Experience Manager' }];
  const solutionNames = sols.map((s) => s.name).join(' and ');

  let phase = 'Starting the analysis';
  if (insights) phase = 'Re-running with your latest insights';
  else if (attempt > 1) phase = 'Retrying';
  const runningHTML = `
    <div class="nash-session-running">
      <p class="nash-session-progress-title">Building your recommendation</p>
      <div class="nash-session-working">
        <span class="nash-session-working-label">${phase} — this can take several minutes…</span>
      </div>
      ${evidenceStepsHtml(ASSESSMENT_EVIDENCE_STEPS, 1)}
      <div class="nash-session-stream"></div>
    </div>`;

  // Re-run (a report already exists): show progress as the last chat message so
  // it's visible without scrolling. Initial run: show it in the report area.
  const thread = block.querySelector('.nash-session-thread');
  const inThread = !!current.reportMarkdown && !!thread;
  const host = inThread ? addMessage(thread, 'assistant', runningHTML) : area;
  if (!inThread) area.innerHTML = runningHTML;
  const stream = host.querySelector('.nash-session-stream');
  const label = host.querySelector('.nash-session-working-label');

  const skills = await fetchSkillsText(sols.map((s) => s.slug));
  setEvidenceStep(host, 2);
  // FluffyJaws chains an Azure response per tool iteration; long loops expire the
  // chain (previous_response_not_found). Fewer searches → higher completion rate.
  // The retry is tighter still, so it's more likely to finish than the first pass.
  const maxSearches = attempt > 1 ? 3 : 6;
  // Combine every uploaded file: extracted text goes inline in the prompt;
  // binary files (pdf/docx) are attached separately.
  const files = assessmentFiles(current);
  const docText = files.filter((f) => f.text)
    .map((f) => `--- ${f.name} ---\n${f.text}`).join('\n\n');
  const attachments = files.filter((f) => f.data).map((f) => ({
    type: 'input_file',
    filename: f.name,
    file_data: f.data,
    ...(f.mime ? { mime_type: f.mime } : {}),
  }));
  const prompt = buildQualPrompt({
    company: current.company,
    fileName: files.map((f) => f.name).join(', '),
    solutionNames,
    skills,
    maxSearches,
    docText,
    interview: interviewText(current),
  });
  // On a re-run, fold in the analyst's chat discussion so the model updates the
  // report, score, and recommendation with the new insights.
  const finalPrompt = insights
    ? `${prompt}\n\n=== ANALYST DISCUSSION & NEW INSIGHTS TO INCORPORATE ===\nRegenerate the FULL assessment (all machine-readable blocks and all sections). Take the following analyst discussion into account and adjust the score, dimensions, and recommendation where warranted.\n\n${insights}`
    : prompt;
  const userContent = attachments.length
    ? [{ type: 'input_text', text: finalPrompt }, ...attachments]
    : finalPrompt;

  // Mark the run in-flight and persist, so re-opening the session mid-run resumes
  // (rather than restarting the interview) and navigating away warns the user.
  isRunning = true;
  current.status = 'running';
  current.runStartedAt = Date.now();
  persist(current);

  let answer = '';
  let thinking = '';
  let errMsg = '';

  const scroll = () => { if (inThread) scrollToBottom(thread); };
  const failMsg = (msg) => {
    // A terminal failure — the run is no longer in flight. Roll the status back so
    // re-opening offers a fresh run rather than trying to resume a dead stream.
    isRunning = false;
    current.status = 'draft';
    delete current.runStartedAt;
    persist(current);
    refreshExperimentPanel(block);
    setSetupAvailability(block, false);
    if (inThread) { host.innerHTML = renderMarkdown(msg); scroll(); return; }
    area.innerHTML = `<div class="nash-session-run"><p class="nash-session-run-text">${msg}</p><button class="nash-session-run-btn" type="button">Run assessment</button></div>`;
    block.querySelector('.nash-session-run-btn')?.addEventListener('click', () => runAssessment(block));
  };

  await streamQualification({
    messages: [{ role: 'user', content: userContent }],
    webSearch: true,
    reasoningEffort: 'medium',
    onActivity: (text) => {
      setEvidenceStep(host, 2);
      if (!answer && label) label.textContent = text;
    },
    onThinking: (d) => {
      thinking += d;
      if (!answer) { stream.textContent = thinking; scroll(); }
    },
    onDelta: (d) => {
      setEvidenceStep(host, 3);
      if (!answer && label) label.textContent = `Writing the ${solutionNames} qualification…`;
      answer += d;
      stream.textContent = answer;
      scroll();
    },
    onError: (err) => { errMsg = err.message; },
    onDone: ({ responseId }) => {
      // Azure content filter blocked the output (usually reproducing the source doc).
      if (errMsg === 'content_filter') {
        failMsg('The analysis was blocked by the content filter — usually because the report reproduced too much of the uploaded document verbatim. Run it again; the prompt now asks the model to summarise rather than echo the source.');
        return;
      }
      // No answer — usually FluffyJaws's internal response chain expired during a long
      // tool loop (previous_response_not_found). Retry once with a tighter search budget.
      if (!answer) {
        if (attempt < 2) {
          if (inThread) host.closest('.nash-session-msg')?.remove();
          runAssessment(block, attempt + 1, insights);
          return;
        }
        const expired = /previous_response_not_found/i.test(errMsg);
        failMsg(expired
          ? 'FluffyJaws ran a long multi-tool search and its internal response chain expired before writing the report (previous_response_not_found). This is a FluffyJaws-side limit on long agentic runs, not a Nash timeout. Re-running often succeeds — the prompt now caps the number of searches so it finishes sooner.'
          : `The run didn't finish${errMsg ? `: ${escapeHtml(errMsg)}` : ''}. Try again.`);
        return;
      }
      const {
        meta, body, dimensions, context, evidence, confidence,
      } = parseMeta(answer);
      current.reportMarkdown = body;
      // Version the report so the publish button can tell when the published
      // copy is behind, and clear the "notes added in chat" flag now that this
      // run has folded any discussion into the report.
      current.reportRev = Date.now();
      current.notesSinceRun = false;
      if (dimensions.length) current.dimensions = dimensions;
      if (context && Object.keys(context).length) current.context = context;
      current.evidence = evidence;
      current.confidence = confidence;
      if (meta) {
        current.score = meta.score;
        current.verdict = meta.verdict;
        current.cms = meta.cms;
      }
      // Continue this exact FluffyJaws thread in the chat (aware of doc + dossier),
      // so an immediate follow-up doesn't need to re-send the report.
      if (responseId) {
        previousResponseId = responseId;
        current.previousResponseId = responseId;
        chatGrounded = true;
      }
      current.status = 'done';
      delete current.runStartedAt;
      isRunning = false;
      area.innerHTML = renderDossier(current);
      wireEvidence(area);
      refreshExperimentPanel(block);
      persist(current);
      setSetupAvailability(block, false);
      setStatusDone(block);
      renderRerunState(block);
      logActivity('assessment'); // best-effort usage tracking
      publishAutomatically(block);
      // Replace the in-chat progress bubble with a short confirmation.
      if (inThread) {
        const s = typeof current.score === 'number'
          ? ` — fit score is now ${current.score}/100 (${escapeHtml(current.verdict || '')})` : '';
        host.innerHTML = `<p>✓ Updated the assessment${s}. The report above has been refreshed.</p>`;
        scroll();
      }
    },
  });
}

export function renderAssessment(block, a, autoRun = false) {
  current = a;
  // Start a fresh FluffyJaws thread on open; the first follow-up re-grounds it
  // with the report (stored response IDs expire, so we don't reuse them).
  previousResponseId = null;
  chatGrounded = false;
  pendingDocs = [];
  block.classList.add('wide');
  const meta = [
    a.dr ? `DR ${escapeHtml(a.dr)}` : '',
    a.fileName ? escapeHtml(a.fileName) : '',
  ].filter(Boolean).join(' · ');
  const tabs = visibleTabs();
  const experimentPanel = canViewReportExperiment()
    ? `<div class="nash-session-panel nash-session-experiment" data-panel="experiment">${renderExperimentalDossier(a)}</div>`
    : '';

  block.innerHTML = `
    <div class="nash-session-assess">
      <div class="nash-session-assess-head">
        <div>
          <h1 class="nash-session-assess-title">${escapeHtml(a.company || 'New analysis')}</h1>
          ${meta ? `<p class="nash-session-assess-meta">${meta}</p>` : ''}
        </div>
        <div class="nash-session-tabs" role="tablist">
          ${tabs.map((t, i) => `
            <button type="button" class="nash-session-tab${i === 0 ? ' active' : ''}" data-tab="${t.tab}" role="tab" aria-selected="${i === 0}" title="${t.label}" aria-label="${t.label}">
              ${ICONS[t.icon]}
            </button>`).join('')}
        </div>
      </div>
      <div class="nash-session-panels">
        <div class="nash-session-panel active" data-panel="assessment">
          <div class="nash-session-assess-scroll">
            <div class="nash-session-report-area">${a.reportMarkdown
    ? renderDossier(a)
    : reportPanel(a.report, a.company)}</div>
            <div class="nash-session-thread" aria-live="polite"></div>
          </div>
          <div class="nash-session-attachments" hidden></div>
          <form class="nash-session-composer" autocomplete="off">
            <span class="nash-session-pix" aria-hidden="true">${pixelDots()}</span>
            <textarea class="nash-session-input" rows="1" placeholder="Ask Fluffy about this assessment, or add context…" aria-label="Message Nash"></textarea>
            <button type="submit" class="nash-session-send" aria-label="Send" disabled>${ICONS.send}</button>
          </form>
          <div class="nash-session-footer">
            <div class="nash-session-footer-row">
              <div class="nash-session-footer-left">
                <button type="button" class="nash-session-footer-btn nash-session-attach" aria-label="Add documents" title="Add documents">${ICONS.plusadd}</button>
                <input class="nash-session-attach-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple hidden/>
                ${a.published ? '' : '<button type="button" class="nash-session-rerun" title="Re-run the assessment, folding in your chat with Fluffy">↻ Re-run</button>'}
                <div class="nash-session-belowbar"></div>
              </div>
              <span class="nash-session-model">${isAuthenticated() ? '<span class="nash-session-conn-dot"></span>' : ''}FluffyJaws</span>
            </div>
            <p class="nash-session-disclaimer">AI generated answers · FluffyJaws can make mistakes. Please verify important information.</p>
          </div>
        </div>
        ${experimentPanel}
        <div class="nash-session-panel" data-panel="decision">${decisionQualityHtml(a)}</div>
        <div class="nash-session-panel" data-panel="da">${daPanelHtml(a)}</div>
        <div class="nash-session-panel" data-panel="opp">${constructionNote()}${renderOppPanel(a, getUserInfo()?.name || '')}</div>
        <div class="nash-session-panel" data-panel="sales">${salesPanelHtml(a)}</div>
        <div class="nash-session-panel" data-panel="postsales">${constructionNote()}${audiencePlaceholder('Post-sales content')}</div>
      </div>
    </div>
  `;

  block.querySelectorAll('.nash-session-tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(block, t.dataset.tab));
  });
  wireDaPanel(block);
  wireResultTabs(block.querySelector('.nash-session-experiment'));
  wireEvidence(block.querySelector('.nash-session-experiment'));
  wireEvidence(block.querySelector('.nash-session-panel[data-panel="decision"]'));
  wireEvidence(block.querySelector('.nash-session-panel[data-panel="assessment"]'));
  renderBelowBar(block);
  renderRerunState(block);
  wireOppPanel(block, current, (data) => { current.opp = data; persist(current); }, getUserInfo()?.name || '');
  wireSalesPanel(block);

  const thread = block.querySelector('.nash-session-thread');
  const input = block.querySelector('.nash-session-input');
  const sendBtn = block.querySelector('.nash-session-send');

  // Always open on a clean thread — prior chat history is not replayed (the
  // report is the focus), but the composer stays so Fluffy can be asked about
  // the results. Past messages are still kept for re-run context.
  const hasReport = a.reportMarkdown || a.report || a.reportHtml;
  const willAutoRun = autoRun && !hasReport;
  // An interrupted run (status 'running', no report yet) resumes straight into the
  // assessment; a fresh draft starts with the pre-assessment interview.
  const willResume = willAutoRun && a.status === 'running';
  // A brand-new analysis (no customer yet) opens straight into the intake step.
  const willIntake = willAutoRun && !a.company;
  let openingMsg;
  if (hasReport) {
    openingMsg = `Ask me anything about the <strong>${escapeHtml(a.company)}</strong> assessment above — scope, risks, competitors, next steps.`;
  } else if (willIntake) {
    openingMsg = 'Let\'s set up a new opportunity assessment. Add the details below and I\'ll review your documents, ask about anything that\'s missing, then run the full assessment.';
  } else if (willResume) {
    openingMsg = `Picking your <strong>${escapeHtml(a.company)}</strong> assessment back up — it was still running when you left, so I'm continuing it now.`;
  } else if (willAutoRun) {
    openingMsg = `Let's get started on <strong>${escapeHtml(a.company)}</strong>. I'll review your documents first and ask about anything that's missing, then run the full assessment.`;
  } else {
    openingMsg = `I've created the assessment for <strong>${escapeHtml(a.company)}</strong>. Once it runs I'll share the fit score, verdict, red flags, and recommendations here.`;
  }
  if (!willIntake) addMessage(thread, 'assistant', openingMsg);

  const syncSend = () => {
    sendBtn.disabled = input.value.trim().length === 0 && pendingDocs.length === 0;
  };
  input.addEventListener('input', () => { autoResize(input); syncSend(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(block, input.value); }
  });
  block.querySelector('.nash-session-composer').addEventListener('submit', (e) => {
    e.preventDefault();
    send(block, input.value);
  });

  // Attach documents in the composer — their text is folded into the next Fluffy
  // message (and into current.files so a re-run picks them up too).
  const attachInput = block.querySelector('.nash-session-attach-input');
  const chips = block.querySelector('.nash-session-attachments');
  const renderChips = () => {
    chips.hidden = pendingDocs.length === 0;
    chips.innerHTML = pendingDocs.map((d, i) => `<span class="nash-session-chip">${ICONS.doc}<span>${escapeHtml(d.name)}</span><button type="button" data-i="${i}" aria-label="Remove ${escapeHtml(d.name)}">&times;</button></span>`).join('');
    chips.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      pendingDocs.splice(Number(b.dataset.i), 1);
      renderChips();
      syncSend();
    }));
    syncSend();
  };
  block.querySelector('.nash-session-attach').addEventListener('click', () => attachInput.click());
  attachInput.addEventListener('change', async () => {
    const picked = [...attachInput.files];
    attachInput.value = '';
    const extracted = await Promise.all(
      picked.map(async (f) => ({ name: f.name, text: await extractFileText(f) })),
    );
    pendingDocs.push(...extracted);
    renderChips();
  });

  // No manual "Run assessment" step — when the view opens without a report yet
  // (fresh creation, or a reopened unfinished run) we begin the pre-assessment
  // interview, which reviews the docs, asks about gaps, then runs the assessment.
  if (willIntake) runIntake(block);
  else if (willResume) {
    setSetupAvailability(block, true);
    runAssessment(block, 1, '');
  } else if (willAutoRun) {
    setSetupAvailability(block, true);
    runInterview(block);
  }

  if (!a.published && hasReport && (!a.publishedUrl || a.reportRev !== a.publishedRev)) {
    publishAutomatically(block);
  }

  block.querySelector('.nash-session-rerun')?.addEventListener('click', () => {
    switchTab(block, 'assessment');
    runAssessment(block, 1, chatInsightsText());
  });
}

/* The chat discussion as plain text, to fold into a re-run. */
function chatInsightsText() {
  if (!current || !Array.isArray(current.messages)) return '';
  return current.messages
    .filter((m) => m && m.content)
    .map((m) => `${m.role === 'user' ? 'Analyst' : 'Fluffy'}: ${m.content}`)
    .join('\n\n')
    .slice(0, 20000);
}

/* Switch the active assessment tab (assessment | da | opp). */
function switchTab(block, name) {
  block.querySelectorAll('.nash-session-tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  block.querySelectorAll('.nash-session-panel').forEach((p) => {
    p.classList.toggle('active', p.dataset.panel === name);
  });
}

/* Compact context so FluffyJaws can answer follow-ups grounded in the assessment,
   even after a reload when the previous response thread has expired. */
function buildChatContext(a) {
  const head = [
    `Company: ${a.company}`,
    typeof a.score === 'number' ? `Fit score: ${a.score}/100 — ${a.verdict || verdictFor(a.score).label}` : '',
    a.cms && a.cms.toLowerCase() !== 'n/a' ? `Detected platform: ${a.cms}` : '',
    a.solutions?.length ? `Solutions in scope: ${a.solutions.map((s) => s.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');
  const report = (a.reportMarkdown
    || (a.reportHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).slice(0, 40000);
  return `You previously produced this Adobe qualification assessment. Answer my follow-up questions using it as the source of truth; be specific and reference its findings.

${head}

=== ASSESSMENT REPORT ===
${report}`;
}

async function send(block, text) {
  const value = text.trim();
  if ((!value && !pendingDocs.length) || !current) return;
  const thread = block.querySelector('.nash-session-thread');
  const input = block.querySelector('.nash-session-input');

  // Take any composer attachments for this turn, then clear the chips.
  const docs = pendingDocs;
  pendingDocs = [];
  const chips = block.querySelector('.nash-session-attachments');
  if (chips) { chips.hidden = true; chips.innerHTML = ''; }

  const question = value || 'Please factor in the attached document(s) in your answer.';
  const docNote = docs.length
    ? ` <span class="nash-session-msg-files">📎 ${docs.length} file${docs.length > 1 ? 's' : ''}</span>` : '';
  addMessage(thread, 'user', escapeHtml(question) + docNote);
  input.value = '';
  autoResize(input);
  block.querySelector('.nash-session-send').disabled = true;

  current.messages.push({ role: 'user', content: question });
  // Chat notes only reach the report on a re-run — flag it so the Re-run button
  // shows it's needed (the published/report copy is now behind the discussion).
  if (current.reportMarkdown || current.report) {
    current.notesSinceRun = true;
    renderRerunState(block);
  }
  // Fold attached docs into current.files so a later re-run includes them too.
  docs.filter((d) => d.text).forEach((d) => {
    current.files = [...(current.files || []), {
      name: d.name, mime: '', text: d.text, data: '',
    }];
  });
  persist(current);

  const docsText = docs.length
    ? `\n\n=== ATTACHED DOCUMENT(S) ===\n${docs.map((d) => `--- ${d.name} ---\n${d.text || '(this file could not be read)'}`).join('\n\n')}`
    : '';

  // First turn after opening: prepend the assessment context and start a fresh
  // thread. Later turns continue via previousResponseId.
  const needsContext = !chatGrounded
    && (current.reportMarkdown || current.report || current.reportHtml);
  const payload = needsContext
    ? `${buildChatContext(current)}${docsText}\n\n---\n\nMy question: ${question}`
    : `${question}${docsText}`;

  const composer = block.querySelector('.nash-session-composer');
  composer?.classList.add('is-thinking');
  const typing = typingIndicator(thread);
  let bubble = null;
  let answer = '';
  let thinking = '';

  await streamQualification({
    messages: [{ role: 'user', content: payload }],
    previousResponseId: needsContext ? null : previousResponseId,
    onThinking: (delta) => {
      thinking += delta;
      if (!bubble) {
        typing.remove();
        bubble = addMessage(thread, 'assistant', '');
      }
      if (!answer) { bubble.textContent = thinking; scrollToBottom(thread); }
    },
    onDelta: (delta) => {
      if (!bubble) { typing.remove(); bubble = addMessage(thread, 'assistant', ''); }
      answer += delta;
      bubble.textContent = answer;
      scrollToBottom(thread);
    },
    onDone: ({ responseId }) => {
      const content = answer || thinking;
      if (!content) {
        // Nothing came back (e.g. the thread expired mid-turn) — re-ground next time.
        if (!bubble) typing.remove(); else bubble.remove();
        chatGrounded = false;
        previousResponseId = null;
        addMessage(thread, 'assistant', 'I didn’t get a response that time — ask again and I’ll re-read the assessment.');
        return;
      }
      if (responseId) previousResponseId = responseId;
      chatGrounded = true;
      bubble.innerHTML = renderMarkdown(content);
      current.messages.push({ role: 'assistant', content });
      current.previousResponseId = previousResponseId;
      persist(current);
    },
    onError: (err) => {
      typing.remove();
      // If FluffyJaws' thread expired, drop it so the next question re-grounds.
      if (/previous_response_not_found/i.test(err.message)) {
        chatGrounded = false;
        previousResponseId = null;
      }
      addMessage(thread, 'assistant', escapeHtml(`Something went wrong reaching FluffyJaws: ${err.message}`));
    },
  });
  composer?.classList.remove('is-thinking');
}

/**
 * loads and decorates the nash-session block.
 * Default: launcher (buttons + new-analysis modal).
 * With ?a=<id>: the assessment view with its chat.
 * @param {Element} block The block element
 */
async function loadSolutions() {
  try {
    const r = await fetch('/solutions/query.json');
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data || [])
      .filter((s) => s.path && s.path !== '/solutions/index' && !s.path.endsWith('/'))
      .map((s) => ({ slug: (s.path || '').split('/').pop(), name: (s.title || '').replace(/\s*\|.*$/, '').trim() }))
      .filter((s) => s.slug && s.name);
  } catch {
    return [];
  }
}

export default async function decorate(block) {
  const name = 'Vitor';
  const id = new URLSearchParams(window.location.search).get('a');
  const assessment = id ? getAssessment(id) : null;

  // A live FluffyJaws stream can't survive a full page load, so warn before the
  // user navigates away mid-run. If they leave anyway, re-opening the session
  // resumes the run (see willResume in renderAssessment).
  window.addEventListener('beforeunload', (e) => {
    if (isRunning) { e.preventDefault(); e.returnValue = ''; }
  });

  if (assessment) {
    // autoRun only takes effect when there's no report yet, so a finished
    // assessment just re-opens, while an unfinished one restarts automatically.
    renderAssessment(block, assessment, true);
  } else {
    renderLauncher(block, name);
  }

  // "New Session" in the sidebar returns to the launcher.
  document.addEventListener('nash:new-session', () => {
    if (new URLSearchParams(window.location.search).get('a')) {
      window.location.href = '/indextest';
    } else {
      current = null;
      previousResponseId = null;
      renderLauncher(block, name);
    }
  });
}
