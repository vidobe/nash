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
// Whether FluffyJaws already has this assessment's context in the current thread.
// Reset on every (re)open so the first follow-up re-sends the report — FluffyJaws
// response IDs expire server-side, so we can't rely on a stored previousResponseId.
let chatGrounded = false;

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
  plusadd: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

const TABS = [
  { tab: 'assessment', icon: 'clipboard', label: 'Assessment' },
  { tab: 'da', icon: 'cloud', label: 'DA content' },
  { tab: 'opp', icon: 'briefcase', label: 'Opp management' },
];

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
   lists, inline styles, links, and GFM tables. */
function renderMarkdown(src) {
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
        out.push(`<p class="nash-md-h" data-lvl="${h[1].length}">${inlineMd(h[2])}</p>`);
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

/* ── Launcher ────────────────────────────────────────── */

function renderLauncher(block, name, solutions = []) {
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

    <div class="nash-session-modal" hidden>
      <div class="nash-session-modal-backdrop" data-close></div>
      <div class="nash-session-modal-card" role="dialog" aria-modal="true" aria-label="Create a new analysis">
        <div class="nash-session-modal-head">
          <h2 class="nash-session-modal-title">New analysis</h2>
          <button class="nash-session-modal-close" type="button" data-close aria-label="Close">${ICONS.close}</button>
        </div>
        <form class="nash-session-modal-form">
          <div class="nash-session-field">
            <label class="nash-session-flabel" for="na-company">Customer name</label>
            <input class="nash-session-finput" id="na-company" name="company" type="text" placeholder="e.g. Ministry of Defence" required/>
          </div>
          <div class="nash-session-field">
            <label class="nash-session-flabel" for="na-dr">Deal Registration (DR)</label>
            <input class="nash-session-finput" id="na-dr" name="dr" type="text" placeholder="DR3513652"/>
          </div>
          <div class="nash-session-field">
            <label class="nash-session-flabel">Document (PDF, Word, or Excel)</label>
            <label class="nash-session-drop" for="na-file">
              <span class="nash-session-drop-icon" aria-hidden="true">${ICONS.upload}</span>
              <span class="nash-session-drop-text">Click to upload <span class="nash-session-drop-sub">or drag a file here</span></span>
              <input id="na-file" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" hidden/>
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
          <div class="nash-session-modal-actions">
            <button class="nash-session-btn-ghost" type="button" data-close>Cancel</button>
            <button class="nash-session-btn-primary" type="submit">Create assessment</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = block.querySelector('.nash-session-modal');
  const openModal = () => { modal.hidden = false; block.querySelector('#na-company').focus(); };
  const closeModal = () => { modal.hidden = true; };

  block.querySelectorAll('.nash-session-launch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { action } = btn.dataset;
      if (action === 'new') openModal();
      else if (action === 'find') window.location.href = '/';
      else if (action === 'skills') window.location.href = '/solutions/';
    });
  });

  block.querySelector('.nash-session-conn-btn')?.addEventListener('click', () => login());

  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Modern file upload: reflect the chosen file + drag-and-drop.
  const drop = block.querySelector('.nash-session-drop');
  const fileInput = block.querySelector('#na-file');
  const showFile = () => {
    const f = fileInput.files[0];
    const textEl = drop.querySelector('.nash-session-drop-text');
    if (f) {
      drop.classList.add('has-file');
      drop.querySelector('.nash-session-drop-icon').innerHTML = ICONS.doc;
      textEl.innerHTML = `${escapeHtml(f.name)}<span class="nash-session-drop-sub">${(f.size / 1024 / 1024).toFixed(1)} MB · click to replace</span>`;
    }
  };
  fileInput.addEventListener('change', showFile);
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('dragging')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; showFile(); }
  });

  block.querySelector('.nash-session-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const company = form.company.value.trim();
    if (!company) return;
    const submitBtn = form.querySelector('.nash-session-btn-primary');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    const sols = [...form.querySelectorAll('input[name="solutions"]:checked')]
      .map((c) => ({ slug: c.value, name: c.dataset.name }));

    const file = form.file.files[0];
    let fileData = '';
    let fileMime = '';
    let fileText = '';
    if (file) {
      fileMime = file.type || '';
      // Parse spreadsheets/CSV in the browser so the model reads the content from
      // the prompt directly — FluffyJaws does not reliably mount uploads into its
      // code-interpreter runtime (/mnt/data), so we can't depend on that.
      fileText = await extractFileText(file);
      if (!fileText && file.size <= 4 * 1024 * 1024) {
        fileData = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => resolve('');
          fr.readAsDataURL(file);
        });
      }
    }

    const assessment = {
      id: newAssessmentId(),
      company,
      dr: form.dr.value.trim(),
      fileName: file ? file.name : '',
      fileMime,
      fileData,
      fileText,
      solutions: sols,
      status: 'draft',
      createdAt: Date.now(),
      messages: [],
    };
    // Persist metadata only (keep large file bytes/text out of localStorage); render
    // in place so the in-memory document survives for the immediate run.
    const stored = { ...assessment };
    delete stored.fileData;
    delete stored.fileText;
    saveAssessment(stored);
    current = assessment;
    previousResponseId = null;
    window.history.pushState({}, '', `/indextest?a=${encodeURIComponent(assessment.id)}`);
    renderAssessment(block, assessment);
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

