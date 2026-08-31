/*
 * Nash usage tracking. Logs a login (once per browser session) and each
 * completed assessment to a private per-user summary in DA, via the publish
 * action. The admin page reads the aggregated summary back (admin only).
 */

import { ensureFreshToken } from './nash-auth.js';
import { PUBLISH_ENDPOINT } from './da-publish.js';

async function post(body) {
  const token = await ensureFreshToken();
  if (!token) return null;
  const res = await fetch(PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Activity request failed (${res.status})`);
  return res.json();
}

/**
 * Record a usage event. 'login' is de-duplicated to once per browser session.
 * Fire-and-forget: failures are swallowed so tracking never blocks the app.
 * @param {'login'|'assessment'} type
 */
export async function logActivity(type) {
  try {
    if (type === 'login') {
      if (sessionStorage.getItem('nash-logged-session')) return;
      sessionStorage.setItem('nash-logged-session', '1');
    }
    await post({ activity: 'log', type });
  } catch {
    // usage tracking is best-effort; never surface errors
  }
}

/**
 * Admin-only: fetch the aggregated usage summary.
 * @returns {Promise<{users:Object, updatedAt?:string}>}
 */
export async function fetchActivitySummary() {
  const data = await post({ activity: 'read' });
  return data?.summary || { users: {} };
}
