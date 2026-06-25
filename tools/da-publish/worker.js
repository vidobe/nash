/*
 * Cloudflare Worker — Nash → DA publish proxy.
 *
 * Receives a completed assessment from the Nash browser app, writes it as an EDS
 * page under /qualifications/{slug} in DA, then previews + publishes it so it
 * appears in /qualifications/query.json (Overview + sidebar) for the whole team.
 *
 * Auth model:
 *  - The browser forwards its Okta (FluffyJaws) access token. We validate it via
 *    Okta /userinfo; only a valid Adobe user can publish, and we use their email
 *    for the page's `user` metadata.
 *  - DA writes + AEM publish use a SERVICE token held only by the Worker (never
 *    exposed to the browser): minted from IMS client credentials
 *    (IMS_CLIENT_ID/IMS_CLIENT_SECRET/IMS_SCOPES), or a static DA_TOKEN secret.
 *
 * See README.md for required vars/secrets and deploy steps.
 */

const ALLOW_SUFFIXES = ['--nash--vidobe.aem.page', '--nash--vidobe.aem.live'];

function corsHeaders(origin) {
  let ok = false;
  try {
    ok = !!origin && ALLOW_SUFFIXES.some((s) => new URL(origin).host.endsWith(s));
  } catch {
    ok = false;
  }
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// In-isolate cache for the minted IMS service token.
let cachedToken = null;

async function serviceToken(env) {
  if (env.IMS_CLIENT_ID && env.IMS_CLIENT_SECRET) {
    const now = Date.now();
    if (cachedToken && cachedToken.exp > now + 60000) return cachedToken.token;
    const res = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.IMS_CLIENT_ID,
        client_secret: env.IMS_CLIENT_SECRET,
        scope: env.IMS_SCOPES || 'AdobeID,openid,read_organizations',
      }),
    });
    if (!res.ok) throw new Error(`IMS token request failed (${res.status})`);
    const j = await res.json();
    cachedToken = { token: j.access_token, exp: now + (j.expires_in * 1000) };
    return cachedToken.token;
  }
  if (env.DA_TOKEN) return env.DA_TOKEN;
  throw new Error('No service credentials configured (set IMS_CLIENT_* or DA_TOKEN).');
}

// Validate the forwarded user token and return the user's email (or null).
async function validateUser(req, env) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.OKTA_ISSUER}/v1/userinfo`, { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const info = await res.json();
  return info.email || info.preferred_username || info.sub || 'unknown';
}

// Wrap the report body + metadata into the DA/EDS document shell.
function buildPage({
  title, description, score, cms, verdict, user, bodyHtml,
}) {
  const cell = (k, v) => `<div><div>${esc(k)}</div><div>${esc(v)}</div></div>`;
  const metadata = `<div class="metadata">${
    cell('Title', title)
    + cell('status', 'done')
    + cell('score', score)
    + cell('cms', cms)
    + cell('verdict', verdict)
    + cell('user', user)
    + cell('description', description)
  }</div>`;
  return `<body><header></header><main><div>${bodyHtml || ''}</div>`
    + `<div>${metadata}</div></main><footer></footer></body>`;
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    try {
      const user = await validateUser(req, env);
      if (!user) return json({ error: 'Unauthorized — sign in to Nash first.' }, 401, cors);

      const p = await req.json();
      const slug = String(p.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
      if (!slug) return json({ error: 'Missing or invalid slug.' }, 400, cors);

      const html = buildPage({ ...p, user });
      const token = await serviceToken(env);
      const org = env.ORG;
      const repo = env.REPO;

      // 1) Write the source document to DA.
      const fd = new FormData();
      fd.append('data', new Blob([html], { type: 'text/html' }), `${slug}.html`);
      const daRes = await fetch(
        `https://admin.da.live/source/${org}/${repo}/qualifications/${slug}.html`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: fd },
      );
      if (!daRes.ok) {
        return json({ error: `DA write failed (${daRes.status})`, detail: await daRes.text() }, 502, cors);
      }

      // 2) Preview + publish so the index regenerates.
      const path = `qualifications/${slug}`;
      const prev = await fetch(
        `https://admin.hlx.page/preview/${org}/${repo}/main/${path}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      const live = await fetch(
        `https://admin.hlx.page/live/${org}/${repo}/main/${path}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );

      return json({
        ok: true,
        path: `/${path}`,
        previewUrl: `https://main--${repo}--${org}.aem.page/${path}`,
        url: `https://main--${repo}--${org}.aem.live/${path}`,
        preview: prev.status,
        publish: live.status,
      }, 200, cors);
    } catch (e) {
      return json({ error: e.message }, 500, cors);
    }
  },
};
