/**
 * loads and decorates the nash-overview block
 * Fetches /qualifications/query.json for live data; falls back to mock data in dev.
 * Also merges locally-created assessments (localStorage) so completed runs appear here.
 * Document metadata: title, description, status, score, scoringstatus, verdict,
 * cms, user, lastModified.
 *
 * @param {Element} block The block element
 */

import {
  listAssessments, deleteAssessment, toggleBookmark, isBookmarked,
  hideFromList, isHidden,
} from '../../scripts/nash-assessments.js';
import { assessmentTitle, slugify } from '../../scripts/da-doc.js';
import { canDelete } from '../../scripts/nash-perms.js';
import { getUserInfo } from '../../scripts/nash-auth.js';
import { unpublishAssessment } from '../../scripts/da-publish.js';
import { assessmentScore, dimensionPercent } from '../../scripts/nash-scoring.js';
import {
  RUBRIC, ratingValue, ratingsWithoutEvidence, verdictForScore,
} from '../../scripts/nash-rubric.js';
import {
  INTAKE_DIMENSIONS, INTAKE_VERSION, answerCounts, evidencedDimensions,
} from '../../scripts/nash-intake.js';

const MOCK_REPORTS = [
  {
    id: 1, company: 'Fluidra', domain: 'fluidra.com', status: 'generating', pct: 74, steps: 17, total: 23, task: 'Product Assessment & Success Story', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 2, company: 'Fnbo', domain: 'fnbo.com', status: 'generating', pct: 34, steps: 8, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 3, company: 'Focus GTS', domain: 'focusgts.com', status: 'generating', pct: 21, steps: 5, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'Unknown', time: 'just now', score: null, path: null,
  },
  {
    id: 4, company: 'Fanatics', domain: 'fanatics.com', status: 'generating', pct: 95, steps: 22, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'Unknown', time: 'just now', score: null, path: null,
  },
  {
    id: 5, company: 'Ford', domain: 'ford.com', status: 'generating', pct: 4, steps: 1, total: 23, task: 'Building report content', user: 'josec@adobe.com', cms: 'AEM Sites', time: 'just now', score: null, path: null,
  },
  {
    id: 6, company: 'Fiserv', domain: 'fiserv.com', status: 'generating', pct: 58, steps: 13, total: 23, task: 'Core Analysis', user: 'josec@adobe.com', cms: 'Unknown', time: '2m ago', score: null, path: null,
  },
  {
    id: 7, company: 'Forescout', domain: 'forescout.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '18m ago', score: 78, path: null,
  },
  {
    id: 8, company: 'Firstrand Group', domain: 'firstrand.co.za', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Unknown', time: '32m ago', score: 62, path: null,
  },
  {
    id: 9, company: 'Fortive Corp', domain: 'fortive.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '1h ago', score: 85, path: null,
  },
  {
    id: 10, company: 'Frontier Airlines', domain: 'flyfrontier.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Sitecore', time: '2h ago', score: 71, path: null,
  },
  {
    id: 11, company: 'FNZ Group', domain: 'fnz.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'Unknown', time: '3h ago', score: 44, path: null,
  },
  {
    id: 12, company: 'Ferretti Group', domain: 'ferrettigroup.com', status: 'done', pct: 100, steps: 23, total: 23, task: 'Complete', user: 'josec@adobe.com', cms: 'AEM Sites', time: '5h ago', score: 91, path: null,
  },
];

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toTitleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Labels the app writes when there is no real name; never shown as the company. */
const PLACEHOLDER_NAME = /^(unassigned|untitled)$/i;

function realName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return PLACEHOLDER_NAME.test(name) ? '' : name;
}

