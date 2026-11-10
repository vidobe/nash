/**
 * nash-qualification block — published report page.
 *
 * The published /qualifications/{slug} page reconstructs the assessment from the
 * page (a base64 `nash-payload` meta tag written at publish time, with the report
 * body as a fallback) and renders it with the SAME interactive view as the in-app
 * session: the 3 tabs (Fluffy Assessment / DA content / Opp management), the
 * report, and Fluffy chat. One block powered by the other — no duplicate layout.
 *
 * @param {Element} block
 */

import { loadCSS } from '../../scripts/aem.js';
import { decodeAssessmentPayload } from '../../scripts/da-doc.js';
import { assessmentScore } from '../../scripts/nash-scoring.js';
import { renderAssessment } from '../nash-session/nash-session.js';

/* Decode the base64 (Unicode-safe) assessment payload embedded at publish time. */
function decodePayload() {
  const meta = document.querySelector('meta[name="nash-payload"]');
  return decodeAssessmentPayload(meta?.content);
}

/* Gather the report body from the sections below the block (fallback for pages
   published before payloads existed) and return the nodes to remove. */
function collectReportBody(block) {
  const blockSection = block.closest('.section') || block.parentElement;
  let sib = blockSection.nextElementSibling;
  const parts = [];
  const toRemove = [];
  while (sib) {
    const wraps = sib.querySelectorAll(':scope > .default-content-wrapper');
    if (wraps.length) wraps.forEach((w) => parts.push(w.innerHTML));
    else parts.push(sib.innerHTML);
    toRemove.push(sib);
    sib = sib.nextElementSibling;
  }
  return { html: parts.join(''), toRemove };
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const metaCells = rows.length ? [...rows[0].querySelectorAll(':scope > div')] : [];
  const cell = (i) => metaCells[i]?.textContent.trim() || '';
  const dimensions = rows.slice(1).map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')].map((c) => c.textContent.trim());
    return {
      dimension: cells[0] || '',
      weight: cells[1] || null,
      scored: cells[2] || null,
      max: cells[3] || null,
      notes: cells[4] || '',
    };
  });

  const payload = decodePayload();
  const scoringstatus = document.querySelector('meta[name="scoringstatus"]')?.content || '';
  const score = assessmentScore(payload ? {
    ...payload,
    scoringstatus: payload.scoringstatus || scoringstatus,
  } : { score: cell(2), dimensions, scoringstatus });
  const { html: reportHtml, toRemove } = collectReportBody(block);

  const assessment = payload ? {
    ...payload,
    id: payload.id || payload.company,
    published: true,
    company: payload.company,
    dr: payload.dr,
    fileName: payload.fileName,
    solutions: payload.solutions || [],
    solutionNames: payload.solutionNames,
    proposedSolution: payload.proposedSolution,
    score,
    scoringstatus: score === null ? 'not-calibrated' : 'scored',
    verdict: payload.verdict,
    cms: payload.cms,
    context: payload.context || {},
    dimensions: payload.dimensions || [],
    evidence: payload.evidence || [],
    confidence: payload.confidence || [],
    assessmentView: payload.assessmentView || null,
    reportMarkdown: payload.reportMarkdown || '',
    reportHtml,
    opp: payload.opp || {},
    messages: [],
  } : {
    id: cell(0),
    published: true,
    company: cell(0),
    dr: '',
    fileName: '',
    solutions: [],
    solutionNames: cell(1),
    proposedSolution: cell(6),
    score,
    scoringstatus: score === null ? 'not-calibrated' : 'scored',
    verdict: cell(3),
    dimensions,
    cms: document.querySelector('meta[name="cms"]')?.content || '',
    reportHtml,
    opp: {},
    messages: [],
  };

  // This page IS the published/live document.
  assessment.publishedUrl = window.location.href;

  // Remove the now-duplicated static body; render the interactive session view.
  toRemove.forEach((s) => s.remove());
  // Load the session styles before revealing the view (the block is hidden via
  // CSS until it gets the `nash-session` class) to avoid an unstyled flash.
  await loadCSS(`${window.hlx.codeBasePath}/blocks/nash-session/nash-session.css`);
  block.classList.add('nash-session');
  renderAssessment(block, assessment);
}
