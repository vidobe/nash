/*
 * Nash feedback → DA. Each comment becomes a private DA source document under
 * /feedback/ (comment + email + timestamp). It is written to DA source only —
 * NOT published to the public site — so emails stay private. Read them back in
 * the DA UI at da.live/#/{org}/{repo}/feedback.
 *
 * Reuses the DA publish action (tools/da-publish-app/) with `folder: 'feedback'`
 * and `publish: false`, forwarding the signed-in user's Okta token.
 */

import { ensureFreshToken } from './nash-auth.js';
import { PUBLISH_ENDPOINT } from './da-publish.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* A minimal EDS/DA document for one piece of feedback. */
function buildFeedbackDoc({ comment, email, when }) {
  const kv = (k, v) => `<div><div>${esc(k)}</div><div>${esc(v)}</div></div>`;
  const metadata = `<div class="metadata">${
    kv('Title', `Feedback from ${email || 'anonymous'}`)
    + kv('email', email || '')
    + kv('date', when.toISOString())
  }</div>`;
  const body = '<h1>Feedback</h1>'
    + `<p><strong>From:</strong> ${esc(email || 'anonymous')}</p>`
    + `<p><strong>When:</strong> ${esc(when.toLocaleString())}</p>`
    + `<blockquote>${esc(comment).replace(/\n/g, '<br>')}</blockquote>`;
  return `<body><header></header><main><div>${body}</div><div>${metadata}</div></main><footer></footer></body>`;
}

/**
 * Send a feedback comment. Writes one DA source doc under /feedback/.
 * @param {{ comment:string, email?:string }} input
 * @returns {Promise<{ ok:boolean, path:string }>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function submitFeedback({ comment, email = '' }) {
  const text = (comment || '').trim();
  if (!text) throw new Error('Please enter a comment.');
  const token = await ensureFreshToken();
  if (!token) throw new Error('Sign in to Nash before sending feedback.');

  const when = new Date();
  const stamp = when.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 7);
  const slug = `fb-${stamp}-${rand}`;
  const html = buildFeedbackDoc({ comment: text, email, when });

  const res = await fetch(PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: 'feedback', slug, html, publish: false,
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`Couldn’t send feedback (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}