const DIMENSIONS = ['Strategic Fit', 'Technical Fit', 'Functional Coverage', 'Commercial Viability', 'Competitive Position', 'Delivery Risk'];

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

function reportPanel(report, company) {
  if (!report) {
    return `
      <div class="nash-session-run">
        <p class="nash-session-run-text">Ready to qualify <strong>${escapeHtml(company)}</strong> against your solution skills.</p>
        <button class="nash-session-run-btn" type="button">Run assessment</button>
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
        ${report.cms ? `<span class="nash-session-report-cms">${escapeHtml(report.cms)}</span>` : ''}
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
 * Extracts readable text from a file in the browser. Spreadsheets/CSV are parsed
 * to CSV-per-sheet (via SheetJS, loaded on demand) so we never rely on FluffyJaws
 * mounting the upload into its tool runtime. Returns '' for formats we don't parse
 * here (pdf/docx) — those still go to the model as an input_file attachment.
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
  return '';
}

function buildQualPrompt({
  company, fileName, solutionNames, skills, maxSearches = 6, docText = '',
}) {
  let docLine;
  if (docText) {
    docLine = `The full contents of the attached document (${fileName}) are included at the END of this prompt under "=== ATTACHED DOCUMENT ===". Read them there directly — no tool or code interpreter is needed. This is the PRIMARY input and the basis for Sections 3–5; ground the requirement analysis and scoring in it.`;
  } else if (fileName) {
    docLine = `MANDATORY FIRST STEP: A document is attached (${fileName}). Before any web/internal search, OPEN AND READ IT (use the code interpreter if needed). It is the PRIMARY input for Sections 3–5 and does NOT count against the search budget below. If you genuinely cannot open it, say so explicitly at the top and mark scoring provisional — do not silently proceed as if no document exists.`;
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
- CRITICAL — NO VERBATIM REPRODUCTION (a content filter will block the whole report otherwise): Write the entire dossier in your own words. Do NOT reproduce, echo, paste, or closely quote extended text from ANY source — not the attached document, and especially not analyst reports (Forrester Wave, Gartner, IDC) or other search results, which are copyrighted. When the code interpreter reads the spreadsheet, use the data for analysis but do NOT print or repeat raw rows in your answer. Do not copy competitor-comparison tables or analyst paragraphs verbatim — restate the finding in one original sentence and cite the source link. Any single quote must be under 15 words, in quotes, with attribution. Synthesise; never transcribe.
- EFFICIENCY (critical): After reading the attachment, perform AT MOST ${maxSearches} EXTERNAL searches (web + internal docs) total, batching related queries into a single call where possible, then STOP searching and write the full dossier. Reading the attached file is required and is NOT one of these searches. Do NOT exhaustively search every source — prioritise completing the report. A complete report from a few good sources beats an unfinished one.

${docLine}

Begin your response with these machine-readable lines EXACTLY in this format (the tool parses them and strips them from display):
NASH_META: score=<integer 0-100> | verdict=<Go|Conditional-Go|No-go> | cms=<detected current platform or n/a>
NASH_DIMS:
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale>
<dimension name> | <weight %> | <scored> | <max> | <one-line rationale>
NASH_DIMS_END
Use the solution's ITS scoring dimensions for the NASH_DIMS rows (typically Strategic Fit, Technical Fit, Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk — or whatever the solution knowledge defines). The weighted scores must sum to the overall score.
NASH_CONTEXT:
objectives: <top business objective>; <objective>; <objective>
challenges: <top pain or challenge>; <challenge>; <challenge>
tech_stack: <current tools/platforms the customer uses, or n/a>
success: <what success looks like for the customer in one or two sentences>
use_cases: <primary use case>; <use case>; <use case>
NASH_CONTEXT_END
For NASH_CONTEXT, uncover the customer's business objectives and their pains/challenges FIRST from the attached document, then from public evidence; base tech_stack, success, and use_cases on the same. If something isn't stated, infer conservatively and keep it short. Then continue with the dossier.

Produce the report in markdown with exactly these sections:
# 1. Executive Overview
# 2. Market, Competitor & Financial Intelligence
# 3. Business Analysis
# 4. Technical & Architectural Evaluation
# 5. Qualification & Discovery Questions
# 6. Competitive Positioning & Win Sentiment
# 7. Final Recommendation and Adobe Solution Scope
# 8. Deal Accelerators & References

Section 1 must include an initial Fit Score (High / Medium / Low) for ${solutionNames} with a one-sentence rationale and why this logo matters to Adobe. Section 3 must explicitly list the customer's Top 3-5 Business Objectives and Top 3-5 Pains / Challenges as bullet lists (grounded in the attached document), plus current tech stack and what success looks like. Section 6 must include a competitor comparison table using the competitive alternatives named in the solution knowledge. Section 7 must give a Go / No-Go / Conditional-Go with reasoning, the recommended Adobe solution scope, and a crawl-walk-run roadmap.
Section 8 (Deal Accelerators & References) must cover, as clear subsections with bullets:
- **Ideas to win the deal** — concrete plays and next best actions tailored to this opportunity's objectives and gaps.
- **VIP / early-access products** — relevant Adobe VIP, limited-availability, or newly launched products that strengthen the offer (only real ones; note if uncertain).
- **Beta features** — relevant Adobe beta / pre-release / private-beta capabilities that could differentiate, with a note that they are beta.
- **Co-innovation opportunities** — where a joint co-innovation / design-partner engagement makes sense for this customer.
- **Similar customer references** — comparable Adobe customers (same industry/use case/region where possible), each with a one-line "why relevant" and a source link. Prefer Adobe Field Readiness / internal references; only cite real, sourced references and mark any that are uncertain.

=== ADOBE SOLUTION KNOWLEDGE (ground your analysis in this) ===
${skills}
${docText ? `\n=== ATTACHED DOCUMENT (${fileName}) — PRIMARY INPUT. Analyse it; do NOT reproduce it verbatim in your answer ===\n${docText}` : ''}`;
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
  if (a.reportMarkdown) body = renderMarkdown(a.reportMarkdown);
  else if (a.report) body = reportPanel(a.report, a.company);
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
const SECTION_ICON_POOL = [
  SVG('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  SVG('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  SVG('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>'),
  SVG('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  SVG('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  SVG('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
  SVG('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
];

/* Short nav label for a section, matched from its heading text. */
function sectionLabel(title) {
  const t = title.toLowerCase();
  if (/executive|overview/.test(t)) return 'Overview';
  if (/market|financial|intelligence/.test(t)) return 'Market';
  if (/business/.test(t)) return 'Business';
  if (/technical|architect|tech/.test(t)) return 'Tech Fit';
  if (/qualification|discovery|question/.test(t)) return 'Discovery';
  if (/accelerat|reference/.test(t)) return 'Accelerators';
  if (/competitive|win|position/.test(t)) return 'Competition';
  if (/recommendation|scope|final|verdict/.test(t)) return 'Recommendation';
  return title.replace(/^\d+[.)]\s*/, '').slice(0, 24);
}

/* Split into the numbered top-level report sections only (subsections stay in
   the body). Falls back to H1/H2 splitting if nothing is numbered. */
function splitReportSections(md) {
  if (!md) return [];
  const numbered = [];
  const anyHeading = [];
  let curN = null;
  let curH = null;
  md.split('\n').forEach((line) => {
    const num = line.match(/^#{1,4}\s*\d+[.)]\s+(.*)/);
    const head = line.match(/^#{1,2}\s+(.*)/);
    if (num) { curN = { title: num[1].trim(), md: '' }; numbered.push(curN); } else if (curN) curN.md += `${line}\n`;
    if (head) { curH = { title: head[1].trim(), md: '' }; anyHeading.push(curH); } else if (curH) curH.md += `${line}\n`;
  });
  return numbered.length >= 2 ? numbered : anyHeading;
}

/* Scorecard cards from the parsed NASH_DIMS dimensions. */
function scorecardCards(dims) {
  if (!dims || !dims.length) return '';
  return `<div class="nash-session-scorecard">${dims.map((d) => {
    const pct = d.max ? Math.round((d.scored / d.max) * 100) : 0;
    return `<div class="nash-session-sc-card">
      <div class="nash-session-sc-top"><span>${escapeHtml(d.dimension)}</span><span class="nash-session-sc-weight">${escapeHtml(d.weight)}</span></div>
      <div class="nash-session-sc-score">${d.scored}<span> / ${d.max}</span></div>
      <div class="nash-session-sc-bar"><div style="width:${pct}%;background:${dimColor(pct)}"></div></div>
      ${d.notes ? `<p>${escapeHtml(d.notes)}</p>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/* Rich, tabbed preview of the DA document — shown inside the assessment. */
function daPreviewHtml(a) {
  const sols = (a.solutions || []).map((s) => s.name).join(', ');
  const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const metaBits = [date, a.opp?.salesStage, a.cms && a.cms.toLowerCase() !== 'n/a' ? a.cms : '']
    .filter(Boolean).map((b) => `<span>${escapeHtml(b)}</span>`).join('');
  const v = verdictFor(a.score);
  const sections = splitReportSections(a.reportMarkdown);
  const nav = sections.map((s, i) => {
    const icon = SECTION_ICON_POOL[i % SECTION_ICON_POOL.length];
    return `<button type="button" class="nash-session-qtab${i === 0 ? ' active' : ''}" data-qidx="${i}" title="${escapeHtml(s.title)}">${icon}<span>${sectionLabel(s.title)}</span></button>`;
  }).join('');
  const panels = sections.map((s, i) => `<div class="nash-session-qpanel${i === 0 ? ' active' : ''}" data-qidx="${i}">
    ${i === 0 ? scorecardCards(a.dimensions) : ''}
    <h3 class="nash-session-qpanel-title">${escapeHtml(s.title)}</h3>
    <div class="nash-md">${renderMarkdown(s.md)}</div>
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
  const hasReport = a.reportMarkdown || a.report;
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
        <button type="button" class="nash-session-publish subtle" data-da-publish>Re-publish</button>
      </div>`
    : `<div class="nash-session-da-bar">
        <span class="nash-session-da-note">Preview of the DA document — not published yet.</span>
        <button type="button" class="nash-session-publish" data-da-publish>Publish to DA</button>
      </div>`;
  return `<div class="nash-session-da">${bar}${a.reportMarkdown ? daPreviewHtml(a) : reportPanel(a.report, a.company)}</div>`;
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
      ${a.cms && a.cms.toLowerCase() !== 'n/a' ? `<span class="nash-session-report-cms">${escapeHtml(a.cms)}</span>` : ''}
    </div>`;
  }
  return `<div class="nash-session-report nash-md">${head}${renderMarkdown(a.reportMarkdown || '')}</div>`;
}

/* Persist an assessment without the large file bytes (keep localStorage small). */
function persist(a) {
  const copy = { ...a };
  delete copy.fileData;
  saveAssessment(copy);
}

function pixelGrid() {
  return `<div class="nash-session-pixels" aria-hidden="true">${
    Array.from({ length: 24 }).map((unused, i) => `<span style="animation-delay:${(i % 8) * 0.1 + Math.floor(i / 8) * 0.05}s"></span>`).join('')
  }</div>`;
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
  area.innerHTML = `
    <div class="nash-session-running">
      ${pixelGrid()}
      <div class="nash-session-working">
        <span class="nash-session-working-label">${phase} — this can take several minutes…</span>
      </div>
      <div class="nash-session-stream"></div>
    </div>`;
  const stream = area.querySelector('.nash-session-stream');
  const label = area.querySelector('.nash-session-working-label');

  const skills = await fetchSkillsText(sols.map((s) => s.slug));
  // FluffyJaws chains an Azure response per tool iteration; long loops expire the
  // chain (previous_response_not_found). Fewer searches → higher completion rate.
  // The retry is tighter still, so it's more likely to finish than the first pass.
  const maxSearches = attempt > 1 ? 3 : 6;
  const prompt = buildQualPrompt({
    company: current.company,
    fileName: current.fileName,
    solutionNames,
    skills,
    maxSearches,
    docText: current.fileText || '',
  });
  // On a re-run, fold in the analyst's chat discussion so the model updates the
  // report, score, and recommendation with the new insights.
  const finalPrompt = insights
    ? `${prompt}\n\n=== ANALYST DISCUSSION & NEW INSIGHTS TO INCORPORATE ===\nRegenerate the FULL assessment (all machine-readable blocks and all sections). Take the following analyst discussion into account and adjust the score, dimensions, and recommendation where warranted.\n\n${insights}`
    : prompt;
  // If we already extracted the document text (spreadsheets/CSV), it's embedded in
  // the prompt — send text only. Otherwise (pdf/docx) attach the raw bytes.
  const userContent = (!current.fileText && current.fileData)
    ? [
      { type: 'input_text', text: finalPrompt },
      {
        type: 'input_file',
        filename: current.fileName,
        file_data: current.fileData,
        ...(current.fileMime ? { mime_type: current.fileMime } : {}),
      },
    ]
    : finalPrompt;
  let answer = '';
  let thinking = '';
  let errMsg = '';

  await streamQualification({
    messages: [{ role: 'user', content: userContent }],
    webSearch: true,
    reasoningEffort: 'medium',
    onActivity: (text) => { if (!answer && label) label.textContent = text; },
    onThinking: (d) => {
      thinking += d;
      if (!answer) stream.textContent = thinking;
    },
    onDelta: (d) => {
      if (!answer && label) label.textContent = `Writing the ${solutionNames} qualification…`;
      answer += d;
      stream.textContent = answer;
    },
    onError: (err) => { errMsg = err.message; },
    onDone: ({ responseId }) => {
      const fail = (msg) => {
        area.innerHTML = `<div class="nash-session-run"><p class="nash-session-run-text">${msg}</p><button class="nash-session-run-btn" type="button">Run assessment</button></div>`;
        block.querySelector('.nash-session-run-btn')?.addEventListener('click', () => runAssessment(block));
      };
      // Azure content filter blocked the output (usually reproducing the source doc).
      if (errMsg === 'content_filter') {
        fail('The analysis was blocked by the content filter — usually because the report reproduced too much of the uploaded document verbatim. Run it again; the prompt now asks the model to summarise rather than echo the source.');
        return;
      }
      // No answer — usually FluffyJaws's internal response chain expired during a long
      // tool loop (previous_response_not_found). Retry once with a tighter search budget.
      if (!answer) {
        if (attempt < 2) { runAssessment(block, attempt + 1, insights); return; }
        const expired = /previous_response_not_found/i.test(errMsg);
        fail(expired
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
      area.innerHTML = renderDossier(current);
      persist(current);
      setStatusDone(block);
    },
  });
}

function renderAssessment(block, a) {
  current = a;
  // Start a fresh FluffyJaws thread on open; the first follow-up re-grounds it
  // with the report (stored response IDs expire, so we don't reuse them).
  previousResponseId = null;
  chatGrounded = false;
  block.classList.add('wide');
  const meta = [
    a.dr ? `DR ${escapeHtml(a.dr)}` : '',
    a.fileName ? escapeHtml(a.fileName) : '',
  ].filter(Boolean).join(' · ');

  block.innerHTML = `
    <div class="nash-session-assess">
      <a class="nash-session-back" href="/indextest">${ICONS.back} New session</a>
      <div class="nash-session-assess-head">
        <div>
          <h1 class="nash-session-assess-title">${escapeHtml(a.company)}</h1>
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
          <form class="nash-session-composer" autocomplete="off">
            <textarea class="nash-session-input" rows="1" placeholder="Ask Fluffy about this assessment, or add context…" aria-label="Message Nash"></textarea>
            <button type="submit" class="nash-session-send" aria-label="Send" disabled>${ICONS.send}</button>
          </form>
          <div class="nash-session-footer">
            <div class="nash-session-footer-left">
              <button type="button" class="nash-session-footer-btn" aria-label="Add documents" title="Add documents">${ICONS.plusadd}</button>
              <button type="button" class="nash-session-rerun" title="Re-run the assessment, folding in your chat with Fluffy">↻ Re-run</button>
              <div class="nash-session-belowbar"></div>
            </div>
            <span class="nash-session-model">FluffyJaws</span>
          </div>
        </div>
        <div class="nash-session-panel" data-panel="da">${daPanelHtml(a)}</div>
        <div class="nash-session-panel" data-panel="opp">${renderOppPanel(a, getUserInfo()?.name || '')}</div>
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

  if (a.messages.length === 0) {
    const hasReport = a.reportMarkdown || a.report;
    addMessage(thread, 'assistant', hasReport
      ? `Ask me anything about the <strong>${escapeHtml(a.company)}</strong> assessment above — scope, risks, competitors, next steps.`
      : `I've created the assessment for <strong>${escapeHtml(a.company)}</strong>. Once it runs I'll share the fit score, verdict, red flags, and recommendations here.`);
  } else {
    a.messages.forEach((m) => addMessage(thread, m.role, m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content)));
  }

  input.addEventListener('input', () => {
    autoResize(input);
    sendBtn.disabled = input.value.trim().length === 0;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(block, input.value); }
  });
  block.querySelector('.nash-session-composer').addEventListener('submit', (e) => {
    e.preventDefault();
    send(block, input.value);
  });

  const runBtn = block.querySelector('.nash-session-run-btn');
  if (runBtn) runBtn.addEventListener('click', () => runAssessment(block));

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
  const report = (a.reportMarkdown || '').slice(0, 40000);
  return `You previously produced this Adobe qualification assessment. Answer my follow-up questions using it as the source of truth; be specific and reference its findings.

${head}

=== ASSESSMENT REPORT ===
${report}`;
}

async function send(block, text) {
  const value = text.trim();
  if (!value || !current) return;
  const thread = block.querySelector('.nash-session-thread');
  const input = block.querySelector('.nash-session-input');

  addMessage(thread, 'user', escapeHtml(value));
  input.value = '';
  autoResize(input);
  block.querySelector('.nash-session-send').disabled = true;

  current.messages.push({ role: 'user', content: value });
  persist(current);

  // First turn after opening: prepend the assessment context and start a fresh
  // thread. Later turns continue via previousResponseId.
  const needsContext = !chatGrounded && (current.reportMarkdown || current.report);
  const payload = needsContext
    ? `${buildChatContext(current)}\n\n---\n\nMy question: ${value}`
    : value;

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

  if (assessment) {
    renderAssessment(block, assessment);
  } else {
    renderLauncher(block, name, await loadSolutions());
  }

  // "New Session" in the sidebar returns to the launcher.
  document.addEventListener('nash:new-session', async () => {
    if (new URLSearchParams(window.location.search).get('a')) {
      window.location.href = '/indextest';
    } else {
      current = null;
      previousResponseId = null;
      renderLauncher(block, name, await loadSolutions());
    }
  });
}
