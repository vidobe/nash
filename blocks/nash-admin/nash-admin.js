/*
 * nash-admin block — admin-only usage dashboard.
 *
 * Client-gated to the admin email (the underlying data is auth-gated in DA, and
 * the read endpoint also verifies admin server-side). Shows who has signed in,
 * how many, and assessments run per user (tracked runs + published qualifications).
 */

import { getUserInfo } from '../../scripts/nash-auth.js';
import { fetchActivitySummary } from '../../scripts/nash-activity.js';

const ADMIN = 'vgabriel@adobe.com';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function relTime(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default async function decorate(block) {
  const me = (getUserInfo()?.email || '').toLowerCase();
  if (me !== ADMIN) {
    block.innerHTML = '<div class="nash-admin-denied">This page is available to the Nash admin only.</div>';
    return;
  }

  block.innerHTML = '<div class="nash-admin-loading">Loading usage…</div>';

  let summary = { users: {} };
  try { summary = await fetchActivitySummary(); } catch { summary = { users: {} }; }

  let pub = [];
  try {
    const r = await fetch('/qualifications/query.json');
    if (r.ok) pub = (await r.json()).data || [];
  } catch { pub = []; }

  const pubByUser = {};
  pub.forEach((row) => {
    const u = (row.user || '').toLowerCase();
    if (u) pubByUser[u] = (pubByUser[u] || 0) + 1;
  });

  const users = summary.users || {};
  const emails = new Set([...Object.keys(users), ...Object.keys(pubByUser)]);
  const rows = [...emails].map((k) => {
    const s = users[k] || {};
    return {
      email: s.email || k,
      logins: s.logins || 0,
      assessments: s.assessments || 0,
      published: pubByUser[k] || 0,
      lastSeen: s.lastSeen || '',
    };
  }).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));

  const totalUsers = rows.length;
  const totalLogins = rows.reduce((n, r) => n + r.logins, 0);
  const totalAssessments = rows.reduce((n, r) => n + Math.max(r.assessments, r.published), 0);

  const tile = (num, label) => `<div class="nash-admin-tile"><div class="nash-admin-num">${num}</div><div class="nash-admin-lbl">${label}</div></div>`;

  const tableRows = rows.length
    ? rows.map((r) => `<tr>
        <td class="nash-admin-user">${esc(r.email)}</td>
        <td>${r.logins}</td>
        <td>${Math.max(r.assessments, r.published)}</td>
        <td>${r.published}</td>
        <td class="nash-admin-muted">${relTime(r.lastSeen)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="nash-admin-muted">No activity recorded yet.</td></tr>';

  block.innerHTML = `
    <div class="nash-admin">
      <div class="nash-admin-head">
        <h1 class="nash-admin-title">Usage</h1>
        <p class="nash-admin-sub">Who's using Nash — logins and assessments. Admin only.</p>
      </div>
      <div class="nash-admin-tiles">
        ${tile(totalUsers, 'Users signed in')}
        ${tile(totalLogins, 'Total logins')}
        ${tile(totalAssessments, 'Assessments run')}
      </div>
      <table class="nash-admin-table">
        <thead><tr><th>User</th><th>Logins</th><th>Assessments</th><th>Published</th><th>Last seen</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}
