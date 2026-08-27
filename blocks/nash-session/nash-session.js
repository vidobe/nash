/* eslint-disable no-use-before-define */

import { streamQualification } from '../../scripts/fluffyjaws.js';
import {
  saveAssessment, getAssessment, newAssessmentId,
} from '../../scripts/nash-assessments.js';
import { isAuthenticated, login, getUserInfo } from '../../scripts/nash-auth.js';
import { publishAssessment } from '../../scripts/da-publish.js';
import { renderOppPanel, wireOppPanel } from '../../scripts/nash-opp.js';

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
  cloud: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  sales: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  postsales: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>',
  plusadd: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

const TABS = [
  { tab: 'assessment', icon: 'clipboard', label: 'Assessment' },
  { tab: 'da', icon: 'cloud', label: 'DA content' },
  { tab: 'opp', icon: 'briefcase', label: 'Opp management' },
  // Audience-targeted outputs — placeholders for now, no generation logic yet.
  { tab: 'sales', icon: 'sales', label: 'Sales content' },
  { tab: 'postsales', icon: 'postsales', label: 'Post-sales content' },
];

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

function renderReportMarkdown(src, opts) {
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

/* The intake form, shown as the first card of the in-chat questionnaire. */
function renderIntake(solutions) {
  return `<form class="nash-session-intake">
      <p class="nash-session-interview-lead">A few details to set up the assessment.</p>
      <div class="nash-session-field-row">
        <div class="nash-session-field">
          <label class="nash-session-flabel" for="na-company">Customer name</label>
          <input class="nash-session-finput" id="na-company" name="company" type="text" placeholder="e.g. Ministry of Defence" required/>
        </div>
        <div class="nash-session-field">
          <label class="nash-session-flabel" for="na-dr">Deal Registration (DR)</label>
          <input class="nash-session-finput" id="na-dr" name="dr" type="text" placeholder="DR3513652"/>
        </div>
      </div>
      <div class="nash-session-field">
        <label class="nash-session-flabel">Documents (PDF, Word, Excel — you can add several)</label>
        <label class="nash-session-drop" for="na-file">
          <span class="nash-session-drop-icon" aria-hidden="true">${ICONS.upload}</span>
          <span class="nash-session-drop-text">Click to upload <span class="nash-session-drop-sub">or drag files here</span></span>
          <input id="na-file" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" multiple hidden/>
        </label>
      </div>
      <div class="nash-session-field">
        <label class="nash-session-flabel">Solutions in scope</label>
        ${solutions.length ? `<div class="nash-session-solgrid">
          ${solutions.map((s) => `
            <label class="nash-session-solchip">
              <input type="checkbox" name="solutions" value="${s.slug}" data-name="${escapeHtml(s.name)}"/>
              <span>${escapeHtml(s.name)}</span>
            </label>
          `).join('')}
        </div>` : '<p class="nash-session-flabel" style="font-weight:400">No solution files found.</p>'}
      </div>
    </form>`;
}

/* First step of the questionnaire: collect intake in-chat, then flow into the
   gap interview and the run. */
async function runIntake(block) {
  const thread = block.querySelector('.nash-session-thread');
  const solutions = await loadSolutions();
  const bubble = addMessage(thread, 'assistant-cont', renderIntake(solutions));
  const form = bubble.querySelector('.nash-session-intake');

  // File upload: reflect the chosen file + drag-and-drop.
  const drop = form.querySelector('.nash-session-drop');
  const fileInput = form.querySelector('#na-file');
  const showFile = () => {
    const fs = [...fileInput.files];
    const textEl = drop.querySelector('.nash-session-drop-text');
    if (fs.length) {
      drop.classList.add('has-file');
      drop.querySelector('.nash-session-drop-icon').innerHTML = ICONS.doc;
      const label = fs.length === 1 ? escapeHtml(fs[0].name) : `${fs.length} files`;
      const names = fs.map((f) => escapeHtml(f.name)).join(', ');
      textEl.innerHTML = `${label}<span class="nash-session-drop-sub">${fs.length === 1 ? `${(fs[0].size / 1024 / 1024).toFixed(1)} MB` : names} · click to change</span>`;
    }
  };
  fileInput.addEventListener('change', showFile);
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('dragging')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; showFile(); }
  });

  // The action lives inside the chat bar and only appears once a customer name
  // is entered.
  const composer = block.querySelector('.nash-session-composer');
  const sendBtn = composer.querySelector('.nash-session-send');
  const companyInput = form.company;
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'nash-session-intake-start';
  startBtn.textContent = 'Start assessment';
  startBtn.hidden = true;
  composer.classList.add('intake-mode');
  composer.insertBefore(startBtn, sendBtn);

  const syncStart = () => { startBtn.hidden = companyInput.value.trim().length === 0; };
  companyInput.addEventListener('input', syncStart);
  syncStart();

  startBtn.addEventListener('click', async () => {
    const company = companyInput.value.trim();
    if (!company) { companyInput.focus(); return; }
    startBtn.disabled = true;
    startBtn.textContent = 'Setting up…';

    const sols = [...form.querySelectorAll('input[name="solutions"]:checked')]
      .map((c) => ({ slug: c.value, name: c.dataset.name }));
    const files = await processFiles([...form.file.files]);
    let fileName = '';
    if (files.length === 1) fileName = files[0].name;
    else if (files.length) fileName = `${files.length} files`;

    Object.assign(current, {
      company, dr: form.dr.value.trim(), fileName, files, solutions: sols,
    });
    persist(current);
    // Now that we know the customer, fill in the session header.
    const title = block.querySelector('.nash-session-assess-title');
    if (title) title.textContent = company;

    composer.classList.remove('intake-mode');
    startBtn.remove();
    form.closest('.nash-session-msg')?.remove();
    runInterview(block);
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
    docLine = `The full contents of the attached document(s) (${fileName}) are included at the END of this prompt under "=== ATTACHED DOCUMENT ===" (each preceded by its filename). Read them there directly — no tool or code interpreter is needed. These are the PRIMARY input and the basis for Sections 3–5; ground the requirement analysis and scoring in them.`;
  } else if (fileName) {
    docLine = `MANDATORY FIRST STEP: Document(s) are attached (${fileName}). Before any web/internal search, OPEN AND READ them (use the code interpreter if needed). They are the PRIMARY input for Sections 3–5 and do NOT count against the search budget below. If you genuinely cannot open them, say so explicitly at the top and mark scoring provisional — do not silently proceed as if no document exists.`;
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
- Tie market/news insights back into Win Sentiment and the Recommendation.
${interview ? '- Treat the ANALYST-PROVIDED CONTEXT (below) as authoritative first-party intelligence: weave champions/blockers and whether we shaped the RFI/RFP into Section 6 (Win Sentiment) and Section 7 (Recommendation), and any meeting-note context into Sections 1 and 3.\n' : ''}- CRITICAL — NO VERBATIM REPRODUCTION (a content filter will block the whole report otherwise): Write the entire dossier in your own words. Do NOT reproduce, echo, paste, or closely quote extended text from ANY source — not the attached document, and especially not analyst reports (Forrester Wave, Gartner, IDC) or other search results, which are copyrighted. When the code interpreter reads the spreadsheet, use the data for analysis but do NOT print or repeat raw rows in your answer. Do not copy competitor-comparison tables or analyst paragraphs verbatim — restate the finding in one original sentence and cite the source link. Any single quote must be under 15 words, in quotes, with attribution. Synthesise; never transcribe.
- EFFICIENCY (critical): After reading the attachment, perform AT MOST ${maxSearches} EXTERNAL searches (web + internal docs) total, batching related queries into a single call where possible, then STOP searching and write the full dossier. Reading the attached file is required and is NOT one of these searches. Do NOT exhaustively search every source — prioritise completing the report. A complete report from a few good sources beats an unfinished one.

${docLine}

Begin your response with these machine-readable lines EXACTLY in this format (the tool parses them and strips them from display):
NASH_META: score=<integer 0-100> | verdict=<Go|Conditional-Go|No-go> | cms=<detected current platform or n/a>
NASH_DIMS:
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale>
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale>
NASH_DIMS_END
Use the solution's ITS scoring dimensions for the NASH_DIMS rows (typically Strategic Fit, Technical Fit, Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk — or whatever the solution knowledge defines). ALWAYS add one more row named EXACTLY "AI & Agentic Fit" (weight ~10-15%) that scores how well Adobe Coworker, the in-scope Adobe products' agents, and their MCPs address this opportunity, and how ready the customer is to adopt them — even if the solution knowledge does not list it. Re-balance the other weights so all rows sum to 100%. The weighted scores must sum to the overall score, and Section 8 must explain this row's reasoning.
NASH_CONTEXT:
objectives: <top business objective>; <objective>; <objective>
challenges: <top pain or challenge>; <challenge>; <challenge>
tech_stack: <current tools/platforms the customer uses, or n/a>
success: <what success looks like for the customer in one or two sentences>
use_cases: <primary use case>; <use case>; <use case>
NASH_CONTEXT_END
For NASH_CONTEXT, uncover the customer's business objectives and their pains/challenges FIRST from the attached document, then from public evidence; base tech_stack, success, and use_cases on the same. If something isn't stated, infer conservatively and keep it short. Then continue with the dossier.

Produce the report in markdown with EXACTLY these ten top-level sections and NO OTHERS. Use a single "# " heading only for these ten (keep the numbers); every sub-heading, risk, or topic inside a section MUST use "## " or "### " (or bold/bullets) — never a top-level "# " heading, or it will be mistaken for a new section:
# 1. Executive Overview
# 2. Market, Competitor & Financial Intelligence
# 3. Business Analysis
# 4. Technical & Architectural Evaluation
# 5. Qualification & Discovery Questions
# 6. Competitive Positioning & Win Sentiment
# 7. Final Recommendation and Adobe Solution Scope
# 8. AI, Agents & Coworker Opportunity
# 9. Solution Rationale
# 10. Deal Accelerators & References

Section 1 must include an initial Fit Score (High / Medium / Low) for ${solutionNames} with a one-sentence rationale and why this logo matters to Adobe. Section 3 must explicitly list the customer's Top 3-5 Business Objectives and Top 3-5 Pains / Challenges as bullet lists (grounded in the attached document), plus current tech stack and what success looks like. Section 6 must include a competitor comparison table using the competitive alternatives named in the solution knowledge. Section 7 must give a Go / No-Go / Conditional-Go with reasoning, the recommended Adobe solution scope, and a crawl-walk-run roadmap.
Section 4 (Technical & Architectural Evaluation) must include a target-architecture diagram expressed ONLY as a machine-readable NASH_ARCH block — do NOT use mermaid, ASCII art, or code fences for it. Use this EXACT format, with short labels, and place it inline where the diagram belongs:
NASH_ARCH:
layers: <left-to-right layer names, semicolon-separated, e.g. Sources; Platform; Decisioning; Channels>
group: <groupId> | <Group label> | <layer name>
node: <id> | <short label> | <layer name> | <groupId or blank>
edge: <fromId> | <toId> | <flow type> | <optional short label>
NASH_ARCH_END
group lines are optional and draw a labelled red container around related nodes (use them for sub-systems such as Data Ingestion or Real-Time Profile; put the node into a group via its 4th field). Flow type is one of ingress (external data coming in), intra (movement inside the platform) or egress (data or activation going out) — it sets the arrow colour and a legend. Lay out ~4-7 layers left-to-right following the data flow, keep labels concise, and make sure every edge's ids match declared nodes.
Draw the TARGET architecture implied by THIS customer's requirements and chosen approach — include only the components they will actually use, not a generic template. For example: for a headless commerce build, show a custom / API-driven storefront (GraphQL/REST) and OMIT the Edge Delivery storefront; for a traditional build, show the EDS or PWA storefront instead. Reflect their deployment choice (PaaS vs SaaS/ACCS vs on-prem) and only the integrations actually named (ERP, PIM, OMS, payments, DAM, CDP, analytics, etc.). If a requirement is unstated, make a conservative choice and keep the node set minimal.
Section 8 (AI, Agents & Coworker Opportunity) is a first-class, customer-specific assessment of Adobe's agentic value for THIS opportunity — always include it regardless of the solutions in scope, and ground every point in the customer's objectives, challenges and stack (never a generic AI pitch). Cover these subsections with bullets:
- **Adobe Coworker fit** — how Adobe Coworker (the agentic experience for Adobe practitioners) would serve this customer's teams and day-to-day workflows, tied to their objectives and pains.
- **Product agents** — the relevant purpose-built agents across the in-scope Adobe products (and closely adjacent ones), what each agent would do for this customer, and the outcome it drives. Name only real Adobe agents; mark any you are unsure about.
- **Product MCPs** — the Model Context Protocol (MCP) servers/endpoints the in-scope Adobe products expose, and how they would connect the customer's own stack, data, and other agents/LLMs to Adobe actions and content.
- **Prioritised agentic use cases** — a short prioritised list (HIGH/MEDIUM) of concrete use cases for this customer, each with the trigger, the agent(s)/MCP involved, and the business benefit/outcome.
- **Benefits & business value** — the efficiency, speed-to-market, personalisation, quality and cost benefits of adopting Coworker/agents/MCP here, quantified or ranged where possible.
- **Readiness & prerequisites** — the data, governance, integration and skills prerequisites, plus honest risks or gaps for this customer adopting agents/MCP.
Section 9 (Solution Rationale) is a defensible, RFP-ready synthesis with these subsections, in this order: (1) Customer Context — organisation (who / structure / selection scope), objectives, challenges/bottlenecks, maturity, and the existing stack noting what to integrate vs replace; (2) Core Capability Needs — a markdown table with columns | Capability need | What the customer needs to do | Relevance (HIGH/MEDIUM/LOW) |; (3) Solution Fit Comparison — name two viable scenarios (A and B) and a markdown table | Criterion | Scenario A | Scenario B | across ~8-10 decision criteria; (4) Budget Indication — a markdown table | Cost category | Basis / driver | Indication | using placeholders such as "€ TBD" where figures are not provided; (5) Recommendation Summary — the preferred scenario with justification, honest points of attention, and next steps. Ground every point in the attached document and the analyst interview; keep table cells concise.
Section 10 (Deal Accelerators & References) must cover, as clear subsections with bullets:
- **Ideas to win the deal** — concrete plays and next best actions tailored to this opportunity's objectives and gaps.
- **VIP / early-access products** — relevant Adobe VIP, limited-availability, or newly launched products that strengthen the offer (only real ones; note if uncertain).
- **Beta features** — relevant Adobe beta / pre-release / private-beta capabilities that could differentiate, with a note that they are beta.
- **Co-innovation opportunities** — where a joint co-innovation / design-partner engagement makes sense for this customer.
- **Similar customer references** — comparable Adobe customers (same industry/use case/region where possible), each with a one-line "why relevant" and a source link. Prefer Adobe Field Readiness / internal references; only cite real, sourced references and mark any that are uncertain.

=== ADOBE SOLUTION KNOWLEDGE (ground your analysis in this) ===
${skills}
${docText ? `\n=== ATTACHED DOCUMENT (${fileName}) — PRIMARY INPUT. Analyse it; do NOT reproduce it verbatim in your answer ===\n${docText}` : ''}${interview ? `\n\n=== ANALYST-PROVIDED CONTEXT (pre-assessment interview) — authoritative first-party intelligence; weight equally with the attached document ===\n${interview}` : ''}`;
}

function setStatusDone(block) {
  current.status = 'done';
  renderBelowBar(block);
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
  if (a.reportMarkdown) body = renderReportMarkdown(a.reportMarkdown, { headings: 'real' });
  else if (a.report) body = reportPanel(a.report, a.company);
  else if (a.reportHtml) body = a.reportHtml;
  return header + body;
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
    persist(current);
    renderBelowBar(block);
    renderDaPanelContent(block);
  } catch (e) {
    trigger.disabled = false;
    trigger.textContent = original;
    const note = document.createElement('p');
    note.className = 'nash-session-publish-error';
    note.textContent = e.message;
    trigger.parentElement.appendChild(note);
  }
}

/* The area below the chat bar: Publish to DA (or the published link + re-publish). */
function renderBelowBar(block) {
  const el = block.querySelector('.nash-session-belowbar');
  if (!el || !current) return;
  if (!(current.reportMarkdown || current.report)) { el.innerHTML = ''; return; }
  if (current.publishedUrl) {
    el.innerHTML = `<span class="nash-session-published">Published to DA</span>
      <button type="button" class="nash-session-publish subtle">Re-publish</button>`;
  } else {
    el.innerHTML = '<button type="button" class="nash-session-publish">Publish to DA</button>';
  }
  el.querySelector('.nash-session-publish')?.addEventListener('click', (e) => publishCurrent(block, e.currentTarget));
}

/* DA content tab body — the published page (rendered) + live link, or a CTA. */
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
// One distinct icon per section position (standard 7-section order).
// Section nav icons, keyed by label so re-ordering sections never misaligns them.
const SECTION_ICONS = {
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
  'strategic fit': 'Overview',
  'technical fit': 'Tech Fit',
  'functional coverage': 'Rationale',
  'commercial viability': 'Business',
  'competitive position': 'Competition',
  'delivery risk': 'Tech Fit',
  'ai & agentic fit': 'AI & Agents',
};

function scorecardCards(dims, availableLabels) {
  if (!dims || !dims.length) return '';
  const labels = availableLabels || new Set();
  return `<div class="nash-session-scorecard">${dims.map((d) => {
    const pct = d.max ? Math.round((d.scored / d.max) * 100) : 0;
    const target = DIM_SECTION[(d.dimension || '').toLowerCase()];
    const linked = target && labels.has(target);
    const inner = `
      <div class="nash-session-sc-top"><span>${escapeHtml(d.dimension)}</span><span class="nash-session-sc-weight">${escapeHtml(d.weight)}</span></div>
      <div class="nash-session-sc-score">${d.scored}<span> / ${d.max}</span></div>
      <div class="nash-session-sc-bar"><div style="width:${pct}%;background:${dimColor(pct)}"></div></div>
      ${d.notes ? `<p>${escapeHtml(d.notes)}</p>` : ''}
      ${linked ? `<span class="nash-session-sc-link">See ${escapeHtml(target)} &rarr;</span>` : ''}`;
    return linked
      ? `<button type="button" class="nash-session-sc-card is-linked" data-qsection="${escapeHtml(target)}">${inner}</button>`
      : `<div class="nash-session-sc-card">${inner}</div>`;
  }).join('')}</div>`;
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
    ${i === 0 ? scorecardCards(a.dimensions, sectionLabels) : ''}
    <div class="nash-session-qcard">
      <h3 class="nash-session-qpanel-title">${escapeHtml(s.title)}</h3>
      <div class="nash-md">${renderReportMarkdown(s.md)}</div>
    </div>
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
        <span class="nash-session-published">Published to DA</span>
        ${a.published ? '' : '<button type="button" class="nash-session-publish subtle" data-da-publish>Re-publish</button>'}
      </div>`
    : `<div class="nash-session-da-bar">
        <span class="nash-session-da-note">Preview of the DA document — not published yet.</span>
        <button type="button" class="nash-session-publish" data-da-publish>Publish to DA</button>
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
}

function renderDaPanelContent(block) {
  const panel = block.querySelector('.nash-session-panel[data-panel="da"]');
  if (!panel || !current) return;
  panel.innerHTML = daPanelHtml(current);
  wireDaPanel(block);
}

/* Pull the NASH_META header out of a dossier; returns { meta, body }. */
function parseMeta(text) {
  const m = text.match(/NASH_META:\s*score=(\d+)\s*\|\s*verdict=([^|]+?)\s*\|\s*cms=([^\n]*)/i);
  if (!m) {
    return {
      meta: null, body: text, dimensions: [], context: {},
    };
  }
  const meta = { score: parseInt(m[1], 10), verdict: m[2].trim(), cms: m[3].trim() };

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

  const body = text
    .replace(/NASH_META:[^\n]*\n?/i, '')
    .replace(/NASH_DIMS:[\s\S]*?NASH_DIMS_END\n?/i, '')
    .replace(/NASH_CONTEXT:[\s\S]*?NASH_CONTEXT_END\n?/i, '')
    .trimStart();
  return {
    meta, body, dimensions, context,
  };
}

/* Renders a completed dossier: score/verdict header + markdown body. */
function renderDossier(a) {
  let head = '';
  if (typeof a.score === 'number') {
    const v = verdictFor(a.score);
    head = `<div class="nash-session-report-top">
      <div class="nash-session-score" style="color:${dimColor(a.score)}">${a.score}<span>/ 100</span></div>
      <span class="nash-session-verdict ${v.cls}">${escapeHtml(a.verdict || v.label)}</span>
      ${solutionsLabel(a) ? `<span class="nash-session-report-cms">${escapeHtml(solutionsLabel(a))}</span>` : ''}
    </div>`;
  }
  // Prefer the markdown source; fall back to pre-rendered report HTML (e.g. a
  // published page reconstructed without the original markdown).
  const body = a.reportMarkdown ? renderReportMarkdown(a.reportMarkdown) : (a.reportHtml || '');
  return `<div class="nash-session-report nash-md">${head}${body}</div>`;
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
    copy.files = copy.files.map((f) => ({ name: f.name, mime: f.mime }));
  }
  saveAssessment(copy, getUserInfo()?.email || '');
}

function pixelGrid() {
  return `<div class="nash-session-pixels" aria-hidden="true">${
    Array.from({ length: 24 }).map((unused, i) => `<span style="animation-delay:${(i % 8) * 0.1 + Math.floor(i / 8) * 0.05}s"></span>`).join('')
  }</div>`;
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

function renderInterview(items) {
  return `<form class="nash-session-interview">
      <p class="nash-session-interview-lead">A few quick questions to sharpen the assessment — I couldn't find these in your documents. Answer what you can; leave the rest blank.</p>
      ${items.map((it) => `
        <div class="nash-session-interview-item">
          <label class="nash-session-interview-q" for="iv-${it.key}">${escapeHtml(it.q)}</label>
          <textarea class="nash-session-interview-a" id="iv-${it.key}" rows="1" data-key="${it.key}" placeholder="Type your answer, or leave blank"></textarea>
        </div>`).join('')}
    </form>`;
}

function submitInterview(block, items, form) {
  const answers = {};
  items.forEach((it) => {
    const val = form.querySelector(`[data-key="${it.key}"]`)?.value.trim();
    if (val) answers[it.key] = val;
  });
  // Store the asked items (key + question) so their labels survive into the prompt.
  current.interview = {
    answers, items: items.map(({ key, q }) => ({ key, q })), at: Date.now(),
  };
  persist(current);
  form.closest('.nash-session-msg')?.remove();
  runAssessment(block);
}

/* The interview step: extract from docs, ask about the gaps, then run.
   Candidate questions = base (code) + solution-authored (DA). */
async function runInterview(block) {
  const area = block.querySelector('.nash-session-report-area');
  const thread = block.querySelector('.nash-session-thread');
  const files = assessmentFiles(current);
  const docText = files.filter((f) => f.text).map((f) => f.text).join('\n\n');
  const solItems = await fetchSolutionQuestions((current.solutions || []).map((s) => s.slug));
  const candidates = [...INTERVIEW_ITEMS, ...solItems];

  let keys;
  if (!isAuthenticated() || !docText) {
    // No doc text to gap-check against → ask the base analyst-knowledge items
    // plus every solution-authored question.
    keys = [...MANDATORY_INTERVIEW_KEYS, ...solItems.map((it) => it.key)];
  } else {
    // Show the "reviewing" beat as the assistant thinking in the chat thread.
    const pending = typingIndicator(thread);
    keys = await analyseInterviewGaps(candidates, docText);
    pending.remove();
  }

  // Docs already cover everything → straight to the assessment.
  if (!keys.length) { runAssessment(block); return; }

  // The interview reads as a continuation of the assistant's opening turn: it
  // lives in the chat thread (no second N avatar), not the report area.
  const items = candidates.filter((it) => keys.includes(it.key));
  area.innerHTML = '';
  const bubble = addMessage(thread, 'assistant-cont', renderInterview(items));
  const form = bubble.querySelector('.nash-session-interview');
  form.querySelectorAll('textarea').forEach((t) => t.addEventListener('input', () => autoResize(t)));

  // The actions ride on top of the chat bar (right-aligned) rather than inside the
  // interview bubble, so they're always reachable next to the composer.
  const composer = block.querySelector('.nash-session-composer');
  const bar = document.createElement('div');
  bar.className = 'nash-session-interview-bar';
  bar.innerHTML = `
    <button type="button" class="nash-session-interview-skip">Skip &amp; run now</button>
    <button type="button" class="nash-session-interview-run">Run assessment</button>`;
  composer.parentNode.insertBefore(bar, composer);

  bar.querySelector('.nash-session-interview-run').addEventListener('click', () => {
    bar.remove();
    submitInterview(block, items, form);
  });
  bar.querySelector('.nash-session-interview-skip').addEventListener('click', () => {
    const asked = items.map(({ key, q }) => ({ key, q }));
    current.interview = { answers: {}, items: asked, skipped: true };
    bar.remove();
    form.closest('.nash-session-msg')?.remove();
    runAssessment(block);
  });
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

  // Not connected to FluffyJaws → simulated structured report.
  if (!isAuthenticated()) {
    area.innerHTML = '<div class="nash-session-run"><span class="nash-session-typing"><i></i><i></i><i></i></span><p class="nash-session-run-text">Running the assessment…</p></div>';
    window.setTimeout(() => {
      current.report = simulateReport();
      current.status = 'done';
      persist(current);
      area.innerHTML = reportPanel(current.report, current.company);
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
      ${pixelGrid()}
      <div class="nash-session-working">
        <span class="nash-session-working-label">${phase} — this can take several minutes…</span>
      </div>
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
    if (inThread) { host.innerHTML = renderMarkdown(msg); scroll(); return; }
    area.innerHTML = `<div class="nash-session-run"><p class="nash-session-run-text">${msg}</p><button class="nash-session-run-btn" type="button">Run assessment</button></div>`;
    block.querySelector('.nash-session-run-btn')?.addEventListener('click', () => runAssessment(block));
  };

  await streamQualification({
    messages: [{ role: 'user', content: userContent }],
    webSearch: true,
    reasoningEffort: 'medium',
    onActivity: (text) => { if (!answer && label) label.textContent = text; },
    onThinking: (d) => {
      thinking += d;
      if (!answer) { stream.textContent = thinking; scroll(); }
    },
    onDelta: (d) => {
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
        meta, body, dimensions, context,
      } = parseMeta(answer);
      current.reportMarkdown = body;
      if (dimensions.length) current.dimensions = dimensions;
      if (context && Object.keys(context).length) current.context = context;
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
      persist(current);
      setStatusDone(block);
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

  block.innerHTML = `
    <div class="nash-session-assess">
      <div class="nash-session-assess-head">
        <div>
          <h1 class="nash-session-assess-title">${escapeHtml(a.company || 'New analysis')}</h1>
          ${meta ? `<p class="nash-session-assess-meta">${meta}</p>` : ''}
        </div>
        <div class="nash-session-tabs" role="tablist">
          ${TABS.map((t, i) => `
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
        <div class="nash-session-panel" data-panel="da">${daPanelHtml(a)}</div>
        <div class="nash-session-panel" data-panel="opp">${renderOppPanel(a, getUserInfo()?.name || '')}</div>
        <div class="nash-session-panel" data-panel="sales">${audiencePlaceholder('Sales content')}</div>
        <div class="nash-session-panel" data-panel="postsales">${audiencePlaceholder('Post-sales content')}</div>
      </div>
    </div>
  `;

  block.querySelectorAll('.nash-session-tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(block, t.dataset.tab));
  });
  wireDaPanel(block);
  renderBelowBar(block);
  wireOppPanel(block, current, (data) => { current.opp = data; persist(current); }, getUserInfo()?.name || '');

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
  addMessage(thread, 'assistant', openingMsg);

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
  else if (willResume) runAssessment(block, 1, '');
  else if (willAutoRun) runInterview(block);

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
