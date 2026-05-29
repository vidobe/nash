/**
 * aibootcamp-login block
 * Login-only page for the Adobe AI Bootcamp NL event.
 * Adobe wordmark logo, event branding.
 * Credentials read from /aibootcamp/config/auth.json (email | password | name | company).
 * Passwords are SHA-256 hashed client-side.
 * Session stored in localStorage under 'aibootcamp-auth' for 12 hours.
 * On success redirects to /aibootcamp/brand-visibility-report.
 */

const SESSION_KEY = 'aibootcamp-auth';
const SESSION_HOURS = 12;
const AUTH_SHEET = '/aibootcamp/config/auth.json';
const RESULTS_PAGE = '/aibootcamp/brand-visibility-report';

const QUOTES = [
  'See how AI sees your brand.',
  'Your brand visibility, quantified.',
  'From data to insight, in minutes.',
  'Understand where you stand — and where you could.',
  'AI-powered brand intelligence for the modern marketer.',
  'Your digital presence, analysed and ready.',
  'The future of brand visibility starts here.',
];

const LOADING_QUOTES = [
  'Checking your credentials…',
  'Asking the server very politely…',
  'Almost there…',
  'Verifying with the mothership…',
  'This usually takes less time than a café order…',
];

export function isAuthenticated() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return auth && Date.now() < auth.expires;
  } catch {
    return false;
  }
}

export function getSession() {
  try {
    const auth = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return auth && Date.now() < auth.expires ? auth : null;
  } catch {
    return null;
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

function storeSession(email, name, company) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    expires: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    email,
    name: name || email.split('@')[0],
    company: company || '',
  }));
}

async function readAuthSheet() {
  const resp = await fetch(AUTH_SHEET);
  if (!resp.ok) throw new Error('sheet_unavailable');
  const json = await resp.json();
  return json.data || [];
}

async function doLogin(email, password) {
  const hash = await sha256(password);
  try {
    const rows = await readAuthSheet();
    const row = rows.find((r) => r.email && r.email.toLowerCase() === email.toLowerCase());
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.password !== hash) return { ok: false, reason: 'wrong_password' };
    return { ok: true, name: row.name || '', company: row.company || '' };
  } catch {
    return { ok: false, reason: 'sheet_unavailable' };
  }
}

function adobeLogoSvg() {
  return '<img class="aibootcamp-login-adobe-wordmark" src="/icons/adobe-wordmark.svg" alt="Adobe" width="96" height="24"/>';
}

function makeRotator(el, pool) {
  let idx = 0;
  let timer = null;

  function show(text) {
    el.classList.add('aibootcamp-login-quote-out');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('aibootcamp-login-quote-out');
    }, 380);
  }

  function tick() {
    idx = (idx + 1) % pool.length;
    show(pool[idx]);
  }

  const start = () => { timer = setInterval(tick, 4000); };
  const stop = () => { clearInterval(timer); timer = null; };
  const swap = (newPool) => {
    stop();
    // eslint-disable-next-line no-param-reassign
    pool = newPool.slice();
    idx = 0;
    show(pool[0]);
    start();
  };

  start();
  return { stop, swap };
}

const ERRORS = {
  not_found: 'No account found with that email address.',
  wrong_password: 'Incorrect password. Please try again.',
  sheet_unavailable: 'Could not reach the auth service. Try again shortly.',
  default: 'Something went wrong. Please try again.',
};

export default async function decorate(block) {
  const section = block.closest('.section');
  const main = block.closest('main');
  [section, main].forEach((el) => {
    if (!el) return;
    el.style.maxWidth = 'none';
    el.style.width = '100%';
    el.style.margin = '0';
    el.style.padding = '0';
  });

  block.innerHTML = `
    <div class="aibootcamp-login-left">
      <div class="aibootcamp-login-card">
        <div class="aibootcamp-login-logo-row">
          ${adobeLogoSvg()}
        </div>
        <h1 class="aibootcamp-login-heading">Sign in to AI Bootcamp</h1>
        <p class="aibootcamp-login-subheading">Access your brand visibility report</p>
        <form class="aibootcamp-login-form" novalidate>
          <div class="aibootcamp-login-field">
            <label class="aibootcamp-login-label" for="ab-email">Email</label>
            <input class="aibootcamp-login-input" id="ab-email" name="email"
              type="email" placeholder="you@company.com"
              autocomplete="email" required/>
          </div>
          <div class="aibootcamp-login-field">
            <label class="aibootcamp-login-label" for="ab-pass">Password</label>
            <input class="aibootcamp-login-input" id="ab-pass" name="password"
              type="password" placeholder="Your password"
              autocomplete="current-password" required/>
          </div>
          <div class="aibootcamp-login-error" hidden></div>
          <button class="aibootcamp-login-btn" type="submit">View my report</button>
        </form>
        <p class="aibootcamp-login-footer">Adobe AI Bootcamp &middot; Netherlands 2026</p>
      </div>
    </div>
    <div class="aibootcamp-login-right" aria-hidden="true">
      <div class="aibootcamp-login-stage">
        <div class="aibootcamp-login-quote-mark">&ldquo;</div>
        <p class="aibootcamp-login-quote">${QUOTES[0]}</p>
        <p class="aibootcamp-login-quote-label">Adobe AI Bootcamp &middot; Brand Visibility</p>
      </div>
    </div>
  `;

  const form = block.querySelector('.aibootcamp-login-form');
  const errorEl = block.querySelector('.aibootcamp-login-error');
  const btn = block.querySelector('.aibootcamp-login-btn');
  const quoteEl = block.querySelector('.aibootcamp-login-quote');

  const rotator = makeRotator(quoteEl, QUOTES);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    rotator.swap(LOADING_QUOTES);

    const email = block.querySelector('#ab-email').value.trim();
    const password = block.querySelector('#ab-pass').value;

    try {
      const result = await doLogin(email, password);
      if (result.ok) {
        storeSession(email, result.name, result.company);
        window.location.href = RESULTS_PAGE;
      } else {
        rotator.swap(QUOTES);
        errorEl.textContent = ERRORS[result.reason] || ERRORS.default;
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = 'View my report';
      }
    } catch {
      rotator.swap(QUOTES);
      errorEl.textContent = ERRORS.default;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'View my report';
    }
  });
}
