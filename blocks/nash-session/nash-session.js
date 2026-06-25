/* eslint-disable no-use-before-define */

import { streamQualification } from '../../scripts/fluffyjaws.js';
import {
  saveAssessment, getAssessment, newAssessmentId,
} from '../../scripts/nash-assessments.js';
import { isAuthenticated, login } from '../../scripts/nash-auth.js';

let previousResponseId = null;
let current = null; // assessment being viewed in chat mode

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  layers: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  attach: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  send: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

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
            <label class="nash-session-flabel" for="na-file">Document (PDF, Word, or Excel)</label>
            <input class="nash-session-finput nash-session-file" id="na-file" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"/>
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
    if (file) {
      fileMime = file.type || '';
      if (file.size <= 4 * 1024 * 1024) {
        // eslint-disable-next-line no-await-in-loop
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
      solutions: sols,
      status: 'draft',
      createdAt: Date.now(),
      messages: [],
    };
    // Persist metadata only (keep large file bytes out of localStorage); render in
    // place so the in-memory document survives for the immediate run.
    const stored = { ...assessment };
    delete stored.fileData;
    saveAssessment(stored);
    current = assessment;
    previousResponseId = null;
    window.history.pushState({}, '', `/indextest?a=${encodeURIComponent(assessment.id)}`);
    renderAssessment(block, assessment);
  });
}

/* ── Assessment view (with chat) ─────────────────────── */

function addMessage(thread, role, html) {
  const msg = document.createElement('div');
  msg.className = `nash-session-msg ${role}`;
  msg.innerHTML = role === 'assistant'
    ? `<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble">${html}</div>`
    : `<div class="nash-session-bubble">${html}</div>`;
  thread.append(msg);
  thread.scrollTop = thread.scrollHeight;
  return msg.querySelector('.nash-session-bubble');
}

