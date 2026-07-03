/*
 * Client for the Nash → DA publish Worker (see tools/da-publish/).
 * Sends a completed assessment + the signed-in user's Okta token to the Worker,
 * which writes the page to DA and publishes it under /qualifications/{slug}.
 *
 * After deploying the Worker, set WORKER_URL to its URL and push.
 */

import { ensureFreshToken } from './nash-auth.js';
import { buildDaDocument, slugify } from './da-doc.js';

// TODO: set to your deployed Worker URL, e.g.
// 'https://nash-da-publish.example.workers.dev'
const WORKER_URL = '';

export { slugify };

/** True when a publish endpoint has been configured. */
export function isPublishConfigured() {
  return WORKER_URL.startsWith('http');
}

/**
 * Builds the full DA document for an assessment (without writing it). Exposed so
 * the doc can be generated/previewed independently of publishing.
 * @param {object} a the assessment
 * @param {string} bodyHtml the rendered report body
 * @param {string} [user] author email for the `user` metadata
 * @returns {{ slug:string, html:string }}
 */
export function buildAssessmentDoc(a, bodyHtml, user = '') {
  return { slug: slugify(a.company), html: buildDaDocument(a, bodyHtml, user) };
}

/**
 * Publishes an assessment to DA via the Worker.
 * @param {object} a the assessment
 * @param {string} bodyHtml the rendered report HTML for the page body
 * @param {string} [user] the author email, for the `user` metadata
 * @returns {Promise<{path:string, url:string, previewUrl:string}>}
 */
export async function publishAssessment(a, bodyHtml, user = '') {
  if (!isPublishConfigured()) {
    throw new Error('Publishing isn’t set up yet — deploy the Worker in tools/da-publish/ and set WORKER_URL in scripts/da-publish.js.');
  }
  const token = await ensureFreshToken();
  if (!token) throw new Error('Sign in to Nash before publishing.');

  const { slug, html } = buildAssessmentDoc(a, bodyHtml, user);
  const res = await fetch(`${WORKER_URL}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, html }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j.error || j.detail || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Publish failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}