/* "DR 4710704" only for a real deal-registration number, never free text. */
function drLabel(value) {
  const number = String(value || '').trim().replace(/^DR[\s#:-]*/i, '');
  return /^\d[\d\s-]{3,}$/.test(number) ? `DR ${number.replace(/\s+/g, '')}` : '';
}

/* A run with no saved progress for this long was interrupted (e.g. the tab closed). */
const STALLED_AFTER_MS = 30 * 60 * 1000;

function runState(a) {
  const last = Math.max(Number(a.updatedAt) || 0, Number(a.runStartedAt) || 0);
  return {
    status: 'generating',
    startedAt: Number(a.runStartedAt) || 0,
    stalled: Boolean(last) && Date.now() - last > STALLED_AFTER_MS,
    updating: Boolean(a.reportMarkdown || a.report || a.reportHtml),
  };
}

/* What a draft already has: dimensions with customer evidence and answered questions. */
function draftState(a) {
  if (a.intake?.version !== INTAKE_VERSION) return { status: 'draft', intake: null };
  const answers = a.interview?.version === INTAKE_VERSION ? (a.interview.answers || {}) : {};
  const { total, answered } = answerCounts(a.intake, answers);
  return {
    status: 'draft',
    intake: { evidenced: [...evidencedDimensions(a.intake, answers)], total, answered },
  };
}

function mapQueryRow(row, idx) {
  const status = (row.status || '').toLowerCase() === 'generating' ? 'generating' : 'done';
  // Blank index metadata is authoritative, not an invitation to reconstruct a rating.
  const score = status === 'done' ? assessmentScore({
    score: row.score,
    scoringstatus: row.scoringstatus,
    assessmentView: row.assessmentView,
  }) : null;
  // Strip " | Nash" suffix from <title> and fall back to path slug
  const rawTitle = (row.title || '').replace(/\s*\|.*$/, '').trim();
  const pathSlug = (row.path || '').split('/').pop();
  // The opportunity is the customer as the analyst typed it; the extracted title can be noisy.
  const company = realName(row.opportunity) || realName(rawTitle) || toTitleCase(pathSlug);
  let dimensions = [];
  try {
    const parsed = JSON.parse(row.dimensionvalues || '[]');
    if (Array.isArray(parsed)) dimensions = parsed;
  } catch {
    dimensions = [];
  }
  if (!dimensions.length) {
    const names = Array.isArray(row.dimensionnames) ? row.dimensionnames : [];
    const scored = Array.isArray(row.dimensionscored) ? row.dimensionscored : [];
    const max = Array.isArray(row.dimensionmax) ? row.dimensionmax : [];
    dimensions = names.map((dimension, dimensionIndex) => ({
      dimension,
      scored: scored[dimensionIndex],
      max: max[dimensionIndex],
    }));
  }
  const solutions = row.solutionnames || '';
  return {
    id: idx,
    company,
    assessmentName: assessmentTitle({
      assessmentName: row.assessmentname,
      company,
      solutionNames: solutions,
    }),
    // The index description holds the DR number or, without one, the company name.
    dr: drLabel(row.description),
    status,
    pct: status === 'done' ? 100 : (parseInt(row.progress, 10) || 0),
    steps: parseInt(row.steps, 10) || 0,
    total: parseInt(row.totalsteps, 10) || 23,
    task: row.task || 'Processing',
    user: row.user || '',
    solutions,
    dimensions,
    assessmentView: row.assessmentView || null,
    time: relativeTime(row.lastmodified || row.lastModified),
    ts: Number(row.lastmodified || row.lastModified) || 0,
    score,
    scoringstatus: score === null ? 'not-calibrated' : 'scored',
    verdict: row.verdict || '',
    path: row.path || null,
    isLocal: false,
    slug: (row.path || '').split('/').pop(),
    key: row.path || `pub-${idx}`,
  };
}

/* Map a locally-created assessment (localStorage) to the card model. */
function mapLocalAssessment(a, idx) {
  const ts = Math.floor((a.updatedAt || a.createdAt || Date.now()) / 1000);
  const path = `/indextest?a=${encodeURIComponent(a.id)}`;
  const score = a.status === 'done' ? assessmentScore(a) : null;
  let state = { status: 'done' };
  if (a.status === 'running') state = runState(a);
  else if (a.status !== 'done') state = draftState(a);
  return {
    id: `local-${idx}`,
    company: realName(a.opportunity) || realName(a.company),
    assessmentName: assessmentTitle({
      ...a, company: realName(a.company), opportunity: realName(a.opportunity),
    }),
    dr: drLabel(a.dr),
    ...state,
    pct: state.status === 'done' ? 100 : 0,
    user: a.user || (getUserInfo()?.email || ''),
    solutions: (a.solutions || []).map((s) => s.name).join(', ') || a.solutionNames || '',
    dimensions: Array.isArray(a.dimensions) ? a.dimensions : [],
    assessmentView: a.assessmentView || null,
    time: relativeTime(ts),
    ts,
    score,
    scoringstatus: score === null ? 'not-calibrated' : 'scored',
    verdict: a.verdict || '',
    path,
    isLocal: true,
    localId: a.id,
    slug: a.publishedSlug || '',
    key: path,
  };
}

function scoreColor(s) {
  if (s == null) return 'var(--ink-70, #4a4d55)';
  if (s >= 70) return 'var(--green, #0d7a45)';
  if (s >= 50) return 'var(--amber, #b45309)';
  return 'var(--red, #eb1000)';
}

function verdictStyle(s) {
  if (s == null) return 'background:var(--ink-08,#f4f4f6);color:var(--ink-70,#4a4d55);';
  if (s >= 70) return 'background:var(--green-lt,#edf7f2);color:var(--green,#0d7a45);';
  if (s >= 50) return 'background:var(--amber-lt,#fef3c7);color:var(--amber,#b45309);';
  return 'background:var(--red-lt,#fff0ef);color:var(--red,#eb1000);';
}

function percentTone(percent) {
  if (percent == null) return 'none';
  if (percent >= 70) return 'go';
  if (percent >= 50) return 'cond';
  return 'nogo';
}

/* Verdict chip label + tone — prefer the stored verdict, fall back to score. */
function verdictInfo(r) {
  const label = typeof r.verdict === 'string' ? r.verdict.trim() : '';
  const v = label.toLowerCase();
  let tone = 'none';
  if (/no.?go/.test(v)) tone = 'nogo';
  else if (/condition/.test(v)) tone = 'cond';
  else if (/\bgo\b/.test(v)) tone = 'go';
  if (label) return { label, tone, style: verdictStyle({ go: 80, cond: 60, nogo: 0 }[tone]) };
  if (r.score != null) {
    return {
      label: verdictForScore(r.score), tone: percentTone(r.score), style: verdictStyle(r.score),
    };
  }
  return { label: '', tone: 'none', style: '' };
}

const PILLAR_ACCENTS = {
  brand: { name: 'Brand Visibility', color: '#34d399' },
  engagement: { name: 'Customer Engagement', color: '#8f9bff' },
  content: { name: 'Content Supply Chain', color: '#f5b941' },
  ai: { name: 'AI Platform & Orchestration', color: '#b48cff' },
  developer: { name: 'Developer & Extensibility', color: '#4cc3ec' },
};

function solutionPillar(solutions = '') {
  const value = solutions.toLowerCase();
  if (/app builder|developer|extensib/.test(value)) return PILLAR_ACCENTS.developer;
  if (/orchestrat|intelligence|coworker|agent/.test(value)) return PILLAR_ACCENTS.ai;
  if (/assets|workfront|express|firefly|frame|learning manager|substance/.test(value)) {
    return PILLAR_ACCENTS.content;
  }
  if (/analytics|campaign|journey|marketo|target|audience|experience platform|rtcdp|cdp/.test(value)) {
    return PILLAR_ACCENTS.engagement;
  }
  return PILLAR_ACCENTS.brand;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function solutionNames(solutions = '') {
  return String(solutions || '').split(',').map((solution) => solution.trim()).filter(Boolean);
}

/* Display names only: "Adobe Experience Manager Sites as a Cloud Service" → "AEM Sites". */
const SOLUTION_SHORT_FORMS = [
  [/^Experience Platform\b/i, 'AEP'],
  [/^Journey Optimizer\b/i, 'AJO'],
  [/^Real-Time (?:Customer Data Platform|CDP)\b/i, 'RT-CDP'],
  [/^Customer Journey Analytics\b/i, 'CJA'],
];

function shortSolution(name) {
  const short = SOLUTION_SHORT_FORMS.reduce(
    (text, [pattern, form]) => text.replace(pattern, form),
    name
      .replace(/^Adobe Experience Manager\b/i, 'AEM')
      .replace(/\s+as\s+(?:an?\s+)?Cloud Service$/i, '')
      .replace(/^Adobe\s+/i, '')
      .trim(),
  );
  return short || name;
}

function scopeLine(r) {
  const names = solutionNames(r.solutions);
  const short = [...new Set(names.map(shortSolution))];
  const parts = short.slice(0, 3);
  if (short.length > 3) parts.push(`+${short.length - 3} more`);
  if (r.dr) parts.push(r.dr);
  if (!parts.length) return '';
  const title = [...names, r.dr].filter(Boolean).join(' · ');
  return `<p class="nash-overview-scope" title="${esc(title)}">${esc(parts.join(' · '))}</p>`;
}

const CORE_DIMENSIONS = RUBRIC.filter((rule) => !rule.upside).map((rule) => rule.dimension);
const shortDimension = (name) => name.split(' ')[0];

function dimensionName(dimension) {
  return String(dimension?.dimension || dimension?.name || '').trim();
}

/* The six scored dimensions in rubric order; older reports keep their own names. */
function cardDimensions(r) {
  const list = (Array.isArray(r.dimensions) ? r.dimensions : [])
    .filter((dimension) => dimension && typeof dimension === 'object' && dimensionName(dimension));
  const byName = new Map(list.map((dimension) => [
    dimensionName(dimension).toLowerCase(), dimension,
  ]));
  const known = CORE_DIMENSIONS.filter((name) => byName.has(name.toLowerCase())).length;
  const picked = known >= 3
    ? CORE_DIMENSIONS.map((name) => ({
      name, label: shortDimension(name), dimension: byName.get(name.toLowerCase()),
    }))
    : list.filter((dimension) => !/agentic/i.test(dimensionName(dimension))).slice(0, 6)
      .map((dimension) => {
        const name = dimensionName(dimension);
        return { name, label: name, dimension };
      });
  const assumed = new Set(ratingsWithoutEvidence(r.assessmentView).map((item) => item.dimension));
  return picked.map(({ name, label, dimension }) => {
    const percent = dimension ? dimensionPercent(dimension) : null;
    const rating = ratingValue(dimension?.rating);
    const isAssumed = rating !== null && assumed.has(name);
    let detail = 'not rated';
    if (rating !== null) detail = `${rating} of 5`;
    else if (percent !== null) {
      const scored = dimension.scored === undefined ? dimension.score : dimension.scored;
      detail = `${Number(scored)} of ${Number(dimension.max)} points`;
    }
    return {
      name,
      label,
      percent,
      isAssumed,
      filled: rating ?? (percent === null ? 0 : Math.round(percent / 20)),
      detail: isAssumed ? `${detail}, a default rating: no customer evidence yet` : detail,
    };
  });
}

function dimensionBars(dimensions) {
  const items = dimensions.map((dimension) => {
    const segments = [1, 2, 3, 4, 5]
      .map((step) => `<i${step <= dimension.filled ? ' class="on"' : ''}></i>`).join('');
    const text = `${dimension.name}: ${dimension.detail}`;
    const classes = [
      'nash-overview-dim',
      `tone-${percentTone(dimension.percent)}`,
      dimension.percent === null ? 'is-unrated' : '',
      dimension.isAssumed ? 'is-assumed' : '',
    ].filter(Boolean).join(' ');
    return `<li class="${classes}" title="${esc(text)}">
      <span class="nash-overview-dim-name" aria-hidden="true">${esc(dimension.label)}${dimension.isAssumed ? '*' : ''}</span>
      <span class="nash-overview-dim-bar" aria-hidden="true">${segments}</span>
      <span class="nash-overview-sr">${esc(text)}</span>
    </li>`;
  }).join('');
  const note = dimensions.some((dimension) => dimension.isAssumed)
    ? '<p class="nash-overview-dims-note">* Default rating: no customer evidence yet.</p>' : '';
  return `<ul class="nash-overview-dims" aria-label="Dimension ratings">${items}</ul>${note}`;
}

function skeletonBars() {
  const items = CORE_DIMENSIONS.map((name) => `<li class="nash-overview-dim">
      <span class="nash-overview-dim-name">${esc(shortDimension(name))}</span>
      <i class="nash-overview-skel"></i>
    </li>`).join('');
  return `<ul class="nash-overview-dims" aria-hidden="true">${items}</ul>`;
}

function evidenceDots(evidenced = []) {
  const on = new Set(evidenced);
  const items = INTAKE_DIMENSIONS.map((dimension) => {
    const has = on.has(dimension.key);
    const text = `${dimension.name}: ${has ? 'customer evidence' : 'no customer evidence yet'}`;
    return `<li class="nash-overview-dim${has ? ' is-on' : ''}" title="${esc(text)}">
      <span class="nash-overview-dim-name" aria-hidden="true">${esc(shortDimension(dimension.name))}</span>
      <i class="nash-overview-ev" aria-hidden="true"></i>
      <span class="nash-overview-sr">${esc(text)}</span>
    </li>`;
  }).join('');
  return `<ul class="nash-overview-dims is-evidence" aria-label="Customer evidence by dimension">${items}</ul>`;
}

const nextStep = (label, lead = '') => `<p class="nash-overview-next"><span>${lead}</span><span class="nash-overview-cta">${label} →</span></p>`;

function draftBody(r) {
  if (!r.intake) {
    return `<p class="nash-overview-line">Nothing analysed yet. Add the customer’s documents or describe the opportunity.</p>
      ${nextStep('Continue')}`;
  }
  const { evidenced, total, answered } = r.intake;
  return `<p class="nash-overview-line"><span><strong>${evidenced.length} of ${INTAKE_DIMENSIONS.length}</strong> dimensions have customer evidence</span></p>
    ${evidenceDots(evidenced)}
    ${nextStep('Continue', total ? `${answered} of ${total} questions answered` : 'No open questions')}`;
}

function runBody(r) {
  if (r.stalled) {
    return `<p class="nash-overview-line">This run stopped before it finished. Open it to pick it up again.</p>
      ${nextStep('Resume')}`;
  }
  const spinner = '<span class="nash-overview-spin" aria-hidden="true"></span>';
  if (r.isLocal) {
    const started = r.startedAt ? `Started ${relativeTime(Math.floor(r.startedAt / 1000))}. ` : '';
    const rest = r.updating
      ? 'The ratings refresh when the update finishes.' : 'The six ratings appear when it finishes.';
    return `<p class="nash-overview-line">${spinner}<span>${started}${rest}</span></p>${skeletonBars()}`;
  }
  const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
  return `<p class="nash-overview-line">${spinner}<span>${esc(r.task || 'Processing')} · ${r.steps} of ${r.total} tasks</span><strong class="nash-overview-line-end">${pct}%</strong></p>
    <div class="nash-overview-progress" role="progressbar" aria-label="Generation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    ${skeletonBars()}`;
}

function unscoredNote(r) {
  const scoring = r.assessmentView?.scoring || {};
  let reason = typeof scoring.reason === 'string' ? scoring.reason.trim() : '';
  if (!reason && scoring.status === 'incomplete') {
    reason = 'Not every dimension has a rating, so no total was calculated.';
  }
  if (!reason) reason = 'The verdict is qualitative. Open the report for the reasons behind it.';
  return `<div class="nash-overview-note">
    <span class="nash-overview-sr">Fit score: Not scored.</span>
    <strong aria-hidden="true">Not scored</strong>
    <span class="nash-overview-note-text" title="${esc(reason)}">${esc(reason)}</span>
  </div>`;
}

function cardBody(r) {
  if (r.status === 'draft') return draftBody(r);
  if (r.status === 'generating') return runBody(r);
  if (r.score == null) return unscoredNote(r);
  const dimensions = cardDimensions(r);
  if (!dimensions.length) {
    return '<p class="nash-overview-line">Dimension ratings weren’t recorded for this report.</p>';
  }
  return dimensionBars(dimensions);
}

function cardResult(r) {
  if (r.status === 'draft') return '<span class="nash-overview-pill tone-none">Draft</span>';
  if (r.status === 'generating') {
    if (r.stalled) return '<span class="nash-overview-pill tone-cond">Interrupted</span>';
    return `<span class="nash-overview-pill tone-none">${r.updating ? 'Updating' : 'Generating'}</span>`;
  }
  const verdict = verdictInfo(r);
  const pill = verdict.label
    ? `<span class="nash-overview-pill tone-${verdict.tone}">${esc(verdict.label)}</span>` : '';
  if (r.score == null) return pill;
  return `<p class="nash-overview-score tone-${verdict.tone}">
      <span class="nash-overview-sr">${esc(r.score)} out of 100 fit score</span>
      <strong aria-hidden="true">${esc(r.score)}</strong><small aria-hidden="true">/100</small>
    </p>${pill}`;
}

const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

/* Delete an assessment: local ones from localStorage, published ones by
   unpublishing them from DA. Permission is enforced by canDelete (client) and
   again server-side for published reports. */
async function deleteReport(r) {
  // eslint-disable-next-line no-alert, no-restricted-globals
  if (!window.confirm(`Delete the assessment${r.company ? ` for ${r.company}` : ''}? This can’t be undone.`)) return;
  const card = document.querySelector(`.nash-overview-card[data-id="${CSS.escape(String(r.id))}"]`);
  try {
    if (r.isLocal) {
      deleteAssessment(r.localId);
      if (r.slug) await unpublishAssessment(r.slug); // also remove any published copy
    } else if (r.slug) {
      await unpublishAssessment(r.slug);
    }
    // Persist the deletion locally so it sticks across reloads even while the
    // published query index is still catching up (it lags a publish/unpublish).
    if (r.key) hideFromList(r.key);
    card?.remove();
    document.dispatchEvent(new CustomEvent('nash:overview-remove', { detail: { id: r.id }, bubbles: true }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Nash delete failed', err);
    // eslint-disable-next-line no-alert
    window.alert(err.message || 'Couldn’t delete the assessment.');
  }
}

function buildCard(r) {
  const card = document.createElement('div');
  const pillar = solutionPillar(r.solutions);
  const live = r.status === 'generating' && !r.stalled;
  card.className = `nash-overview-card${live ? ' generating' : ''}`;
  card.style.setProperty('--overview-card-accent', pillar.color);
  card.setAttribute('role', 'listitem');
  card.dataset.id = r.id;
  card.dataset.status = r.status;
  card.dataset.scoringStatus = r.scoringstatus || (r.score == null ? 'not-calibrated' : 'scored');
  card.dataset.company = r.company.toLowerCase();
  const bookmarked = isBookmarked(r.key);
  const allowDelete = canDelete(r.user);
  if (bookmarked) card.classList.add('is-bookmarked');
  const meta = [r.user, r.time].filter(Boolean).join(' · ');

  card.innerHTML = `
    <div class="nash-overview-card-head">
      <div class="nash-overview-card-id">
        <h2 class="nash-overview-company${r.company ? '' : ' is-missing'}">${r.company ? esc(r.company) : 'Company not set'}<span class="nash-overview-star" role="img" aria-label="Bookmarked"${bookmarked ? '' : ' hidden'}>${STAR}</span></h2>
        ${scopeLine(r)}
      </div>
      <div class="nash-overview-result">${cardResult(r)}</div>
    </div>
    <div class="nash-overview-card-body">${cardBody(r)}</div>
    <div class="nash-overview-card-footer">
      <span class="nash-overview-footer-meta" title="${esc(meta)}">${esc(meta)}</span>
      <div class="nash-overview-menuwrap">
        <button class="nash-overview-menu-btn" aria-label="More options for ${esc(r.company || 'this assessment')}" type="button" aria-haspopup="true" aria-expanded="false">
          <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        <div class="nash-overview-cardmenu" role="menu" hidden>
          <button type="button" role="menuitem" data-act="bookmark">${bookmarked ? 'Remove bookmark' : 'Bookmark'}</button>
          ${allowDelete ? '<button type="button" role="menuitem" class="danger" data-act="delete">Delete</button>' : ''}
        </div>
      </div>
    </div>
  `;

  const menu = card.querySelector('.nash-overview-cardmenu');
  const menuBtn = card.querySelector('.nash-overview-menu-btn');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    // Close any other open card menus first.
    document.querySelectorAll('.nash-overview-cardmenu').forEach((m) => { m.hidden = true; });
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  menu.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    menu.hidden = true;
    if (act === 'bookmark') {
      toggleBookmark(r.key);
      document.dispatchEvent(new CustomEvent('nash:overview-refresh', { bubbles: true }));
    } else if (act === 'delete') {
      deleteReport(r);
    }
  });

  card.addEventListener('click', (e) => {
    if (e.target.closest('.nash-overview-menuwrap')) return;
    if (r.path) {
      // Cache-bust navigation to a published live page so a fresh re-publish
      // isn't hidden by the live host's 2h browser cache.
      const bust = r.path.startsWith('/qualifications/')
        ? `${r.path.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
      window.location.href = `${r.path}${bust}`;
    } else {
      document.dispatchEvent(new CustomEvent('nash:open-detail', { detail: { report: r }, bubbles: true }));
    }
  });

  return card;
}

function renderCards(block, reports) {
  const grid = block.querySelector('.nash-overview-grid');
  if (!grid) return;
  grid.innerHTML = '';
  reports.forEach((r) => grid.appendChild(buildCard(r)));
}

/* Clean, borderless table for the list view. */
function tableRow(r) {
  let scoreCell;
  if (r.status === 'draft') {
    scoreCell = '<span class="nash-overview-t-muted">Draft</span>';
  } else if (r.status === 'generating') {
    const label = r.stalled ? 'Interrupted' : `Generating${r.pct ? ` ${r.pct}%` : ''}`;
    scoreCell = `<span class="nash-overview-t-gen">${label}</span>`;
  } else if (r.score == null) {
    scoreCell = '<span class="nash-overview__unscored-label" aria-label="Fit score: Not scored">Not scored</span>';
  } else {
    scoreCell = `<span class="nash-overview-t-score" style="color:${scoreColor(r.score)}">${r.score}</span><span class="nash-overview-t-of"> / 100</span>`;
  }
  const v = verdictInfo(r);
  const verdictCell = r.status !== 'done' || !v.label
    ? '<span class="nash-overview-t-muted">—</span>'
    : `<span class="nash-overview-verdict" style="${v.style}">${esc(v.label)}</span>`;
  const solutions = [...new Set(solutionNames(r.solutions).map(shortSolution))].join(', ');
  return `<tr class="nash-overview-trow" data-id="${esc(r.id)}" data-status="${esc(r.status)}" data-scoring-status="${esc(r.scoringstatus || (r.score == null ? 'not-calibrated' : 'scored'))}" data-company="${esc(r.company.toLowerCase())}"${r.path ? ` data-path="${esc(r.path)}"` : ''}>
    <td class="nash-overview-t-name">${r.company ? esc(r.company) : '<span class="nash-overview-t-muted">Company not set</span>'}</td>
    <td>${esc(r.assessmentName || r.company)}</td>
    <td>${scoreCell}</td>
    <td>${verdictCell}</td>
    <td class="nash-overview-t-muted">${esc(solutions || '—')}</td>
    <td class="nash-overview-t-muted">${esc(r.user || '')}</td>
    <td class="nash-overview-t-muted nash-overview-t-time">${esc(r.time || '')}</td>
  </tr>`;
}

function renderTable(block, reports) {
  const wrap = block.querySelector('.nash-overview-listwrap');
  if (!wrap) return;
  wrap.innerHTML = `<table class="nash-overview-table">
    <thead><tr>
      <th>Opportunity</th><th>Assessment</th><th>Fit score</th><th>Verdict</th><th>Solutions</th><th>Owner</th><th>Updated</th>
    </tr></thead>
    <tbody>${reports.map(tableRow).join('')}</tbody>
  </table>`;
  wrap.querySelectorAll('.nash-overview-trow').forEach((row) => {
    row.addEventListener('click', () => {
      const report = reports.find((r) => String(r.id) === row.dataset.id);
      if (row.dataset.path) window.location.href = row.dataset.path;
      else if (report) document.dispatchEvent(new CustomEvent('nash:open-detail', { detail: { report }, bubbles: true }));
    });
  });
}

function reportStats(reports) {
  const completed = reports.filter((report) => report.status === 'done');
  const scored = completed.filter((report) => Number.isFinite(report.score));
  const go = scored.filter((report) => report.score >= 70).length;
  return {
    total: reports.length,
    done: completed.length,
    gen: reports.filter((report) => report.status === 'generating').length,
    draft: reports.filter((report) => report.status === 'draft').length,
    avg: scored.length
      ? Math.round(scored.reduce((sum, report) => sum + report.score, 0) / scored.length) : null,
    winRate: scored.length ? Math.round((go / scored.length) * 100) : null,
    go,
    cond: scored.filter((report) => report.score >= 50 && report.score < 70).length,
    nogo: scored.filter((report) => report.score < 50).length,
    scoredCount: scored.length,
    unscoredCount: completed.length - scored.length,
  };
}

/* Numeric metrics exclude unscored reports, even when they have a qualitative verdict. */
function statsStrip(s) {
  const avgColor = scoreColor(s.avg);
  const unscoredClass = ' nash-overview__stat-unscored';
  const avg = s.avg == null ? 'Not scored' : `${s.avg}<span class="nash-overview-stat-unit">/100</span>`;
  const seg = (n, cls) => (n > 0 ? `<span class="nash-overview-seg ${cls}" style="flex:${n}"></span>` : '');
  return `
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num">${s.total}</div>
      <div class="nash-overview-stat-label">Assessments</div>
      <div class="nash-overview-stat-sub">${s.done} complete &middot; ${s.total - s.done} in progress</div>
    </div>
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num${s.avg == null ? unscoredClass : ''}" style="color:${avgColor}">${avg}</div>
      <div class="nash-overview-stat-label">Avg fit score</div>
      ${s.avg == null ? '' : `<div class="nash-overview-stat-bar" aria-hidden="true"><div style="width:${s.avg}%;background:${avgColor}"></div></div>`}
      <div class="nash-overview-stat-sub">${s.scoredCount} scored &middot; ${s.unscoredCount} not scored</div>
    </div>
    <div class="nash-overview-stat">
      <div class="nash-overview-stat-num${s.winRate == null ? unscoredClass : ''}">${s.winRate == null ? 'Not scored' : `${s.winRate}%`}</div>
      <div class="nash-overview-stat-label">Win rate</div>
      <div class="nash-overview-stat-sub">${s.go} of ${s.scoredCount} scored assessments rated Go</div>
    </div>
    <div class="nash-overview-stat nash-overview-stat-wide">
      <div class="nash-overview-stat-label">Score-based verdict mix</div>
      <div class="nash-overview-mixbar" role="img" aria-label="${s.go} Go, ${s.cond} Conditional, ${s.nogo} No-go, ${s.unscoredCount} not scored">${seg(s.go, 'go')}${seg(s.cond, 'cond')}${seg(s.nogo, 'nogo')}${seg(s.unscoredCount, 'unscored')}</div>
      <div class="nash-overview-mixlegend">
        <span class="go">${s.go} Go</span>
        <span class="cond">${s.cond} Conditional</span>
        <span class="nogo">${s.nogo} No-go</span>
        <span>${s.unscoredCount} Not scored</span>
      </div>
    </div>`;
}

export default async function decorate(block) {
  let reports = [];
  let usingMock = false;
  try {
    // Cache-bust: the listing must reflect a just-published/re-run assessment,
    // so bypass the browser cache on the query index.
    const resp = await fetch(`/qualifications/query.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      reports = (json.data || []).map(mapQueryRow);
    } else {
      reports = MOCK_REPORTS;
      usingMock = true;
    }
  } catch {
    reports = MOCK_REPORTS;
    usingMock = true;
  }

  // Merge locally-created assessments (newest first) ahead of published ones,
  // deduped by opportunity: keep the local (editable) copy and drop any published
  // doc for the same opp.
  const localRaw = listAssessments();
  const local = localRaw.map(mapLocalAssessment);
  const localPublishedSlugs = new Set(localRaw.map((a) => a.publishedSlug).filter(Boolean));
  const localLegacySlugs = new Set(localRaw
    .filter((a) => !a.publishedSlug)
    .map((a) => slugify(a.dr || a.opportunity || a.company)));
  // Drop published docs that are duplicates of a local copy, or that the user has
  // deleted/removed locally (so a lagging query index can't resurrect them).
  const publishedDeduped = reports.filter((r) => {
    const slug = (r.path || '').split('/').pop();
    return !localPublishedSlugs.has(slug)
      && !localLegacySlugs.has(slug)
      && !isHidden(r.key)
      && !isHidden(r.path);
  });
  reports = [...local, ...publishedDeduped];

  const stats = reportStats(reports);

  block.innerHTML = `
    <div class="nash-overview-head">
      <h1 class="nash-overview-title">All assessments</h1>
      <p class="nash-overview-subtitle">Every assessment across your Nash opportunities.</p>
      <p class="nash-overview-intro">Fit scores and qualitative verdicts across completed assessments. Unscored reports are excluded from score averages and win rate. Search or filter to find a deal, switch between grid and list, or open one to dive in.</p>
    </div>
    <div class="nash-overview-stats">
      ${statsStrip(stats)}
    </div>
    <div class="nash-overview-toolbar">
      <div class="nash-overview-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="nash-overview-search" type="search" placeholder="Search qualifications&#8230;" aria-label="Search qualifications"/>
      </div>
      <select class="nash-overview-filter" aria-label="Filter by status">
        <option value="all">Status: All (${reports.length})</option>
        <option value="draft">Draft (${stats.draft})</option>
        <option value="generating">Generating (${stats.gen})</option>
        <option value="done">Complete (${stats.done})</option>
      </select>
      <div class="nash-overview-toolbar-right">
        <button class="nash-overview-sort-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
          <span class="nash-overview-sort-label">Last updated</span>
        </button>
        <div class="nash-overview-view-toggle" role="group" aria-label="View layout">
          <button class="nash-overview-vt-btn active" data-layout="grid" type="button" aria-pressed="true" aria-label="Grid view">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button class="nash-overview-vt-btn" data-layout="list" type="button" aria-pressed="false" aria-label="List view">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="nash-overview-area" data-layout="grid">
      <div class="nash-overview-grid" aria-label="Qualification reports" role="list"></div>
      <div class="nash-overview-listwrap"></div>
      <div class="nash-overview-noresults" hidden>No qualifications match your search.</div>
      <div class="nash-overview-pagination"></div>
      ${reports.length === 0 ? `<div class="nash-overview-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No qualifications yet. Start a new analysis to get going.</p>
      </div>` : ''}
      ${usingMock ? '<div class="nash-overview-mock-banner" role="status">Preview mode — showing sample data.</div>' : ''}
    </div>
  `;

  // Client-side view model: filter + sort + paginate (20 per page).
  const PAGE_SIZE = 20;
  const state = {
    q: '', status: 'all', sort: 'updated', page: 1,
  };

  const view = () => {
    let list = reports.filter((r) => state.status === 'all' || r.status === state.status);
    if (state.q) {
      list = list.filter((r) => r.company.toLowerCase().includes(state.q)
        || (r.assessmentName || '').toLowerCase().includes(state.q)
        || (r.solutions || '').toLowerCase().includes(state.q));
    }
    const by = state.sort === 'score'
      ? (a, b) => {
        if (a.score == null) return b.score == null ? 0 : 1;
        if (b.score == null) return -1;
        return b.score - a.score;
      }
      : (a, b) => (b.ts || 0) - (a.ts || 0);
    return [...list].sort(by);
  };

  // Recompute the KPI strip + filter counts from the current `reports` set, so a
  // delete (or any change to the set) updates the totals — not just the grid.
  function refreshStats() {
    const nextStats = reportStats(reports);
    const strip = block.querySelector('.nash-overview-stats');
    if (strip) strip.innerHTML = statsStrip(nextStats);
    const optAll = block.querySelector('.nash-overview-filter option[value="all"]');
    const optDraft = block.querySelector('.nash-overview-filter option[value="draft"]');
    const optGen = block.querySelector('.nash-overview-filter option[value="generating"]');
    const optDone = block.querySelector('.nash-overview-filter option[value="done"]');
    if (optAll) optAll.textContent = `Status: All (${reports.length})`;
    if (optDraft) optDraft.textContent = `Draft (${nextStats.draft})`;
    if (optGen) optGen.textContent = `Generating (${nextStats.gen})`;
    if (optDone) optDone.textContent = `Complete (${nextStats.done})`;
  }

  function renderPage() {
    refreshStats();
    const list = view();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const startIdx = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(startIdx, startIdx + PAGE_SIZE);
    renderCards(block, pageItems);
    renderTable(block, pageItems);
    const noRes = block.querySelector('.nash-overview-noresults');
    if (noRes) noRes.hidden = list.length !== 0;

    const pag = block.querySelector('.nash-overview-pagination');
    if (!pag) return;
    if (pages <= 1) { pag.innerHTML = ''; return; }
    const to = Math.min(state.page * PAGE_SIZE, list.length);
    pag.innerHTML = `
      <span class="nash-overview-page-info">${startIdx + 1}–${to} of ${list.length}</span>
      <div class="nash-overview-page-btns">
        <button class="nash-overview-page-btn" data-nav="prev" type="button"${state.page <= 1 ? ' disabled' : ''}>&lsaquo; Prev</button>
        <span class="nash-overview-page-cur">Page ${state.page} of ${pages}</span>
        <button class="nash-overview-page-btn" data-nav="next" type="button"${state.page >= pages ? ' disabled' : ''}>Next &rsaquo;</button>
      </div>`;
    pag.querySelector('[data-nav="prev"]')?.addEventListener('click', () => { state.page -= 1; renderPage(); });
    pag.querySelector('[data-nav="next"]')?.addEventListener('click', () => { state.page += 1; renderPage(); });
  }

  renderPage();

  block.querySelector('.nash-overview-search').addEventListener('input', (e) => {
    state.q = e.target.value.toLowerCase();
    state.page = 1;
    renderPage();
  });

  block.querySelector('.nash-overview-filter').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    renderPage();
  });

  block.querySelector('.nash-overview-sort-btn')?.addEventListener('click', () => {
    state.sort = state.sort === 'updated' ? 'score' : 'updated';
    const label = block.querySelector('.nash-overview-sort-label');
    if (label) label.textContent = state.sort === 'score' ? 'Fit score' : 'Last updated';
    state.page = 1;
    renderPage();
  });

  // View toggle (grid ⇄ list table)
  block.querySelectorAll('.nash-overview-vt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      block.querySelectorAll('.nash-overview-vt-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      block.querySelector('.nash-overview-area').dataset.layout = btn.dataset.layout;
    });
  });

  // Close any open card menu when clicking elsewhere.
  document.addEventListener('click', () => {
    block.querySelectorAll('.nash-overview-cardmenu').forEach((m) => { m.hidden = true; });
  });

  // Re-render after a bookmark toggle (updates the star).
  document.addEventListener('nash:overview-refresh', () => renderPage());

  // Drop a deleted card from the in-memory list and re-render.
  document.addEventListener('nash:overview-remove', (e) => {
    const i = reports.findIndex((x) => String(x.id) === String(e.detail.id));
    if (i >= 0) reports.splice(i, 1);
    renderPage();
  });
}
