/*
 * Nash → DA publish — Adobe App Builder (I/O Runtime) web action.
 *
 * Same job as the Cloudflare Worker: receives a completed assessment from the
 * Nash browser app, writes it as an EDS page under /qualifications/{slug} in DA,
 * then previews + publishes it.
 *
 * Auth:
 *  - The browser forwards its Okta (FluffyJaws) access token; we validate it via
 *    Okta /userinfo. Only a valid Adobe user can publish; we use their email for
 *    the page's `user` metadata.
 *  - Everything server-side runs on a SERVICE token minted from IMS client
 *    credentials (IMS_CLIENT_ID/IMS_CLIENT_SECRET/IMS_SCOPES). It writes DA
 *    directly, and is forwarded to DA for the preview/publish content read via
 *    the `x-content-source-authorization` header (caller auth = AEM_API_KEY site
 *    key). Nothing here expires or needs refreshing. DA_TOKEN is a manual
 *    fallback only. All are action inputs (set via .env → app.config.yaml).
 *
 * Runtime: Node 18 (global fetch / FormData / Blob).
 */

// NOTE: the I/O Runtime already adds `Access-Control-Allow-Origin: *` (and the
// default allow-headers incl. Authorization) to web-action responses. We must
// NOT set our own CORS headers or the browser sees two ACAO values and rejects.
// The real access gate is the Okta token check below.
function reply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let cachedToken = null;

async function serviceToken(params) {
  // Mint an S2S (client_credentials) token for the technical account. This token
  // both writes DA (Authorization) and — critically — is forwarded to DA for the
  // preview/publish content read via `x-content-source-authorization`, so the
  // whole flow runs on service credentials with nothing to refresh. DA_TOKEN is
  // only a manual fallback if IMS creds aren't configured.
  if (params.IMS_CLIENT_ID && params.IMS_CLIENT_SECRET) {
    const now = Date.now();
    if (cachedToken && cachedToken.exp > now + 60000) return cachedToken.token;
    const res = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: params.IMS_CLIENT_ID,
        client_secret: params.IMS_CLIENT_SECRET,
        scope: params.IMS_SCOPES || 'AdobeID,openid,read_organizations',
      }),
    });
    if (!res.ok) throw new Error(`IMS token request failed (${res.status})`);
    const j = await res.json();
    cachedToken = { token: j.access_token, exp: now + (j.expires_in * 1000) };
    return cachedToken.token;
  }
  if (params.DA_TOKEN) return params.DA_TOKEN;
  throw new Error('No service credentials configured (set IMS_CLIENT_* or DA_TOKEN).');
}

