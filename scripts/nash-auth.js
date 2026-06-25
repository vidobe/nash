/*
 * Nash ↔ FluffyJaws authentication — Okta OIDC Authorization Code + PKCE.
 *
 * Native SPA flow: no client secret. On success a user access token (with the
 * `fluffyjaws` scope) is stored in localStorage under `nash-fj-auth` as
 * { accessToken, refreshToken, expires } — the shape fluffyjaws.js reads.
 *
 * Okta app: Nash - RFx (client 0oa27mhgovt1K0ZsR0h8).
 */

const CONFIG = {
  clientId: '0oa27mhgovt1K0ZsR0h8',
  issuer: 'https://adobe.okta.com/oauth2/aus1gan31wnmCPyB60h8',
  scopes: 'openid profile email offline_access fluffyjaws',
  get redirectUri() { return `${window.location.origin}/`; },
};

const TOKEN_KEY = 'nash-fj-auth';
const PKCE_KEY = 'nash-fj-pkce';

function base64url(bytes) {
  let str = '';
  new Uint8Array(bytes).forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64url(arr).slice(0, len);
}

async function sha256(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
}

function read() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

function store(data) {
  const prev = read() || {};
  const payload = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || prev.refreshToken || null,
    expires: Date.now() + ((data.expires_in || 3600) - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(payload));
  document.dispatchEvent(new CustomEvent('nash:auth-changed', { bubbles: true }));
}

/** True when a non-expired FluffyJaws token is present. */
export function isAuthenticated() {
  const a = read();
  return !!(a && a.accessToken && Date.now() < a.expires);
}

/** Begin the PKCE login — redirects to Okta. */
export async function login() {
  const verifier = randomString(64);
  const challenge = base64url(await sha256(verifier));
  const state = randomString(24);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    response_type: 'code',
    response_mode: 'query',
    scope: CONFIG.scopes,
    redirect_uri: CONFIG.redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `${CONFIG.issuer}/v1/authorize?${params.toString()}`;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  document.dispatchEvent(new CustomEvent('nash:auth-changed', { bubbles: true }));
}

/**
 * Completes the login if the page was opened with ?code=… from Okta.
 * Returns true if a token was exchanged. Call this once on page load.
 */
export async function handleRedirectCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return false;

  let pkce = null;
  try { pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch { pkce = null; }
  if (!pkce || pkce.state !== state) return false;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    code,
    code_verifier: pkce.verifier,
  });

  try {
    const resp = await fetch(`${CONFIG.issuer}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) return false;
    store(await resp.json());
  } catch {
    return false;
  } finally {
    sessionStorage.removeItem(PKCE_KEY);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('iss');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return true;
}

/** Returns a valid access token, refreshing if needed; null if not logged in. */
export async function ensureFreshToken() {
  const a = read();
  if (!a || !a.accessToken) return null;
  if (Date.now() < a.expires) return a.accessToken;
  if (!a.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CONFIG.clientId,
    refresh_token: a.refreshToken,
    scope: CONFIG.scopes,
  });
  try {
    const resp = await fetch(`${CONFIG.issuer}/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    store(data);
    return data.access_token;
  } catch {
    return null;
  }
}
