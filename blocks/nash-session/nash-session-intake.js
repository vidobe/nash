/* eslint-disable no-use-before-define */
/*
 * Chat intake for a new assessment: the whole setup is one conversation with Fluffy in the
 * assessment column. Fluffy reads the documents (or the analyst's description), proposes the
 * customer and the Adobe scope, then asks only the few questions that would change the score
 * most. Running the assessment starts the real generation, whose progress appears in the chat.
 */
import { streamQualification } from '../../scripts/fluffyjaws.js';
import { isAuthenticated, login } from '../../scripts/nash-auth.js';
import { completedAnswer } from '../../scripts/nash-assessment-workflow.js';
import { intakeDocumentText, requirementManifestForFiles } from '../../scripts/nash-assessment-contract.js';
import { assessmentTitle } from '../../scripts/da-doc.js';
import { PILLARS, SOLUTION_PILLARS, SOLUTION_TILES } from '../nash-solutions/nash-solutions.js';
import {
  INTAKE_DIMENSIONS, INTAKE_VERSION, answerCounts, answeredLines, buildIntakePrompt,
  buildNotesPrompt, carryOverAnswers, evidencedDimensions, fallbackIntake, intakeChatContext,
  intakeDimension, normalizeIntake, normalizeNoteAnswers, parseIntakeAnswer, requirementSummary,
  tidyAnswer,
} from '../../scripts/nash-intake.js';

const MATERIAL_CHARS = 120000;
const QUESTION_CONTEXT_CHARS = 60000;
const NOTES_MIN = 200;
const DESCRIPTION_MIN = 40;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const PROGRESS_MESSAGES = [
  'Reading the fine print so you do not have to…',
  'Separating customer needs from procurement poetry…',
  'Checking which Adobe products have earned a seat at the table…',
  'Following the evidence, not the logo count…',
];
const ICON = {
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};
const PIX = `<span class="nash-session-pix" aria-hidden="true">${'<i></i>'.repeat(9)}</span>`;
const TYPING = '<span class="nash-session-typing"><i></i><i></i><i></i></span>';