async function validateUser(auth, params) {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const res = await fetch(`${params.OKTA_ISSUER}/v1/userinfo`, { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const info = await res.json();
  return info.email || info.preferred_username || info.sub || 'unknown';
}

// Fallback document shell if the client sends only a legacy bodyHtml payload.
function buildPage(p, user) {
  const kv = (k, v) => `<div><div>${esc(k)}</div><div>${esc(v)}</div></div>`;
  const metadata = `<div class="metadata">${
    kv('Title', p.title) + kv('status', 'done') + kv('score', p.score)
    + kv('cms', p.cms) + kv('verdict', p.verdict) + kv('user', user)
    + kv('description', p.description)
  }</div>`;
  return `<body><header></header><main><div>${p.bodyHtml || ''}</div>`
    + `<div>${metadata}</div></main><footer></footer></body>`;
}

async function main(params) {
  const headers = params.__ow_headers || {};
  const method = (params.__ow_method || 'post').toLowerCase();

  if (method === 'options') return { statusCode: 204 };
  if (method !== 'post') return reply(405, { error: 'Method not allowed' });

  try {
    const user = await validateUser(headers.authorization, params);
    if (!user) return reply(401, { error: 'Unauthorized — sign in to Nash first.' });

    // Activity tracking. A single private summary doc (activity/summary.json) holds
    // per-user login/assessment counts. `activity:'log'` increments; `activity:'read'`
    // (admin only) returns the summary for the admin page. No slug needed.
    if (params.activity === 'log' || params.activity === 'read') {
      const token = await serviceToken(params);
      const org = params.ORG;
      const repo = params.REPO;
      const daHdr = { Authorization: `Bearer ${token}` };
      const summaryUrl = `https://admin.da.live/source/${org}/${repo}/activity/summary.json`;
      const load = async () => {
        const r = await fetch(summaryUrl, { headers: daHdr });
        if (!r.ok) return { users: {} };
        try { return JSON.parse(await r.text()) || { users: {} }; } catch { return { users: {} }; }
      };
      const adminEmail = (params.ADMIN_EMAIL || 'vgabriel@adobe.com').toLowerCase();
      if (params.activity === 'read') {
        if (user.toLowerCase() !== adminEmail) return reply(403, { error: 'Admins only.' });
        return reply(200, { ok: true, summary: await load() });
      }
      const field = params.type === 'assessment' ? 'assessments' : 'logins';
      const summary = await load();
      summary.users = summary.users || {};
      const key = user.toLowerCase();
      const now = new Date().toISOString();
      const u = summary.users[key] || { email: user, logins: 0, assessments: 0, firstSeen: now };
      u[field] = (u[field] || 0) + 1;
      u.lastSeen = now;
      u.email = user;
      summary.users[key] = u;
      summary.updatedAt = now;
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify(summary)], { type: 'application/json' }), 'summary.json');
      const w = await fetch(summaryUrl, { method: 'PUT', headers: daHdr, body: fd });
      if (!w.ok) return reply(502, { error: `Activity write failed (${w.status})`, detail: await w.text() });
      return reply(200, { ok: true });
    }

    const slug = String(params.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
    if (!slug) return reply(400, { error: 'Missing or invalid slug.' });

    // Target folder (default qualifications). `publish:false` writes the DA source
    // only and skips preview/publish — used for private content such as feedback,
    // which must never reach the public .aem.live site.
    const folder = String(params.folder || 'qualifications').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'qualifications';
    const doPublish = params.publish !== false;

    const html = params.html || buildPage(params, user);
    const token = await serviceToken(params);
    const org = params.ORG;
    const repo = params.REPO;
    // DA source writes authenticate with the service token directly. AEM admin
    // (preview/publish) authenticates the *caller* with the site API key, and
    // carries the service token in `x-content-source-authorization` so EDS can
    // forward it to DA and read the source content. This is what lets the whole
    // flow run on service credentials with nothing to refresh.
    const daHdr = { Authorization: `Bearer ${token}` };
    const aemHdr = {
      'X-Auth-Token': params.AEM_API_KEY,
      'x-content-source-authorization': `Bearer ${token}`,
    };

    // Delete mode: remove a published doc from DA (source + preview + live).
    // Permission: the ADMIN may delete anything; anyone else only their own,
    // verified against the doc's `user` metadata read back from DA.
    if (params.delete === true) {
      const path = `${folder}/${slug}`;
      const adminEmail = (params.ADMIN_EMAIL || 'vgabriel@adobe.com').toLowerCase();
      if (user.toLowerCase() !== adminEmail) {
        const srcRes = await fetch(`https://admin.da.live/source/${org}/${repo}/${path}.html`, { headers: daHdr });
        const srcHtml = srcRes.ok ? await srcRes.text() : '';
        const m = srcHtml.match(/>\s*user\s*<\/div>\s*<div>\s*([^<]*?)\s*<\/div>/i);
        const owner = (m ? m[1] : '').toLowerCase();
        if (owner && owner !== user.toLowerCase()) {
          return reply(403, { error: 'You can only delete assessments you created.' });
        }
      }
      await fetch(`https://admin.hlx.page/live/${org}/${repo}/main/${path}`, { method: 'DELETE', headers: aemHdr });
      await fetch(`https://admin.hlx.page/preview/${org}/${repo}/main/${path}`, { method: 'DELETE', headers: aemHdr });
      const daDel = await fetch(`https://admin.da.live/source/${org}/${repo}/${path}.html`, { method: 'DELETE', headers: daHdr });
      if (!daDel.ok && daDel.status !== 404) {
        return reply(502, { error: `DA delete failed (${daDel.status})`, detail: await daDel.text() });
      }
      return reply(200, { ok: true, deleted: `/${path}` });
    }

    // 0) Unpublish a stale doc if this opportunity moved to a new slug.
    const old = String(params.unpublish || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (doPublish && old && old !== slug) {
      const oldPath = `${folder}/${old}`;
      await fetch(`https://admin.hlx.page/live/${org}/${repo}/main/${oldPath}`, { method: 'DELETE', headers: aemHdr });
      await fetch(`https://admin.hlx.page/preview/${org}/${repo}/main/${oldPath}`, { method: 'DELETE', headers: aemHdr });
      await fetch(`https://admin.da.live/source/${org}/${repo}/${oldPath}.html`, { method: 'DELETE', headers: daHdr });
    }

    // 1) Write the source document to DA.
    const fd = new FormData();
    fd.append('data', new Blob([html], { type: 'text/html' }), `${slug}.html`);
    const daRes = await fetch(
      `https://admin.da.live/source/${org}/${repo}/${folder}/${slug}.html`,
      { method: 'PUT', headers: daHdr, body: fd },
    );
    if (!daRes.ok) {
      return reply(502, { error: `DA write failed (${daRes.status})`, detail: await daRes.text() });
    }

    // Private content (e.g. feedback): stored in DA source only, never published.
    if (!doPublish) {
      return reply(200, { ok: true, slug, path: `/${folder}/${slug}`, published: false });
    }

    // 2) Preview, then publish. Both must succeed — a failed preview means the
    //    page never rendered, so we surface it instead of reporting false success.
    const path = `${folder}/${slug}`;
    const prev = await fetch(`https://admin.hlx.page/preview/${org}/${repo}/main/${path}`, { method: 'POST', headers: aemHdr });
    if (!prev.ok) {
      return reply(502, {
        error: `Preview failed (${prev.status})`,
        detail: prev.headers.get('x-error') || await prev.text(),
      });
    }
    const live = await fetch(`https://admin.hlx.page/live/${org}/${repo}/main/${path}`, { method: 'POST', headers: aemHdr });
    if (!live.ok) {
      return reply(502, {
        error: `Publish failed (${live.status})`,
        detail: live.headers.get('x-error') || await live.text(),
      });
    }

    // 3) Nudge the query index so the new page appears in listings immediately
    //    (publish alone doesn't always regenerate query.json right away).
    await fetch(`https://admin.hlx.page/index/${org}/${repo}/main/${path}`, { method: 'POST', headers: aemHdr });

    return reply(200, {
      ok: true,
      slug,
      path: `/${path}`,
      previewUrl: `https://main--${repo}--${org}.aem.page/${path}`,
      url: `https://main--${repo}--${org}.aem.live/${path}`,
      preview: prev.status,
      publish: live.status,
    });
  } catch (e) {
    return reply(500, { error: e.message });
  }
}

exports.main = main;
