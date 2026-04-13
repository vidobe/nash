/**
 * nash-login block
 * Two-mode auth: sign-in and create-account.
 * Passwords are SHA-256 hashed client-side before any network call.
 * Credentials stored in DA spreadsheet at /config/auth (columns: email, password, name, created).
 * Login reads from /config/auth.json (published DA sheet).
 * Registration writes via POST /api/auth (Cloudflare Worker).
 * Session lasts 8 hours, stored in localStorage under 'nash-auth'.
 * @param {Element} block
 */

const SESSION_KEY = 'nash-auth';
const SESSION_HOURS = 8;

export function isAuthenticated() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return auth && Date.now() < auth.expires;
  } catch {
    return false;
  }
}

export function clearAuth() {
  localStorage.removeItem(SESSION_KEY);
}

async function sha256(str) {
  const bytes = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function storeSession(email, name) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    expires: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    email,
    name: name || email.split('@')[0],
  }));
}

async function readAuthSheet() {
  const resp = await fetch('/config/auth.json');
  if (!resp.ok) throw new Error('sheet_unavailable');
  const json = await resp.json();
  return json.data || [];
}

async function callAuthApi(payload) {
  const resp = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      reason: body.reason || `http_${resp.status}`,
    };
  }
  return { ok: true, ...body };
}

async function doLogin(email, password) {
  const hash = await sha256(password);
  // Try API worker first
  try {
    const result = await callAuthApi({ action: 'login', email, hash });
    const workerUnavailable = result.reason === 'http_404' || result.reason === 'http_500';
    if (!workerUnavailable) return result;
  } catch { /* worker not available, fall through to direct sheet read */ }
  // Fallback: read published DA sheet directly
  const rows = await readAuthSheet();
  const row = rows.find((r) => r.email && r.email.toLowerCase() === email.toLowerCase());
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.password !== hash) return { ok: false, reason: 'wrong_password' };
  return { ok: true, name: row.name || '' };
}

async function doRegister(email, password, name) {
  const hash = await sha256(password);
  return callAuthApi({
    action: 'register',
    email,
    hash,
    name,
    created: new Date().toISOString().split('T')[0],
  });
}

function logoSvg() {
  const attrs = 'width="28" height="28" viewBox="0 0 20 20" '
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  return `<svg ${attrs}>`
    + '<rect width="20" height="20" rx="3" fill="#eb1000"/>'
    + '<polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>'
    + '</svg>';
}

const LOGIN_ERRORS = {
  not_found: 'No account found with that email. Need to create one?',
  wrong_password: 'Incorrect password. Please try again.',
  sheet_unavailable: 'Could not reach the auth service. Try again shortly.',
  default: 'Something went wrong. Please try again.',
};

const REGISTER_ERRORS = {
  email_taken: 'An account with that email already exists.',
  http_404: 'Registration is not available yet. Ask your team admin to add you.',
  default: 'Could not create your account. Please try again.',
};

function getMsg(map, reason) {
  return map[reason] || map.default;
}

function setError(errorEl, btn, defaultLabel, msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  btn.disabled = false;
  btn.textContent = defaultLabel;
}

function renderSignIn(block, switchFn) {
  const logo = logoSvg();
  block.innerHTML = `
    <div class="nash-login-shell">
      <div class="nash-login-card" data-mode="signin">
        <div class="nash-login-brand">
          ${logo}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-title">Welcome back</h1>
        <p class="nash-login-sub">Sign in to access the AEM Qualifier.</p>
        <form class="nash-login-form" novalidate>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-email">Email</label>
            <input class="nash-login-input" id="nl-email" name="email"
              type="email" placeholder="you@adobe.com"
              autocomplete="email" required/>
          </div>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-pass">Password</label>
            <input class="nash-login-input" id="nl-pass" name="password"
              type="password" placeholder="Your password"
              autocomplete="current-password" required/>
          </div>
          <div class="nash-login-error" hidden></div>
          <button class="nash-login-btn" type="submit">Sign in</button>
        </form>
        <p class="nash-login-footer">
          First time here?
          <button class="nash-login-switch" type="button">Create an account</button>
        </p>
      </div>
    </div>
  `;

  const form = block.querySelector('.nash-login-form');
  const errorEl = block.querySelector('.nash-login-error');
  const btn = block.querySelector('.nash-login-btn');

  block.querySelector('.nash-login-switch').addEventListener('click', () => switchFn('create'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const email = block.querySelector('#nl-email').value.trim();
    const password = block.querySelector('#nl-pass').value;

    try {
      const result = await doLogin(email, password);
      if (result.ok) {
        storeSession(email, result.name);
        window.location.href = '/';
      } else {
        setError(errorEl, btn, 'Sign in', getMsg(LOGIN_ERRORS, result.reason));
      }
    } catch {
      setError(errorEl, btn, 'Sign in', LOGIN_ERRORS.default);
    }
  });
}

function renderCreateAccount(block, switchFn) {
  const logo = logoSvg();
  block.innerHTML = `
    <div class="nash-login-shell">
      <div class="nash-login-card" data-mode="create">
        <div class="nash-login-brand">
          ${logo}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-title">Create your account</h1>
        <p class="nash-login-sub">Join your team on Nash.</p>
        <form class="nash-login-form" novalidate>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-name">Full name</label>
            <input class="nash-login-input" id="nl-name" name="name"
              type="text" placeholder="Your name"
              autocomplete="name" required/>
          </div>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-email">Email</label>
            <input class="nash-login-input" id="nl-email" name="email"
              type="email" placeholder="you@adobe.com"
              autocomplete="email" required/>
          </div>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-pass">Password</label>
            <input class="nash-login-input" id="nl-pass" name="password"
              type="password" placeholder="Create a password"
              autocomplete="new-password" required/>
            <span class="nash-login-hint">At least 8 characters</span>
          </div>
          <div class="nash-login-field">
            <label class="nash-login-label" for="nl-pass2">Confirm password</label>
            <input class="nash-login-input" id="nl-pass2" name="confirm"
              type="password" placeholder="Repeat your password"
              autocomplete="new-password" required/>
          </div>
          <div class="nash-login-error" hidden></div>
          <button class="nash-login-btn" type="submit">Create account</button>
        </form>
        <p class="nash-login-footer">
          Already have an account?
          <button class="nash-login-switch" type="button">Sign in</button>
        </p>
      </div>
    </div>
  `;

  const form = block.querySelector('.nash-login-form');
  const errorEl = block.querySelector('.nash-login-error');
  const btn = block.querySelector('.nash-login-btn');

  block.querySelector('.nash-login-switch').addEventListener('click', () => switchFn('signin'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const name = block.querySelector('#nl-name').value.trim();
    const email = block.querySelector('#nl-email').value.trim();
    const password = block.querySelector('#nl-pass').value;
    const confirm = block.querySelector('#nl-pass2').value;

    if (password.length < 8) {
      setError(errorEl, btn, 'Create account', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError(errorEl, btn, 'Create account', 'Passwords do not match.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const result = await doRegister(email, password, name);
      if (result.ok) {
        storeSession(email, name);
        window.location.href = '/';
      } else {
        setError(errorEl, btn, 'Create account', getMsg(REGISTER_ERRORS, result.reason));
      }
    } catch {
      setError(errorEl, btn, 'Create account', REGISTER_ERRORS.default);
    }
  });
}

export default async function decorate(block) {
  function switchMode(mode) {
    if (mode === 'create') {
      renderCreateAccount(block, switchMode);
    } else {
      renderSignIn(block, switchMode);
    }
  }

  renderSignIn(block, switchMode);
}
