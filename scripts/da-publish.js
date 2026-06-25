/*
 * Client for the Nash → DA publish Worker (see tools/da-publish/).
 * Sends a completed assessment + the signed-in user's Okta token to the Worker,
 * which writes the page to DA and publishes it under /qualifications/{slug}.
 *
 * After deploying the Worker, set WORKER_URL to its URL and push.
 */

import { ensureFreshToken } from './nash-auth.js';

// TODO: set to your deployed Worker URL, e.g.
// 'https://nash-da-publish.example.workers.dev'
const WORKER_URL = '';

/** kebab-case slug from a company name, safe for a DA path. */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'assessment';
}

/** True when a publish endpoint has been configured. */
export function isPublishConfigured() {
  return WORKER_URL.startsWith('http');
}

/**
 * Publishes an assessment to DA via the Worker.
 * @param {object} a the assessment ({ company, dr, score, cms, verdict })
 * @param {string} bodyHtml the rendered report HTML for the page body
 * @returns {Promise<{path:string, url:string, previewUrl:string}>}
 */
export async function publishAssessment(a, bodyHtml) {
  if (!isPublishConfigured()) {
    throw new Error('Publishing isn’t set up yet — deploy the Worker in tools/da-publish/ and set WORKER_URL in scripts/da-publish.js.');
  }
  const token = await ensureFreshToken();
  if (!token) throw new Error('Sign in to Nash before publishing.');

  const res = await fetch(`${WORKER_URL}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: slugify(a.company),
      title: a.company,
      description: a.dr || a.company,
      score: a.score ?? '',
      cms: a.cms || 'n/a',
      verdict: a.verdict || '',
      bodyHtml,
    }),
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