const listText = (items) => (items.length < 2 ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
/* `**name**` emphasis from the model, applied after escaping. */
const emphasis = (escaped) => escaped.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
const shortName = (name) => String(name || '').replace(/^Adobe\s+/i, '').replace(/^Experience Manager\b/, 'AEM');
const hasContent = (file) => Boolean(file?.text?.trim() || file?.data);

/* Pasted meeting notes can run to pages; the recap shows the opening, cut at a word. */
function clipNote(text, limit = 240) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${space > limit * 0.6 ? cut.slice(0, space) : cut}…`;
}

function fileKind(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  return {
    xlsx: 'Excel workbook',
    xls: 'Excel workbook',
    csv: 'CSV',
    pdf: 'PDF',
    docx: 'Word document',
    doc: 'Word document',
    txt: 'Text',
  }[ext] || 'Document';
}

function fileNameFor(files) {
  if (!files.length) return '';
  return files.length === 1 ? files[0].name : `${files.length} files`;
}

/* "the two workbooks", "the document", "your description". */
function materialNoun(files) {
  if (!files.length) return 'your description';
  const noun = files.every((file) => /\.(?:xlsx?|csv)$/i.test(file.name)) ? 'workbook' : 'document';
  if (files.length === 1) return `the ${noun}`;
  return `the ${COUNT_WORDS[files.length] || files.length} ${noun}s`;
}

function attachmentsFor(files) {
  return files.filter((file) => file.data).map((file) => ({
    type: 'input_file',
    filename: file.name,
    file_data: file.data,
    ...(file.mime ? { mime_type: file.mime } : {}),
  }));
}

function contentWith(prompt, attachments) {
  return attachments.length ? [{ type: 'input_text', text: prompt }, ...attachments] : prompt;
}

/** The intake answers as a collapsed recap for the Fluffy panel next to the finished report. */
export function intakeRecapHtml(a, esc) {
  if (a?.interview?.version !== INTAKE_VERSION || !a.intake?.questions) return '';
  const answers = a.interview.answers || {};
  const { answered, unknown, open } = answerCounts(a.intake, answers);
  const noteList = (a.interview.notes || []).filter(Boolean);
  const notes = noteList.length;
  const summary = [
    'Your intake answers',
    `${answered} answered`,
    unknown + open ? `${unknown + open} unknown` : '',
    notes ? plural(notes, 'note') : '',
  ].filter(Boolean).join(' · ');
  const rows = a.intake.questions.map((question) => {
    const answer = answers[question.id];
    const value = answer && !answer.unknown && answer.text ? esc(answer.text) : '<em>Unknown</em>';
    return `<div><dt>${esc(question.label)}</dt><dd>${value}</dd></div>`;
  }).join('');
  const noteRow = notes
    ? `<div><dt>Your notes</dt>${noteList.map((note) => `<dd>${esc(clipNote(note))}</dd>`).join('')}</div>`
    : '';
  return `<details class="nash-intake-recap"><summary>${esc(summary)}</summary><dl>${rows}${noteRow}</dl></details>`;
}

/**
 * Mounts the chat intake into the assessment column of a rendered (report-less) assessment.
 * Everything the intake learns is saved on the assessment as it happens, so a reload resumes.
 */
export function mountIntake(block, {
  assessment: a, catalog, signal, processFiles, mergeFiles, assessmentFiles, persist,
  escapeHtml: esc, renderMarkdown, onRun,
}) {
  const panel = block.querySelector('.nash-session-panel[data-panel="assessment"]');
  const scroller = panel.querySelector('.nash-session-assess-scroll');
  const area = panel.querySelector('.nash-session-report-area');
  let solutions = [];
  let chat;
  let log;
  let dock;
  let input;
  let sendButton;
  let attachButton;
  let cardSeq = 0;
  let chain = Promise.resolve();
  const timers = new Set();
  const state = {
    phase: 'start', active: null, compose: null, busy: false, description: '',
  };

  if (a.interview?.version !== INTAKE_VERSION) {
    a.interview = {
      version: INTAKE_VERSION,
      scope: [],
      addOns: [],
      scopeConfirmed: false,
      answers: {},
      notes: [],
      at: Date.now(),
    };
  }
  const iv = a.interview;
  const life = new AbortController();
  if (signal?.aborted) life.abort();
  else signal?.addEventListener('abort', () => life.abort(), { once: true });
  const questions = () => a.intake?.questions || [];
  const files = () => assessmentFiles(a);
  const save = () => {
    iv.at = Date.now();
    persist(a);
  };
  const fullName = (slug) => solutions.find((s) => s.slug === slug)?.name || slug;
  const solutionName = (slug) => shortName(fullName(slug));
  const scopeNames = () => iv.scope.map((slug) => `${solutionName(slug)}${iv.addOns.includes(slug) ? ' (add-on)' : ''}`);
  const isOpen = (question) => !iv.answers[question.id];
  const openQuestions = () => questions().filter(isOpen);
  const aborted = () => life.signal.aborted;
  const loadCatalog = async () => {
    if (!solutions.length) {
      solutions = [...(await catalog || [])].sort((x, y) => x.name.localeCompare(y.name));
    }
    return solutions;
  };

  life.signal.addEventListener('abort', () => {
    timers.forEach((timer) => clearInterval(timer));
    timers.clear();
    dock?.remove();
    panel.querySelector(':scope > .nash-intake__drop')?.remove();
  }, { once: true });

  /* Every Fluffy turn runs through one queue, so a quick click or a typed message never
     lands in the middle of a reply. */
  function queue(task) {
    chain = chain.then(() => (aborted() ? null : task())).catch((error) => {
      if (aborted() || error?.name === 'AbortError') return;
      // eslint-disable-next-line no-console
      console.error(error);
      setBusy(false);
      post('assistant', `<p>${esc(`Something went wrong: ${error.message || error}`)}</p>`);
    });
    return chain;
  }

  /* ── Messages ─────────────────────────────────────────────────────── */

  function follow(msg) {
    if (!msg?.isConnected) return;
    const box = scroller.getBoundingClientRect();
    const rect = msg.getBoundingClientRect();
    const top = rect.top - box.top + scroller.scrollTop;
    const tall = rect.height > scroller.clientHeight - 48;
    scroller.scrollTo({ top: tall ? top - 12 : scroller.scrollHeight, behavior: 'smooth' });
  }

  function post(role, html) {
    const msg = document.createElement('div');
    const previous = log.lastElementChild;
    const continues = role === 'assistant' && previous?.classList.contains('assistant');
    msg.className = `nash-session-msg ${role}${continues ? ' assistant-cont' : ''}`;
    msg.innerHTML = role === 'assistant' && !continues
      ? `<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble">${html}</div>`
      : `<div class="nash-session-bubble">${html}</div>`;
    log.append(msg);
    follow(msg);
    return msg;
  }

  const postUser = (html) => post('user', html);

  function fluffy(html, { replies = null, key = null, offer = false } = {}) {
    const msg = post('assistant', html);
    if (replies?.length) {
      msg.querySelector('.nash-session-bubble').append(repliesGroup(replies, key, offer));
      follow(msg);
    }
    return msg;
  }

  const ackHtml = (text) => (text ? `<p class="nash-intake__ack">${ICON.check}<span>${esc(text)}</span></p>` : '');

  function notesHtml(text, label = 'Notes') {
    return `<div class="nash-intake__notes"><span>${ICON.doc} ${esc(label)}</span><p>${esc(text)}</p></div>`;
  }

  function sentFilesHtml(names) {
    return `<ul class="nash-intake__files is-sent" aria-label="Attached documents">${names.map((name) => `<li title="${esc(name)}">${ICON.doc}<span>${esc(name)}</span><small>${esc(fileKind(name))}</small></li>`).join('')}</ul>`;
  }

  /* A reply with a hint opens a free-text field under the pills instead of answering
     straight away: "Type my own answer", or a pill that needs details. */
  function repliesGroup(replies, key, offer = false) {
    const group = document.createElement('div');
    group.className = 'nash-intake__replies';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Quick replies');
    if (key) group.dataset.key = key;
    if (offer) group.dataset.offer = '';
    let form = null;
    let active = null;

    const close = () => {
      const button = active?.button;
      form?.remove();
      form = null;
      active = null;
      state.compose = null;
      group.querySelectorAll('.nash-intake__reply').forEach((b) => b.classList.remove('is-active'));
      button?.focus();
    };

    const buildForm = () => {
      const el = document.createElement('form');
      el.className = 'nash-intake__own';
      el.innerHTML = `<textarea rows="1" aria-label="Your answer"></textarea>
        <button type="button" class="nash-intake__own-cancel" aria-label="Cancel" title="Cancel (Esc)">${ICON.close}</button>
        <button type="submit" class="nash-session-send nash-intake__own-send" aria-label="Save answer" title="Save answer" disabled>${ICON.send}</button>`;
      const field = el.querySelector('textarea');
      const send = el.querySelector('.nash-intake__own-send');
      el.resize = () => {
        field.style.height = 'auto';
        field.style.height = `${Math.min(field.scrollHeight, 132)}px`;
        send.disabled = !field.value.trim();
      };
      field.addEventListener('input', el.resize);
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          el.requestSubmit();
        }
      });
      el.querySelector('.nash-intake__own-cancel').addEventListener('click', close);
      el.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = field.value.trim();
        if (!text || !active) return;
        const { button, reply } = active;
        group.querySelectorAll('button, textarea').forEach((b) => { b.disabled = true; });
        button.classList.replace('is-active', 'is-chosen');
        el.remove();
        form = null;
        active = null;
        state.compose = null;
        reply.onSubmit(text);
      });
      return el;
    };

    const open = (button, reply) => {
      active = { button, reply };
      group.querySelectorAll('.nash-intake__reply').forEach((b) => b.classList.toggle('is-active', b === button));
      if (!form) {
        form = buildForm();
        group.append(form);
      }
      const field = form.querySelector('textarea');
      field.placeholder = reply.hint;
      if (reply.value && !field.value) field.value = reply.value;
      form.resize();
      state.compose = reply.compose ? { build: reply.compose } : null;
      // Instant, not smooth: typing straight away would cancel a smooth scroll halfway.
      field.focus({ preventScroll: true });
      form.scrollIntoView({ block: 'nearest' });
    };

    replies.forEach((reply) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `nash-intake__reply${reply.primary ? ' is-primary' : ''}${reply.own ? ' is-own' : ''}`;
      if (reply.own) button.innerHTML = `${ICON.pencil}<span>${esc(reply.text)}</span>`;
      else button.textContent = reply.text;
      if (reply.hint) button.setAttribute('aria-haspopup', 'true');
      button.addEventListener('click', () => {
        if (reply.hint) {
          open(button, reply);
          return;
        }
        form?.remove();
        group.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        button.classList.add('is-chosen');
        reply.onPick();
      });
      group.append(button);
    });
    return group;
  }

  function retireGroups(scope) {
    log.querySelectorAll(`${scope} .nash-intake__own`).forEach((form) => form.remove());
    log.querySelectorAll(`${scope} .nash-intake__reply.is-active`).forEach((b) => b.classList.remove('is-active'));
    log.querySelectorAll(`${scope} button:not(:disabled)`).forEach((b) => { b.disabled = true; });
  }

  /* Answer pills retire as the conversation moves on. Offers such as "Try again" stay usable
     while the analyst carries on, until they are taken up or a new reading starts. */
  function retireReplies(key) {
    retireGroups(key ? `.nash-intake__replies[data-key="${key}"]` : '.nash-intake__replies:not([data-offer])');
  }

  function retireOffers() {
    retireGroups('.nash-intake__replies[data-offer]');
  }

  function retireCards(selector) {
    log.querySelectorAll(`${selector}:not(.is-stale)`).forEach((card) => {
      card.classList.add('is-stale');
      card.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
    });
  }

  /* ── Phase, composer and head ─────────────────────────────────────── */

  function setPlaceholder() {
    const hints = {
      start: 'Drop documents here, or describe the opportunity…',
      nodocs: 'Describe the opportunity, or add documents with +',
      reading: 'Fluffy is reading…',
      scope: 'Ask Fluffy, or add context…',
      questions: 'Answer Fluffy, or paste meeting notes…',
      review: 'Add context, or ask Fluffy…',
      running: 'Fluffy is building the assessment…',
    };
    input.placeholder = hints[state.phase] || hints.scope;
  }

  function syncComposer() {
    const locked = state.busy || ['reading', 'running'].includes(state.phase);
    input.disabled = state.phase === 'running';
    sendButton.disabled = locked || !input.value.trim();
    attachButton.disabled = locked;
    chat?.setAttribute('aria-busy', String(state.busy));
  }

  function setBusy(busy) {
    state.busy = busy;
    syncComposer();
  }

  function setPhase(phase) {
    state.phase = phase;
    setPlaceholder();
    syncComposer();
    renderStatus();
  }

  function syncHead() {
    const head = block.querySelector('.nash-session-assess-head > div');
    if (!head) return;
    const title = head.querySelector('.nash-session-assess-title');
    title.textContent = a.company || a.opportunity || 'New analysis';
    let names = head.querySelector('.nash-session-assess-solutions');
    if (!names) {
      names = document.createElement('p');
      names.className = 'nash-session-assess-solutions';
      title.after(names);
    }
    names.hidden = !iv.scopeConfirmed || !iv.scope.length;
    names.textContent = iv.scope.map(fullName).join(', ');
    let meta = head.querySelector('.nash-session-assess-meta');
    if (!meta) {
      meta = document.createElement('p');
      meta.className = 'nash-session-assess-meta';
      names.after(meta);
    }
    const date = new Date(a.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    meta.textContent = [a.dr ? `DR ${a.dr}` : '', a.fileName || 'New assessment', date]
      .filter(Boolean).join(' · ');
  }

  /* ── Cards inside Fluffy's messages ───────────────────────────────── */

  function briefFactsHtml() {
    const facts = [...(a.intake?.facts || [])];
    if (a.intake?.requirements?.text) {
      facts.splice(Math.min(1, facts.length), 0, { label: 'Requirements', value: a.intake.requirements.text });
    }
    if (!facts.length) return '';
    return `<dl class="nash-intake__facts">${facts.map((fact) => `<div><dt>${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd></div>`).join('')}</dl>`;
  }

  function briefFilesHtml(editing) {
    const list = files();
    if (!list.length) return '';
    return `<ul class="nash-intake__files" aria-label="Documents">${list.map((file) => {
      const missing = !hasContent(file);
      const remove = editing ? `<button type="button" class="nash-intake__file-remove" data-act="file-remove" data-name="${esc(file.name)}" aria-label="Remove ${esc(file.name)}" title="Remove">${ICON.close}</button>` : '';
      return `<li class="${missing ? 'is-missing' : ''}" title="${esc(missing ? `${file.name}: add it again, Nash no longer has its contents` : file.name)}">${missing ? ICON.warn : ICON.doc}<span>${esc(file.name)}</span>${remove}</li>`;
    }).join('')}</ul>`;
  }

  function briefCardHtml(editing = false, values = a) {
    cardSeq += 1;
    const details = [a.website, a.dr ? `DR ${a.dr}` : 'No DR found'].filter(Boolean).join(' · ');
    const head = editing
      ? `<div class="nash-session-identity-row nash-intake__identity">
          <label>Customer<input name="company" value="${esc(values.company || a.opportunity || '')}" autocomplete="off"/></label>
          <label>Website<input name="website" value="${esc(values.website || '')}" autocomplete="off"/></label>
          <label>DR <span>optional</span><input name="dr" value="${esc(values.dr || '')}" placeholder="Not found" autocomplete="off"/></label>
        </div>
        <div class="nash-intake__edit-actions">
          <button type="button" class="nash-session-btn-ghost" data-act="brief-cancel">Cancel</button>
          <button type="button" class="nash-session-btn-primary" data-act="brief-save">Save</button>
        </div>`
      : `<div class="nash-intake__card-head">
          <div><strong>${esc(a.company || a.opportunity || 'Customer not named yet')}</strong><span>${esc(details)}</span></div>
          <button type="button" class="nash-intake__link" data-act="brief-edit">Edit</button>
        </div>`;
    return `<div class="nash-intake__card nash-intake__brief${editing ? ' is-editing' : ''}" data-card="${cardSeq}">
        ${head}
        ${briefFilesHtml(editing)}
        ${briefFactsHtml()}
      </div>`;
  }

  function refreshBriefCards() {
    log.querySelectorAll('.nash-intake__brief:not(.is-editing):not(.is-stale)').forEach((card) => {
      card.outerHTML = briefCardHtml(false);
    });
  }

  function recommendation(slug) {
    return (a.intake?.recommendedSolutions || []).find((item) => item.slug === slug);
  }

  function tileHtml(solution, selected, interactive = true) {
    const initials = shortName(solution.name).split(/\W+/).map((w) => w[0]).join('');
    const [symbol, number] = SOLUTION_TILES[solution.slug] || [initials.slice(0, 2), 0];
    const reason = recommendation(solution.slug)?.reason;
    const body = `<span class="nash-session-solution-num">${String(number).padStart(3, '0')}</span>
        <strong>${esc(symbol)}</strong>
        <span>${esc(solution.name.replace(/^Adobe\s+/i, ''))}</span>
        ${reason ? `<small>${esc(reason)}</small>` : ''}`;
    if (!interactive) return `<span class="nash-session-solution-tile is-picked">${body}</span>`;
    return `<label class="nash-session-solution-tile${recommendation(solution.slug) ? ' is-recommended' : ''}">
        <input type="checkbox" value="${esc(solution.slug)}"${selected.has(solution.slug) ? ' checked' : ''}/>
        ${body}
      </label>`;
  }

  function pillarVars(pillar) {
    return `--solution-accent-light:${pillar?.accent || '#6b7280'};--solution-accent-dark:${pillar?.darkAccent || '#9a9da6'}`;
  }

  function groupsHtml(selected) {
    const grouped = PILLARS.map((pillar) => ({
      pillar,
      items: solutions.filter((s) => SOLUTION_PILLARS[s.slug] === pillar.id),
    }));
    const other = solutions.filter((s) => !SOLUTION_PILLARS[s.slug]);
    if (other.length) grouped.push({ pillar: null, items: other });
    return grouped.filter((g) => g.items.length).map(({ pillar, items }) => {
      const open = items.some((s) => selected.has(s.slug));
      const picked = items.filter((s) => selected.has(s.slug)).length;
      const id = `nash-intake-${cardSeq}-${pillar?.id || 'other'}`;
      return `<section class="nash-session-solution-group nash-intake__group${open ? ' is-open' : ''}" style="${pillarVars(pillar)}">
          <div class="nash-session-solution-group-head">
            <h3>${esc(pillar?.name || 'Other solutions')}</h3>
            <button type="button" class="nash-intake__group-toggle" data-act="group-toggle" aria-expanded="${open}" aria-controls="${id}">
              <span>${groupCount(items.length, picked)}</span>${ICON.chevron}
            </button>
          </div>
          <div class="nash-session-periodic" id="${id}"${open ? '' : ' hidden'}>${items.map((s) => tileHtml(s, selected)).join('')}</div>
        </section>`;
    }).join('');
  }

  const groupCount = (total, picked) => `${plural(total, 'solution')}${picked ? ` · ${picked} selected` : ''}`;
  const scopeLabel = (count) => (count ? `Confirm ${plural(count, 'solution')}` : 'Pick at least one');

  function scopeCardHtml() {
    cardSeq += 1;
    const selected = new Set(iv.scope);
    const matches = (a.intake?.recommendedSolutions || [])
      .filter((item) => solutions.some((s) => s.slug === item.slug));
    return `<div class="nash-intake__card nash-intake__scope" data-card="${cardSeq}">
        ${matches.length ? `<ul class="nash-intake__matches">
          ${matches.map((item) => `<li><i aria-hidden="true"></i><span><strong>${esc(solutionName(item.slug))}</strong>${item.reason ? `: ${esc(item.reason)}` : ''}</span></li>`).join('')}
        </ul>` : ''}
        <div class="nash-session-solution-groups">${groupsHtml(selected)}</div>
        <div class="nash-intake__card-foot nash-intake__scope-foot">
          <span class="nash-intake__count" aria-live="polite">${esc(selected.size ? listText(iv.scope.map(solutionName)) : 'Nothing selected')}</span>
          <button type="button" class="nash-session-btn-primary" data-act="scope-confirm"${selected.size ? '' : ' disabled'}>${scopeLabel(selected.size)}</button>
        </div>
      </div>`;
  }

  function lockedScopeHtml() {
    const picked = iv.scope.map((slug) => solutions.find((s) => s.slug === slug)).filter(Boolean);
    return `<div class="nash-intake__picked">
        ${picked.map((s) => `<span class="nash-session-solution-group" style="${pillarVars(PILLARS.find((p) => p.id === SOLUTION_PILLARS[s.slug]))}">${tileHtml(s, null, false)}</span>`).join('')}
      </div>
      <div class="nash-intake__card-foot">
        <span class="nash-intake__count">${ICON.check} Scope confirmed</span>
        <button type="button" class="nash-intake__link" data-act="scope-change">Change</button>
      </div>`;
  }

  function answerHtml(answer) {
    if (!answer) return '<em>Not answered · counts as unknown</em>';
    if (answer.unknown) return '<em>Unknown</em>';
    return esc(answer.text);
  }

  function documentsSummary() {
    const list = files();
    if (!list.length) return 'None · your description';
    const missing = list.filter((file) => !hasContent(file)).length;
    const requirements = a.intake?.requirements?.total;
    return [
      plural(list.length, materialNoun(list).split(' ').pop().replace(/s$/, '')),
      requirements ? plural(requirements, 'requirement') : '',
      missing ? `${missing} to add again` : '',
    ].filter(Boolean).join(' · ');
  }

  function meterHtml(evidenced, { labelled = false } = {}) {
    const marks = INTAKE_DIMENSIONS.map((d) => {
      const on = evidenced.has(d.key);
      return `<i class="${on ? 'is-on' : ''}" title="${esc(d.name)}: ${on ? 'customer evidence' : 'default 3 of 5'}"></i>`;
    }).join('');
    if (!labelled) return `<span class="nash-intake__meter" aria-hidden="true">${marks}</span>`;
    return `<span class="nash-intake__meter" role="img" aria-label="${evidenced.size} of ${INTAKE_DIMENSIONS.length} scored dimensions have customer evidence">
        ${marks}<span>${evidenced.size} of ${INTAKE_DIMENSIONS.length} with evidence</span>
      </span>`;
  }

  function reviewCardHtml() {
    cardSeq += 1;
    const { answered, unknown, open } = answerCounts(a.intake, iv.answers);
    const evidenced = evidencedDimensions(a.intake, iv.answers);
    const questionRows = questions().map((question) => {
      const answer = iv.answers[question.id];
      const dimension = intakeDimension(question.dimension);
      return `<div>
          <dt>${esc(question.label)}<small>${esc(dimension.name)} · ${dimension.weight}%</small></dt>
          <dd>${answerHtml(answer)}</dd>
          <button type="button" class="nash-intake__link" data-act="q-change" data-key="${esc(question.id)}">${answer ? 'Change' : 'Answer'}</button>
        </div>`;
    }).join('');
    const summary = [`${answered} answered`, unknown ? `${unknown} unknown` : '', open ? `${open} open` : '']
      .filter(Boolean).join(' · ');
    const notes = iv.notes.filter(Boolean).length;
    const conflict = countRequirements().error;
    let foot = `<span class="nash-intake__count">Connect to FluffyJaws to run it.</span>
        <button type="button" class="nash-session-btn-primary" data-act="connect">Connect to FluffyJaws</button>`;
    if (isAuthenticated()) {
      foot = `<span class="nash-intake__count">${conflict ? 'The documents disagree. Fix them before you run it.' : 'Keep this page open while it runs.'}</span>
        <button type="button" class="nash-session-btn-primary" data-act="run">Run assessment</button>`;
    }
    return `<div class="nash-intake__card nash-intake__review" data-card="${cardSeq}">
        <div class="nash-intake__card-head">
          <div><strong>Ready to run</strong><span>${esc(summary)}</span></div>
          ${meterHtml(evidenced, { labelled: true })}
        </div>
        <dl class="nash-intake__rows">
          <div>
            <dt>Customer</dt>
            <dd>${esc([a.company || a.opportunity, a.website, a.dr ? `DR ${a.dr}` : ''].filter(Boolean).join(' · '))}</dd>
            <button type="button" class="nash-intake__link" data-act="brief-change">Change</button>
          </div>
          <div>
            <dt>Adobe scope</dt>
            <dd>${esc(listText(scopeNames()))}</dd>
            <button type="button" class="nash-intake__link" data-act="scope-change">Change</button>
          </div>
          <div>
            <dt>Documents</dt>
            <dd>${esc(documentsSummary())}${conflict ? `<span class="nash-intake__dd-warn">${esc(conflict)}</span>` : ''}</dd>
            ${files().length ? '<button type="button" class="nash-intake__link" data-act="brief-change">Change</button>' : ''}
          </div>
          ${questionRows}
          ${notes ? `<div><dt>Your notes</dt><dd>${plural(notes, 'note')}, passed to the assessment as written</dd></div>` : ''}
        </dl>
        <div class="nash-intake__card-foot">${foot}</div>
      </div>`;
  }

  /* ── Status strip above the composer ──────────────────────────────── */

  function renderStatus() {
    const status = dock?.querySelector('.nash-intake__status');
    if (!status) return;
    if (!['questions', 'review'].includes(state.phase) || !questions().length) {
      status.hidden = true;
      return;
    }
    const { answered, unknown, total } = answerCounts(a.intake, iv.answers);
    const evidenced = evidencedDimensions(a.intake, iv.answers);
    status.hidden = false;
    status.innerHTML = `${meterHtml(evidenced)}
      <span class="nash-intake__status-text"><strong>${answered} of ${total} answered</strong>${unknown ? ` · ${unknown} unknown` : ''}<span class="nash-intake__status-evidence"> · ${evidenced.size} of ${INTAKE_DIMENSIONS.length} dimensions with customer evidence</span></span>
      ${state.phase === 'questions'
    ? '<button type="button" class="nash-intake__status-btn" data-act="to-review">Review and run</button>'
    : '<button type="button" class="nash-intake__status-btn is-primary" data-act="run">Run assessment</button>'}`;
  }

  /* ── Questions ────────────────────────────────────────────────────── */

  function nextOpen(afterId = null) {
    const list = questions();
    const start = afterId ? list.findIndex((q) => q.id === afterId) + 1 : 0;
    return [...list.slice(start), ...list.slice(0, start)].find(isOpen);
  }

  function ask(question, { ack = '', again = false } = {}) {
    const list = questions();
    const dimension = intakeDimension(question.dimension);
    const current = iv.answers[question.id];
    // Only the question being asked keeps live replies; notes or documents may have
    // answered the others since they were posted.
    retireReplies();
    state.active = question.id;
    state.compose = null;
    setPhase('questions');
    const currentLine = current
      ? `<p class="nash-intake__current">Current answer: ${esc(current.unknown ? 'Unknown' : current.text)}</p>` : '';
    const custom = current && !current.unknown
      && !question.options.some((option) => option.answer === current.text) ? current.text : '';
    const replies = question.options.map((option) => (option.detail
      ? {
        text: option.label,
        hint: option.detail,
        compose: (text) => `${option.answer}: ${text}`,
        onSubmit: (text) => answerInOwnWords(question, text, option),
      }
      : { text: option.label, onPick: () => pick(question, option) }));
    replies.push({ text: 'Don’t know', onPick: () => pick(question, null) });
    replies.push({
      text: 'Type my own answer',
      own: true,
      hint: question.hint || 'Type your answer',
      value: custom,
      onSubmit: (text) => answerInOwnWords(question, text),
    });
    fluffy(`${ackHtml(ack)}${again ? '<p class="nash-intake__current">Back to the open question:</p>' : ''}
        <span class="nash-intake__qtag">Question ${list.indexOf(question) + 1} of ${list.length} · ${esc(dimension.name)} · ${dimension.weight}%</span>
        <p>${emphasis(esc(question.ask))}</p>${currentLine}`, { replies, key: question.id });
  }

  function review(ack = '', finished = false) {
    state.active = null;
    state.compose = null;
    retireReplies();
    retireCards('.nash-intake__review');
    setPhase('review');
    const open = openQuestions().length;
    let intro = 'Here is what goes into the assessment. Change anything, or run it.';
    if (finished) intro = 'That is everything I wanted to ask. Here is what goes into the assessment.';
    else if (open) intro = `Here is what goes into the assessment so far. The ${open === 1 ? 'open question counts' : `${open} open questions count`} as unknown, not as a weakness.`;
    fluffy(`${ackHtml(ack)}<p>${intro}</p>${reviewCardHtml()}`);
  }

  function addToScope(slug) {
    if (!slug || iv.scope.includes(slug)) return '';
    iv.scope.push(slug);
    iv.addOns.push(slug);
    if (iv.scopeConfirmed) confirmSolutions();
    syncHead();
    return `Added ${solutionName(slug)} to the scope as an add-on.`;
  }

  function record(question, value, option = null) {
    iv.answers[question.id] = value;
    const added = addToScope(option?.addSolution);
    const ack = added || (value.unknown ? 'Marked as unknown. The assessment will say so rather than guess.' : '');
    save();
    retireReplies(question.id);
    state.active = null;
    renderStatus();
    if (state.phase === 'review') {
      review(ack);
      return;
    }
    const next = nextOpen(question.id);
    if (next) ask(next, { ack });
    else review(ack, true);
  }

  function pick(question, option) {
    queue(() => {
      postUser(esc(option ? option.label : 'Don’t know'));
      record(question, option ? { text: option.answer } : { unknown: true }, option);
    });
  }

  function answerInOwnWords(question, text, option = null) {
    const sentence = tidyAnswer(text);
    state.compose = null;
    queue(() => {
      postUser(esc(option ? `${option.label}: ${sentence}` : sentence));
      record(question, { text: option ? `${option.answer}: ${sentence}` : sentence }, option);
    });
  }

  function evidenceIntroHtml() {
    const { total, open } = answerCounts(a.intake, iv.answers);
    const evidenced = evidencedDimensions(a.intake, iv.answers);
    const have = INTAKE_DIMENSIONS.filter((d) => evidenced.has(d.key)).map((d) => d.name);
    const missing = INTAKE_DIMENSIONS.filter((d) => !evidenced.has(d.key)).map((d) => d.name);
    const given = new Set(questions().map((q) => iv.answers[q.id])
      .filter((answer) => answer?.text && !answer.unknown).map((answer) => answer.source || 'analyst'));
    let source = materialNoun(files());
    if (given.has('analyst')) source += ' and your answers';
    else if (given.has('notes')) source += ' and your notes';
    let first;
    if (!missing.length) first = `From ${source}, I have customer evidence for all six scored dimensions.`;
    else if (!have.length) first = `Nothing in ${source} is specific enough to rate the scored dimensions yet, so each would be rated 3 of 5 by default.`;
    else {
      first = `From ${source}, I have customer evidence for ${esc(listText(have))}. <strong>${esc(listText(missing))}</strong> ${missing.length === 1 ? 'has nothing from the customer yet, so it would' : 'have nothing from the customer yet, so they would'} be rated 3 of 5 by default.`;
    }
    const responded = total - open;
    let second = `${plural(total, 'quick question')} would change the score most${responded ? `; ${responded} already ${responded === 1 ? 'has' : 'have'} your answer` : ''}. Skip anything you don’t know, or paste meeting notes and I’ll use them.`;
    if (!open) second = `You have already been through the ${plural(total, 'question')} that would change the score most.`;
    return `<p>${first}</p><p>${second}</p>`;
  }

  function startQuestions(ack = '') {
    const next = nextOpen();
    if (!questions().length) {
      review(ack || 'I have no questions: the material covers what I would ask.', true);
      return;
    }
    setPhase('questions');
    fluffy(`${ackHtml(ack)}${evidenceIntroHtml()}`);
    if (next) ask(next);
    else review('', true);
  }

  function confirmSolutions() {
    a.solutions = iv.scope.map((slug) => ({ slug, name: fullName(slug) }));
    a.assessmentName = assessmentTitle({ ...a, assessmentName: '' });
  }

  function confirmScope(card) {
    const checked = [...card.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
    if (!checked.length) return;
    const first = !iv.scopeConfirmed;
    iv.scope = [
      ...iv.scope.filter((slug) => checked.includes(slug)),
      ...checked.filter((slug) => !iv.scope.includes(slug)),
    ];
    iv.addOns = iv.addOns.filter((slug) => iv.scope.includes(slug));
    iv.scopeConfirmed = true;
    confirmSolutions();
    save();
    card.classList.add('is-locked');
    card.innerHTML = lockedScopeHtml();
    retireCards(`.nash-intake__scope:not([data-card="${card.dataset.card}"])`);
    syncHead();
    queue(() => {
      postUser(esc(`Assess ${listText(scopeNames())}`));
      if (first) {
        startQuestions();
        return;
      }
      if (state.phase === 'review') {
        review('Scope updated.');
        return;
      }
      const active = questions().find((q) => q.id === state.active) || nextOpen();
      if (active) ask(active, { ack: 'Scope updated.' });
      else review('Scope updated.', true);
    });
  }

  function postScopeCard(intro) {
    retireCards('.nash-intake__scope:not(.is-locked)');
    fluffy(`<p>${intro}</p>${scopeCardHtml()}`);
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  /* Copilot-style live steps that collapse into one line when the work is done. */
  function workMessage(title, steps) {
    const msg = post('assistant', `<div class="nash-intake__work">
        <p class="nash-intake__work-title">${PIX}<span>${esc(title)}</span></p>
        <ol class="nash-intake__steps">${steps.map((step) => `<li data-step="${step.key}"><i aria-hidden="true"></i><span>${esc(step.label)}</span><small></small></li>`).join('')}</ol>
        <p class="nash-intake__work-note" aria-live="polite"></p>
      </div>`);
    const rows = new Map(steps.map((step) => [step.key, { ...step, result: '', failed: false }]));
    const item = (key) => msg.querySelector(`.nash-intake__steps li[data-step="${key}"]`);
    let timer = 0;
    const api = {
      start(key) {
        item(key)?.classList.add('is-current');
      },
      finish(key, result, failed = false) {
        const li = item(key);
        Object.assign(rows.get(key), { result, failed });
        if (!li) return;
        li.classList.remove('is-current');
        li.classList.add(failed ? 'is-failed' : 'is-done');
        li.querySelector('i').innerHTML = failed ? ICON.warn : ICON.check;
        li.querySelector('small').textContent = result;
      },
      rotate() {
        const note = msg.querySelector('.nash-intake__work-note');
        let index = 0;
        [note.textContent] = PROGRESS_MESSAGES;
        timer = setInterval(() => {
          index += 1;
          note.textContent = PROGRESS_MESSAGES[index % PROGRESS_MESSAGES.length];
        }, 2600);
        timers.add(timer);
      },
      stop() {
        clearInterval(timer);
        timers.delete(timer);
        msg.querySelector('.nash-intake__work-note')?.remove();
      },
      collapse(summary) {
        api.stop();
        const failed = [...rows.values()].some((row) => row.failed);
        msg.querySelector('.nash-session-bubble').innerHTML = `<details class="nash-intake__worked${failed ? ' is-failed' : ''}">
            <summary>${failed ? ICON.warn : ICON.check}<span>${esc(summary)}</span>${ICON.chevron}</summary>
            <ol>${[...rows.values()].map((row) => `<li><strong>${esc(row.label)}</strong><span>${esc(row.result)}</span></li>`).join('')}</ol>
          </details>`;
      },
    };
    return api;
  }

  function countRequirements() {
    try {
      const rows = requirementManifestForFiles(files());
      return { requirements: rows.length ? requirementSummary(rows) : null, error: '' };
    } catch (error) {
      return { requirements: null, error: error.message };
    }
  }

  function readResult(list, requirements, error) {
    const unreadable = list.filter((file) => !hasContent(file)).map((file) => file.name);
    if (error) return { text: 'The requirement tables disagree', failed: true };
    if (unreadable.length === list.length) return { text: 'No text could be extracted', failed: true };
    const parts = [requirements ? `${requirements.total} requirements found` : 'No requirement table found; reading the text'];
    if (unreadable.length) parts.push(`could not read ${listText(unreadable)}`);
    return { text: parts.join(' · '), failed: unreadable.length > 0 };
  }

  async function addExtracted(list) {
    const extracted = await processFiles(list);
    a.files = mergeFiles(files(), extracted);
    a.fileName = fileNameFor(a.files);
    a.status = 'draft';
    return extracted;
  }

  /* One FluffyJaws pass over everything: brief, scope, evidence and the questions. */
  async function analyse(work, { retry = false } = {}) {
    await loadCatalog();
    const list = files();
    const hasDocuments = list.length > 0;
    const { requirements, error: manifestError } = countRequirements();
    if (hasDocuments && !retry) {
      const result = readResult(list, requirements, manifestError);
      work.finish('read', result.text, result.failed);
    }
    work.start('match');
    work.rotate();
    const docText = hasDocuments ? intakeDocumentText(list, MATERIAL_CHARS) : '';
    const notes = iv.notes.filter((note) => note && note !== state.description);
    const material = [
      docText,
      state.description ? `--- The analyst’s description ---\n${state.description}` : '',
      notes.length ? `--- The analyst’s notes ---\n${notes.join('\n\n')}` : '',
    ].filter(Boolean).join('\n\n');
    const previous = questions();
    const answeredBefore = answeredLines(previous, iv.answers);
    const attachments = attachmentsFor(list);
    let parsed = null;
    let failure = '';
    if (!isAuthenticated()) failure = 'not-connected';
    else if (!material.trim() && !attachments.length) failure = 'unreadable';
    else {
      setBusy(true);
      try {
        const prompt = buildIntakePrompt({
          material,
          catalog: solutions,
          requirements,
          hasDocuments,
          opportunity: a.opportunity,
          known: answeredBefore,
        });
        const { answer } = await completedAnswer(streamQualification, {
          messages: [{ role: 'user', content: contentWith(prompt, attachments) }],
          webSearch: false,
          reasoningEffort: 'low',
          signal: life.signal,
        });
        parsed = normalizeIntake(parseIntakeAnswer(answer), {
          catalog: solutions, opportunity: a.opportunity, requirements, hasDocuments,
        });
      } catch (error) {
        if (aborted()) throw error;
        failure = error.message || 'FluffyJaws did not finish.';
      } finally {
        setBusy(false);
      }
    }
    if (aborted()) return;
    const intake = parsed || fallbackIntake({
      opportunity: a.opportunity, requirements, hasDocuments,
    });
    // Reading again: what the analyst already answered stays, under the same question ids.
    if (answeredBefore.length) {
      const carried = carryOverAnswers(previous, intake.questions, iv.answers);
      intake.questions = carried.questions;
      iv.answers = carried.answers;
    }
    const stillOpen = intake.questions.filter((question) => !iv.answers[question.id]).length;
    const guessedName = Boolean(a.intake?.failure) && !iv.briefEdited;
    a.intake = { ...intake, at: Date.now(), ...(failure ? { failure } : {}) };
    // A failed reading only had the opportunity name; a good one may correct it.
    if (parsed && guessedName && intake.company) a.company = intake.company;
    a.company = a.company || intake.company || a.opportunity || '';
    a.website = a.website || intake.website;
    a.dr = a.dr || intake.dr;
    if (!iv.scopeConfirmed) {
      const known = (a.solutions || []).map((s) => (typeof s === 'string' ? s : s.slug))
        .filter((slug) => solutions.some((s) => s.slug === slug));
      iv.scope = known.length ? known : intake.recommendedSolutions.map((item) => item.slug);
      iv.addOns = [];
    }
    save();
    syncHead();

    const names = intake.recommendedSolutions.map((item) => solutionName(item.slug));
    if (parsed) {
      work.finish('match', names.length ? `${listText(names)} ${names.length === 1 ? 'matches' : 'match'}` : 'No clear match yet');
      work.finish('gaps', stillOpen ? `${plural(stillOpen, 'question')} would change the score` : 'Nothing to ask');
    } else {
      work.finish('match', failure === 'not-connected' ? 'Not connected to FluffyJaws' : 'FluffyJaws could not finish', true);
      work.finish('gaps', 'Using the standard questions', true);
    }
    const source = materialNoun(list);
    const summary = [
      hasDocuments ? `Read ${plural(list.length, materialNoun(list).split(' ').pop().replace(/s$/, ''))}` : 'Read your description',
      requirements ? plural(requirements.total, 'requirement') : '',
      parsed ? plural(stillOpen, 'open question') : 'FluffyJaws could not analyse it',
    ].filter(Boolean).join(' · ');
    work.collapse(summary);

    if (manifestError) {
      fluffy(`<p class="nash-intake__warn">${ICON.warn}<span>${esc(manifestError)}</span></p>
          <p>The assessment cannot run until this is fixed. Use <strong>Edit</strong> on the documents card to remove the file that disagrees, or add a corrected copy with the same name.</p>`);
    }
    if (failure === 'not-connected') {
      fluffy(`<p>I’m not connected to FluffyJaws, so I couldn’t analyse ${esc(source)}. I’ve loaded my standard questions; pick the Adobe solutions yourself, and connect before you run the assessment.</p>`, {
        replies: [{ text: 'Connect to FluffyJaws', primary: true, onPick: () => login() }],
        key: 'connect',
        offer: true,
      });
    } else if (failure === 'unreadable') {
      fluffy(`<p>I couldn’t extract any text from ${esc(source)}. Pick the Adobe solutions yourself and I’ll ask my standard questions, or add a readable copy with <strong>+</strong>.</p>`);
    } else if (failure) {
      fluffy(`<p>FluffyJaws couldn’t analyse ${esc(source)} this time, so I’ve loaded my standard questions instead.</p><p class="nash-intake__error">${esc(failure)}</p>`, {
        replies: [{ text: 'Try again', onPick: () => queue(() => reanalyse()) }],
        key: 'retry',
        offer: true,
      });
    }
    fluffy(`<p>Here is what I took from ${esc(source)}. If anything is off, edit it or just tell me.</p>${briefCardHtml()}`);
    setPhase('scope');
    if (iv.scopeConfirmed) {
      fluffy(`<p>The Adobe scope stays as you confirmed it.</p><div class="nash-intake__card nash-intake__scope is-locked">${lockedScopeHtml()}</div>`);
      startQuestions();
      return;
    }
    let intro = 'Pick the Adobe solutions to assess, then confirm.';
    if ((a.solutions || []).length && iv.scope.length) intro = 'These are the Adobe solutions you picked before. Add or remove any, then confirm.';
    else if (iv.scope.length) intro = `${iv.scope.length === 1 ? 'This Adobe solution matches' : 'These Adobe solutions match'} what the customer needs. Add or remove any, then confirm.`;
    postScopeCard(intro);
  }

  async function reanalyse() {
    retireReplies();
    retireOffers();
    retireCards('.nash-intake__review');
    retireCards('.nash-intake__brief');
    retireCards('.nash-intake__scope:not(.is-locked)');
    setPhase('reading');
    const work = workMessage('Reading again', [
      { key: 'match', label: 'Matching Adobe solutions' },
      { key: 'gaps', label: 'Finding what is still open' },
    ]);
    await analyse(work, { retry: true });
  }

  function readingSteps(hasDocuments) {
    return [
      ...(hasDocuments ? [{ key: 'read', label: 'Reading the documents' }] : []),
      { key: 'match', label: 'Matching Adobe solutions' },
      { key: 'gaps', label: hasDocuments ? 'Finding what the documents leave open' : 'Finding what is still open' },
    ];
  }

  function begin(list) {
    const names = [...list].map((file) => file.name);
    if (!names.length) return;
    leaveHero();
    setPhase('reading');
    retireReplies('nodocs');
    queue(async () => {
      postUser(sentFilesHtml(names));
      const work = workMessage(`Reading ${names.length === 1 ? 'your document' : `${names.length} documents`}`, readingSteps(true));
      work.start('read');
      await addExtracted(list);
      persist(a);
      syncHead();
      await analyse(work);
    });
  }

  function describe(text) {
    leaveHero();
    queue(async () => {
      postUser(text.length > NOTES_MIN || text.includes('\n') ? notesHtml(text, 'Your description') : esc(text));
      state.description = [state.description, text].filter(Boolean).join('\n\n');
      if (state.description.length < DESCRIPTION_MIN) {
        setPhase('nodocs');
        fluffy('<p>Tell me a little more: who the customer is, what they want to change and which Adobe products may be in play. Or add their documents with <strong>+</strong>.</p>');
        return;
      }
      iv.notes = [state.description];
      setPhase('reading');
      const work = workMessage('Reading your description', readingSteps(false));
      await analyse(work);
    });
  }

  /* ── Notes, questions and documents during the intake ─────────────── */

  async function fillFromText(material, attachments, kind) {
    const open = openQuestions();
    if (!open.length || !isAuthenticated() || (!material.trim() && !attachments.length)) return [];
    setBusy(true);
    try {
      const prompt = buildNotesPrompt({ material, questions: open, kind });
      const { answer } = await completedAnswer(streamQualification, {
        messages: [{ role: 'user', content: contentWith(prompt, attachments) }],
        webSearch: false,
        reasoningEffort: 'low',
        signal: life.signal,
      });
      const found = normalizeNoteAnswers(parseIntakeAnswer(answer), open);
      found.forEach((item) => { iv.answers[item.id] = { text: item.text, source: kind }; });
      if (found.length) save();
      return found;
    } catch (error) {
      if (aborted()) throw error;
      return [];
    } finally {
      setBusy(false);
    }
  }

  function continueFlow(ack = '') {
    renderStatus();
    if (state.phase === 'questions') {
      const active = questions().find((q) => q.id === state.active);
      if (active && isOpen(active)) {
        ask(active, { ack, again: true });
        return;
      }
      const next = nextOpen(state.active);
      if (next) ask(next, { ack });
      else review(ack, true);
      return;
    }
    if (state.phase === 'review') {
      review(ack);
      return;
    }
    fluffy(`${ackHtml(ack)}${state.phase === 'scope' ? '<p>Confirm the solutions above when you’re ready.</p>' : ''}`);
  }

  const labelFor = (id) => questions().find((q) => q.id === id)?.label || id;
  const labelsFor = (found) => listText(found.map((item) => labelFor(item.id)));

  async function readNotes(text) {
    postUser(notesHtml(text));
    iv.notes.push(text);
    save();
    const pending = openQuestions().length && isAuthenticated() ? post('assistant', TYPING) : null;
    const found = await fillFromText(text, [], 'notes');
    pending?.remove();
    const ack = found.length
      ? `Added as notes. They answer ${labelsFor(found)}.`
      : 'Added as notes. They go into the assessment as written.';
    continueFlow(ack);
  }

  async function answerQuestion(text) {
    if (!isAuthenticated()) {
      fluffy('<p>I need FluffyJaws to answer questions. Connect first.</p>', {
        replies: [{ text: 'Connect to FluffyJaws', primary: true, onPick: () => login() }],
        key: 'connect',
        offer: true,
      });
      return;
    }
    const msg = post('assistant', TYPING);
    const bubble = msg.querySelector('.nash-session-bubble');
    let streamed = '';
    setBusy(true);
    try {
      const context = intakeChatContext({
        intake: a.intake,
        scope: scopeNames(),
        answers: iv.answers,
        notes: iv.notes,
        material: intakeDocumentText(files(), QUESTION_CONTEXT_CHARS),
      });
      const { answer } = await completedAnswer(streamQualification, {
        messages: [{ role: 'user', content: `${context}\n\n---\nThe analyst asks: ${text}` }],
        webSearch: false,
        reasoningEffort: 'low',
        signal: life.signal,
        onDelta: (delta) => {
          streamed += delta;
          bubble.textContent = streamed;
        },
      });
      bubble.innerHTML = renderMarkdown(answer);
    } catch (error) {
      if (aborted()) throw error;
      bubble.innerHTML = `<p>${esc(`I couldn’t answer that just now: ${error.message}`)}</p>`;
    } finally {
      setBusy(false);
    }
    follow(msg);
  }

  async function addMoreDocuments(list) {
    const names = [...list].map((file) => file.name);
    postUser(sentFilesHtml(names));
    const work = workMessage(`Reading ${names.length === 1 ? names[0] : `${names.length} more documents`}`, [
      { key: 'read', label: 'Reading the documents' },
      { key: 'fill', label: 'Checking the open questions' },
    ]);
    work.start('read');
    setBusy(true);
    let extracted;
    try {
      extracted = await addExtracted(list);
    } finally {
      setBusy(false);
    }
    const { requirements, error } = countRequirements();
    a.intake.requirements = requirements ? {
      total: requirements.total, text: requirements.text, byPriority: requirements.byPriority,
    } : null;
    if (requirements) a.intake.evidence.functional = true;
    save();
    syncHead();
    refreshBriefCards();
    const result = readResult(extracted, requirements, error);
    work.finish('read', result.text, result.failed);
    const open = openQuestions();
    let found = [];
    if (!open.length) work.finish('fill', 'No open questions');
    else if (!isAuthenticated()) work.finish('fill', 'Not connected to FluffyJaws', true);
    else {
      work.start('fill');
      found = await fillFromText(intakeDocumentText(extracted, MATERIAL_CHARS), attachmentsFor(extracted), 'documents');
      work.finish('fill', found.length ? `Answered ${labelsFor(found)}` : 'Nothing new for the open questions');
    }
    work.collapse(`Read ${plural(names.length, 'more document')}${found.length ? ` · answered ${plural(found.length, 'question')}` : ''}`);
    if (error) fluffy(`<p class="nash-intake__warn">${ICON.warn}<span>${esc(error)}</span></p>`);
    continueFlow(found.length
      ? `Added to the assessment. ${names.length === 1 ? 'It answers' : 'They answer'} ${labelsFor(found)}.`
      : 'Added to the assessment.');
  }

  function addFiles(list) {
    const picked = [...(list || [])];
    if (!picked.length || ['reading', 'running'].includes(state.phase)) return;
    if (['start', 'nodocs'].includes(state.phase)) {
      begin(picked);
      return;
    }
    queue(() => addMoreDocuments(picked));
  }

  function submitTyped(text) {
    const { phase } = state;
    if (['start', 'nodocs'].includes(phase)) {
      describe(text);
      return;
    }
    if (['reading', 'running'].includes(phase)) return;
    const isNotes = text.length > NOTES_MIN || text.includes('\n');
    const isQuestion = !isNotes && /\?\s*$/.test(text);
    queue(async () => {
      if (isNotes) {
        await readNotes(text);
        return;
      }
      postUser(esc(text));
      if (isQuestion) {
        await answerQuestion(text);
        const active = questions().find((q) => q.id === state.active);
        if (state.phase === 'questions' && active && isOpen(active)) ask(active, { again: true });
        return;
      }
      const question = state.phase === 'questions' ? questions().find((q) => q.id === state.active) : null;
      if (question) {
        const sentence = tidyAnswer(text);
        const answer = state.compose?.build ? state.compose.build(sentence) : sentence;
        state.compose = null;
        record(question, { text: answer });
        return;
      }
      iv.notes.push(text);
      save();
      renderStatus();
      const tail = state.phase === 'scope' ? ' Confirm the solutions above when you’re ready.' : '';
      fluffy(`<p>Noted. I’ll pass that to the assessment as written.${tail}</p>`);
    });
  }

  /* ── Run ──────────────────────────────────────────────────────────── */

  function run() {
    if (state.phase === 'running' || state.busy || a.status === 'running') return;
    if (!isAuthenticated()) {
      login();
      return;
    }
    if (!iv.scopeConfirmed || !iv.scope.length) return;
    const missing = files().filter((file) => !hasContent(file)).map((file) => file.name);
    if (missing.length) {
      queue(() => {
        postUser('Run assessment');
        fluffy(`<p>I no longer have the contents of ${esc(listText(missing))}. Add ${missing.length === 1 ? 'it' : 'them'} again with <strong>+</strong>, or remove ${missing.length === 1 ? 'it' : 'them'} with <strong>Edit</strong> on the documents card, then run the assessment.</p>`);
      });
      return;
    }
    const { error: conflict } = countRequirements();
    if (conflict) {
      queue(() => {
        postUser('Run assessment');
        fluffy(`<p class="nash-intake__warn">${ICON.warn}<span>${esc(conflict)}</span></p>
          <p>Use <strong>Change</strong> next to Documents to remove the file that disagrees, or add a corrected copy with the same name, then run the assessment.</p>`);
      });
      return;
    }
    state.active = null;
    state.compose = null;
    retireReplies();
    retireCards('.nash-intake__scope:not(.is-locked)');
    // Frozen while it runs; a failed run gives the analyst the same cards back to edit.
    const reviews = [...log.querySelectorAll('.nash-intake__review:not(.is-stale)')];
    const frozen = [...log.querySelectorAll('.nash-intake__card button:not(:disabled), .nash-intake__replies[data-offer] button:not(:disabled)')];
    frozen.forEach((button) => { button.disabled = true; });
    reviews.forEach((card) => card.classList.add('is-stale'));
    log.querySelectorAll('.nash-intake__progress .nash-session-generation__retry').forEach((button) => {
      button.hidden = true;
    });
    setPhase('running');
    confirmSolutions();
    save();
    const { answered, unknown, open } = answerCounts(a.intake, iv.answers);
    const unknowns = unknown + open;
    const requirements = a.intake?.requirements?.total;
    const from = [
      requirements ? plural(requirements, 'requirement') : (files().length && materialNoun(files())) || 'your description',
      plural(answered, 'answer'),
    ];
    if (unknowns) from.push(plural(unknowns, 'unknown'));
    const notes = iv.notes.length && files().length ? ', plus your notes' : '';
    queue(async () => {
      postUser('Run assessment');
      const msg = fluffy(`<p>Started. I’m building the assessment from ${esc(listText(from))}${notes}. Keep this page open while it runs.</p><div class="nash-intake__progress"></div>`);
      const host = msg.querySelector('.nash-intake__progress');
      // The progress card fills in after this message is posted; keep it clear of the composer
      // unless the analyst has scrolled away to read something else.
      const sizes = new ResizeObserver(() => {
        const box = scroller.getBoundingClientRect();
        const rect = msg.getBoundingClientRect();
        if (rect.top < box.bottom && rect.bottom > box.top) follow(msg);
      });
      sizes.observe(host);
      let failure = null;
      try {
        await onRun({ host, retry: run });
      } catch (error) {
        failure = error;
      } finally {
        sizes.disconnect();
      }
      if (aborted() || !chat.isConnected || a.status === 'done') return;
      // The run failed: its message and retry stay in the chat; the answers stay editable.
      reviews.forEach((card) => card.classList.remove('is-stale'));
      frozen.forEach((button) => { if (button.isConnected) button.disabled = false; });
      setPhase('review');
      follow(msg);
      if (failure) throw failure;
    });
  }

  /* ── Resume ───────────────────────────────────────────────────────── */

  async function resume() {
    await loadCatalog();
    if (aborted()) return;
    leaveHero();
    const list = files();
    const missing = list.filter((file) => !hasContent(file)).map((file) => file.name);
    let welcome = `Welcome back. Here is where we got to with <strong>${esc(a.company || a.opportunity || 'this opportunity')}</strong>.`;
    if (missing.length) welcome += ` I no longer have the contents of ${esc(listText(missing))}; add ${missing.length === 1 ? 'it' : 'them'} again with <strong>+</strong> before you run the assessment.`;
    if (a.intake.source === 'description' && !list.length) state.description = iv.notes[0] || '';
    const canRetry = a.intake.failure && isAuthenticated()
      && (list.some(hasContent) || Boolean(state.description));
    if (canRetry) welcome += ` FluffyJaws couldn’t analyse ${esc(materialNoun(list))} last time, so you have my standard questions.`;
    fluffy(`<p>${welcome}</p>${briefCardHtml()}`, canRetry ? {
      replies: [{
        text: list.length ? 'Read the documents now' : 'Read my description now',
        primary: true,
        onPick: () => queue(() => reanalyse()),
      }],
      key: 'retry',
      offer: true,
    } : {});
    syncHead();
    if (!iv.scopeConfirmed) {
      setPhase('scope');
      postScopeCard('Confirm the Adobe solutions to assess.');
      return;
    }
    fluffy(`<div class="nash-intake__card nash-intake__scope is-locked">${lockedScopeHtml()}</div>`);
    const next = nextOpen();
    if (next) ask(next);
    else review();
  }

  async function readExisting() {
    await loadCatalog();
    if (aborted()) return;
    leaveHero();
    setPhase('reading');
    fluffy('<p>Welcome back. Nash has a new intake, so I’m reading your documents again.</p>');
    const work = workMessage('Reading your documents', readingSteps(true));
    work.start('read');
    await analyse(work);
  }

  /* ── Wiring ───────────────────────────────────────────────────────── */

  function onLogChange(event) {
    const box = event.target.closest('.nash-intake__scope input[type="checkbox"]');
    if (!box) return;
    const card = box.closest('.nash-intake__scope');
    const checked = [...card.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
    const confirm = card.querySelector('[data-act="scope-confirm"]');
    confirm.textContent = scopeLabel(checked.length);
    confirm.disabled = !checked.length;
    card.querySelector('.nash-intake__count').textContent = checked.length
      ? listText(checked.map(solutionName)) : 'Nothing selected';
    const group = box.closest('.nash-intake__group');
    const items = group.querySelectorAll('input[type="checkbox"]');
    const picked = group.querySelectorAll('input[type="checkbox"]:checked').length;
    group.querySelector('.nash-intake__group-toggle span').textContent = groupCount(items.length, picked);
  }

  function saveBrief(card) {
    const read = (name) => card.querySelector(`input[name="${name}"]`).value.trim();
    a.company = read('company') || a.company;
    a.website = read('website');
    a.dr = read('dr');
    iv.briefEdited = true;
    if (!iv.scopeConfirmed) delete a.assessmentName;
    else confirmSolutions();
    save();
    card.outerHTML = briefCardHtml(false);
    refreshBriefCards();
    syncHead();
    if (state.phase === 'review') queue(() => review('Details updated.'));
  }

  function removeFile(card, name) {
    const values = {
      company: card.querySelector('input[name="company"]')?.value,
      website: card.querySelector('input[name="website"]')?.value,
      dr: card.querySelector('input[name="dr"]')?.value,
    };
    a.files = files().filter((file) => file.name !== name);
    a.fileName = fileNameFor(a.files);
    if (a.intake) {
      const { requirements } = countRequirements();
      a.intake.requirements = requirements ? {
        total: requirements.total, text: requirements.text, byPriority: requirements.byPriority,
      } : null;
      if (!requirements && a.intake.source === 'documents') a.intake.evidence.functional = false;
    }
    save();
    syncHead();
    card.outerHTML = briefCardHtml(true, values);
    log.querySelector('.nash-intake__brief.is-editing input')?.focus();
  }

  function onLogClick(event) {
    const action = event.target.closest('[data-act]');
    if (!action || action.disabled) return;
    const card = action.closest('.nash-intake__card');
    switch (action.dataset.act) {
      case 'group-toggle': {
        const group = action.closest('.nash-intake__group');
        const grid = group.querySelector('.nash-session-periodic');
        grid.hidden = !grid.hidden;
        action.setAttribute('aria-expanded', String(!grid.hidden));
        group.classList.toggle('is-open', !grid.hidden);
        break;
      }
      case 'scope-confirm':
        confirmScope(card);
        break;
      case 'scope-change':
        queue(() => {
          postUser('Change the Adobe scope');
          postScopeCard('Sure. Update the solutions, then confirm.');
        });
        break;
      case 'brief-edit':
        card.outerHTML = briefCardHtml(true);
        log.querySelector('.nash-intake__brief.is-editing input')?.focus();
        break;
      case 'brief-cancel':
        card.outerHTML = briefCardHtml(false);
        break;
      case 'brief-save':
        saveBrief(card);
        break;
      case 'file-remove':
        removeFile(card, action.dataset.name);
        break;
      case 'brief-change':
        queue(() => {
          postUser('Change the customer details');
          fluffy(`<p>Sure. Fix what is off and save.</p>${briefCardHtml(true)}`);
          log.querySelector('.nash-intake__brief.is-editing input')?.focus();
        });
        break;
      case 'q-change': {
        const question = questions().find((q) => q.id === action.dataset.key);
        if (!question) break;
        queue(() => {
          postUser(esc(`${iv.answers[question.id] ? 'Change' : 'Answer'}: ${question.label.toLowerCase()}`));
          ask(question);
        });
        break;
      }
      case 'run':
        run();
        break;
      case 'connect':
        login();
        break;
      default:
    }
  }

  function buildDock() {
    const el = document.createElement('div');
    el.className = 'nash-intake__dock';
    el.innerHTML = `<div class="nash-intake__status" hidden></div>
      <form class="nash-intake__composer" autocomplete="off">
        <textarea class="nash-intake__input" rows="1" aria-label="Message Fluffy"></textarea>
        <div class="nash-intake__tools">
          <button type="button" class="nash-intake__attach" aria-label="Add documents" title="Add documents">${ICON.plus}</button>
          <input class="nash-intake__file" type="file" accept="${ACCEPT}" multiple hidden/>
          <span class="nash-intake__model">${isAuthenticated() ? '<span class="nash-session-conn-dot" aria-hidden="true"></span>' : ''}FluffyJaws</span>
          <button type="submit" class="nash-session-send nash-intake__send" aria-label="Send" disabled>${ICON.send}</button>
        </div>
      </form>
      <p class="nash-intake__hint">Enter to send · Shift+Enter for a new line</p>`;
    input = el.querySelector('.nash-intake__input');
    sendButton = el.querySelector('.nash-intake__send');
    attachButton = el.querySelector('.nash-intake__attach');
    const fileInput = el.querySelector('.nash-intake__file');
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    };
    const submit = () => {
      const text = input.value.trim();
      if (!text || sendButton.disabled) return;
      input.value = '';
      resize();
      syncComposer();
      submitTyped(text);
    };
    input.addEventListener('input', () => { resize(); syncComposer(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        submit();
      }
    });
    el.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    attachButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const picked = [...fileInput.files];
      fileInput.value = '';
      addFiles(picked);
    });
    el.addEventListener('click', (event) => {
      const action = event.target.closest('.nash-intake__status [data-act]');
      if (!action) return;
      if (action.dataset.act === 'run') run();
      if (action.dataset.act === 'to-review') {
        queue(() => {
          postUser('Review and run');
          review();
        });
      }
    });
    return el;
  }

  function wireDrop() {
    const overlay = document.createElement('div');
    overlay.className = 'nash-intake__drop';
    overlay.hidden = true;
    overlay.innerHTML = `<div>${ICON.doc}<strong>Drop to add documents</strong><span>Fluffy reads them straight away</span></div>`;
    panel.append(overlay);
    let depth = 0;
    const accepts = (event) => [...(event.dataTransfer?.types || [])].includes('Files')
      && !['reading', 'running'].includes(state.phase);
    panel.addEventListener('dragenter', (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      depth += 1;
      overlay.hidden = false;
    }, { signal: life.signal });
    panel.addEventListener('dragover', (event) => {
      if (accepts(event)) event.preventDefault();
    }, { signal: life.signal });
    panel.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    }, { signal: life.signal });
    panel.addEventListener('drop', (event) => {
      depth = 0;
      overlay.hidden = true;
      if (!accepts(event)) return;
      event.preventDefault();
      addFiles(event.dataTransfer.files);
    }, { signal: life.signal });
  }

  function leaveHero() {
    const hero = chat.querySelector('.nash-intake__hero');
    if (!hero) return;
    hero.remove();
    chat.classList.remove('is-empty');
    panel.append(dock);
    input.focus({ preventScroll: true });
  }

  function mountChat() {
    const connect = isAuthenticated() ? '' : `<p class="nash-intake__connect">Fluffy reads documents through FluffyJaws.
        <button type="button" class="nash-intake__link" data-act="connect">Connect to FluffyJaws</button></p>`;
    area.innerHTML = `<section class="nash-intake is-empty" aria-label="New assessment with Fluffy">
        <div class="nash-intake__hero">
          ${PIX}
          <h2>Start with the customer’s documents</h2>
          <p>RFI, RFP, requirement workbooks or discovery notes. Fluffy reads them, matches the Adobe solutions and asks only what the documents can’t answer.</p>
          <div class="nash-intake__hero-dock"></div>
          <p class="nash-intake__hero-hint">PDF, Word, Excel, CSV or text. No documents yet? Describe the opportunity instead.</p>
          ${connect}
        </div>
        <div class="nash-intake__log" aria-live="polite"></div>
      </section>`;
    chat = area.querySelector('.nash-intake');
    log = chat.querySelector('.nash-intake__log');
    dock = buildDock();
    chat.querySelector('.nash-intake__hero-dock').append(dock);
    chat.querySelector('.nash-intake__connect [data-act="connect"]')?.addEventListener('click', () => login());
    log.addEventListener('change', onLogChange);
    log.addEventListener('click', onLogClick);
    wireDrop();
  }

  mountChat();
  setPhase('start');
  syncHead();
  if (a.intake?.version === INTAKE_VERSION) queue(() => resume());
  else if (files().some(hasContent)) queue(() => readExisting());
  else {
    loadCatalog();
    input.focus({ preventScroll: true });
  }
  return { dispose: () => life.abort() };
}
