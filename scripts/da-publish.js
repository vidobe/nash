/*
 * Client for the Nash → DA publish endpoint.
 * Sends a completed assessment + the signed-in user's Okta token to the endpoint,
 * which writes the page to DA and publishes it under /qualifications/{slug}.
 *
 * The endpoint is either the Adobe App Builder action (tools/da-publish-app/) or
 * the Cloudflare Worker (tools/da-publish/). After deploying, set PUBLISH_ENDPOINT
 * to the FULL publish URL and push.
 */

import { ensureFreshToken } from './nash-auth.js';
import { buildDaDocument, slugify } from './da-doc.js';
import { isCanonicalAssessment, validateAssessmentView } from './nash-assessment-contract.js';

// Adobe App Builder action (tools/da-publish-app/), Stage workspace.
export const PUBLISH_ENDPOINT = 'https://97154-nashdapublish-stage.adobeioruntime.net/api/v1/web/nash-da-publish/publish';

export { slugify };

/** True when a publish endpoint has been configured. */
export function isPublishConfigured() {
  return PUBLISH_ENDPOINT.startsWith('http');
}

/**
 * Stable DA slug for an assessment. The opportunity remains the grouping key,
 * while the assessment id prevents later assessments from overwriting earlier ones.
 */
export function assessmentSlug(a) {
  const opportunity = slugify(a.dr || a.opportunity || a.company);
  const assessment = slugify(a.id || a.assessmentName || a.fileName);
  return `${opportunity}-${assessment}`;
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
  if (isCanonicalAssessment(a.assessmentView)) {
    const requirements = a.assessmentView.inputCoverage?.requirementIds?.map((id) => ({
      id, priority: a.assessmentView.requirements.find((row) => row.id === id)?.priority,
    })) || [];
    const errors = validateAssessmentView(a.assessmentView, { requirements });
    if (a.status !== 'done' || errors.length) {
      throw new Error(`Only a completed, validated assessment can be published. ${errors.slice(0, 3).join(' ')}`);
    }
  }
  const publishable = { ...a };
  delete publishable.generationCheckpoint;
  delete publishable.experimentalGenerationCheckpoint;
  return { slug: assessmentSlug(a), html: buildDaDocument(publishable, bodyHtml, user) };
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
    throw new Error('Publishing isn’t set up yet — deploy the publish action (tools/da-publish-app/) and set PUBLISH_ENDPOINT in scripts/da-publish.js.');
  }
  const token = await ensureFreshToken();
  if (!token) throw new Error('Sign in to Nash before publishing.');

  const { slug, html } = buildAssessmentDoc(a, bodyHtml, user);
  const payload = { slug, html };
  // If this assessment was previously published under a different slug, tell the
  // action to unpublish the stale doc so we don't leave duplicates.
  if (a.publishedSlug && a.publishedSlug !== slug) payload.unpublish = a.publishedSlug;

  const res = await fetch(PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const data = await res.json();
  return { ...data, slug };
}

/**
 * Deletes a published assessment from DA (unpublishes source + preview + live).
 * The action enforces owner/admin permission server-side.
 * @param {string} slug the qualification slug
 * @returns {Promise<object>}
 */
export async function unpublishAssessment(slug) {
  if (!isPublishConfigured()) throw new Error('Publishing isn’t set up yet.');
  const token = await ensureFreshToken();
  if (!token) throw new Error('Sign in to Nash before deleting.');
  const res = await fetch(PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: true, folder: 'qualifications', slug }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`Delete failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}