function typingIndicator(thread) {
  const msg = document.createElement('div');
  msg.className = 'nash-session-msg assistant';
  msg.innerHTML = '<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble"><span class="nash-session-typing"><i></i><i></i><i></i></span></div>';
  thread.append(msg);
  thread.scrollTop = thread.scrollHeight;
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

function buildQualPrompt({
  company, fileName, solutionNames, skills,
}) {
  const docLine = fileName
    ? `An RFI/RFP document is attached (${fileName}). Analyse it as the primary input.`
    : 'No document is attached — use the customer name and public data.';
  return `You are an Adobe cross-functional deal team (Business Consultant + Solution Consultant + System Architect + Sales Strategist + Market Analyst).

Goal: qualify the opportunity for "${company}" for ${solutionNames}, and produce a structured, insight-rich qualification dossier suitable for sales, solutioning, and executive briefings.

Guidance:
- Ground your scoring strictly in the Adobe solution knowledge provided below — use ITS scoring dimensions, key signals, red flags, competitive alternatives, and recommended products. Do not invent competitors or criteria that contradict it.
- Use reputable, recent public sources for the market/news section; include dates and links next to each claim.
- Be honest, objective and pragmatic — do NOT just say yes to please me.
- Quantify where possible; if the company is private and data is sparse, state uncertainties and use ranges.
- Tie market/news insights back into Win Sentiment and the Recommendation.

${docLine}

Begin your response with ONE machine-readable line in EXACTLY this format (the tool parses it and strips it from display):
NASH_META: score=<integer 0-100> | verdict=<Go|Conditional-Go|No-go> | cms=<detected current platform or n/a>
Then continue with the dossier.

Produce the report in markdown with exactly these sections:
# 1. Executive Overview
# 2. Market, Competitor & Financial Intelligence
# 3. Business Analysis
# 4. Technical & Architectural Evaluation
# 5. Qualification & Discovery Questions
# 6. Competitive Positioning & Win Sentiment
# 7. Final Recommendation and Adobe Solution Scope

Section 1 must include an initial Fit Score (High / Medium / Low) for ${solutionNames} with a one-sentence rationale and why this logo matters to Adobe. Section 6 must include a competitor comparison table using the competitive alternatives named in the solution knowledge. Section 7 must give a Go / No-Go / Conditional-Go with reasoning, the recommended Adobe solution scope, and a crawl-walk-run roadmap.

=== ADOBE SOLUTION KNOWLEDGE (ground your analysis in this) ===
${skills}`;
}

function setStatusDone(block) {
  const badge = block.querySelector('.nash-session-assess-status');
  if (badge) { badge.textContent = 'done'; badge.className = 'nash-session-assess-status done'; }
}

/* Pull the NASH_META header out of a dossier; returns { meta, body }. */
function parseMeta(text) {
  const m = text.match(/NASH_META:\s*score=(\d+)\s*\|\s*verdict=([^|]+?)\s*\|\s*cms=([^\n]*)/i);
  if (!m) return { meta: null, body: text };
  return {
    meta: { score: parseInt(m[1], 10), verdict: m[2].trim(), cms: m[3].trim() },
    body: text.replace(/NASH_META:[^\n]*\n?/i, '').trimStart(),
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

async function runAssessment(block) {
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

  area.innerHTML = `
    <div class="nash-session-running">
      <div class="nash-session-working">
        <span class="nash-session-working-dot" aria-hidden="true"></span>
        <span>Analysing ${escapeHtml(solutionNames)} fit for ${escapeHtml(current.company)}…</span>
      </div>
      <div class="nash-session-stream"></div>
    </div>`;
  const stream = area.querySelector('.nash-session-stream');

  const skills = await fetchSkillsText(sols.map((s) => s.slug));
  const prompt = buildQualPrompt({
    company: current.company, fileName: current.fileName, solutionNames, skills,
  });
  const userContent = current.fileData
    ? [
      { type: 'input_text', text: prompt },
      {
        type: 'input_file',
        filename: current.fileName,
        file_data: current.fileData,
        ...(current.fileMime ? { mime_type: current.fileMime } : {}),
      },
    ]
    : prompt;
  let answer = '';
  let thinking = '';
  const working = area.querySelector('.nash-session-working span:last-child');

  await streamQualification({
    messages: [{ role: 'user', content: userContent }],
    webSearch: true,
    onThinking: (d) => {
      thinking += d;
      if (!answer) stream.textContent = thinking; // live "thinking" until the answer starts
    },
    onDelta: (d) => {
      if (!answer && working) working.textContent = `Writing the ${solutionNames} qualification…`;
      answer += d;
      stream.textContent = answer; // switch to the real dossier as it streams
    },
    onDone: ({ responseId }) => {
      const src = answer || thinking;
      const { meta, body } = parseMeta(src);
      current.reportMarkdown = body;
      if (meta) {
        current.score = meta.score;
        current.verdict = meta.verdict;
        current.cms = meta.cms;
      }
      // Continue this exact FluffyJaws thread in the chat, so follow-up questions
      // are aware of the document and the dossier.
      if (responseId) {
        previousResponseId = responseId;
        current.previousResponseId = responseId;
      }
      current.status = 'done';
      area.innerHTML = renderDossier(current);
      persist(current);
      setStatusDone(block);
    },
    onError: (err) => {
      stream.innerHTML = `<p>Run failed: ${escapeHtml(err.message)}</p>`;
    },
  });
}

function renderAssessment(block, a) {
  current = a;
  previousResponseId = a.previousResponseId || null;
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
        <span class="nash-session-assess-status ${a.status}">${a.status}</span>
      </div>
      <div class="nash-session-assess-split">
        <div class="nash-session-assess-main">
          <div class="nash-session-report-area">${a.reportMarkdown
    ? renderDossier(a)
    : reportPanel(a.report, a.company)}</div>
        </div>
        <div class="nash-session-assess-chat">
          <div class="nash-session-thread" aria-live="polite"></div>
          <form class="nash-session-composer" autocomplete="off">
            <textarea class="nash-session-input" rows="1" placeholder="Ask about this assessment, or add context…" aria-label="Message Nash"></textarea>
            <div class="nash-session-toolbar">
              <button type="button" class="nash-session-icon-btn" aria-label="Attach a document">${ICONS.attach}</button>
              <button type="submit" class="nash-session-send" aria-label="Send" disabled>${ICONS.send}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const thread = block.querySelector('.nash-session-thread');
  const input = block.querySelector('.nash-session-input');
  const sendBtn = block.querySelector('.nash-session-send');

  if (a.messages.length === 0) {
    addMessage(thread, 'assistant', `I've created the assessment for <strong>${escapeHtml(a.company)}</strong>. Once the assessment runs I'll share the fit score, verdict, red flags, and recommendations here — and you can ask me anything about it.`);
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

  const typing = typingIndicator(thread);
  let bubble = null;
  let answer = '';
  let thinking = '';

  await streamQualification({
    messages: [{ role: 'user', content: value }],
    previousResponseId,
    webSearch: true,
    onThinking: (delta) => {
      thinking += delta;
      if (!bubble) {
        typing.remove();
        bubble = addMessage(thread, 'assistant', '');
      }
      if (!answer) { bubble.textContent = thinking; thread.scrollTop = thread.scrollHeight; }
    },
    onDelta: (delta) => {
      if (!bubble) { typing.remove(); bubble = addMessage(thread, 'assistant', ''); }
      answer += delta;
      bubble.textContent = answer;
      thread.scrollTop = thread.scrollHeight;
    },
    onDone: ({ responseId }) => {
      if (responseId) previousResponseId = responseId;
      if (!bubble) typing.remove();
      else bubble.innerHTML = renderMarkdown(answer || thinking);
      current.messages.push({ role: 'assistant', content: answer || thinking });
      current.previousResponseId = previousResponseId;
      persist(current);
    },
    onError: (err) => {
      typing.remove();
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
