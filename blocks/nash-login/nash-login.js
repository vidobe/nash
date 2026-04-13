/**
 * nash-login block
 * Two-column layout: dark form panel (left) + rotating quote panel (right).
 * Quotes personalise when a known email is detected.
 * Passwords are SHA-256 hashed client-side.
 * Credentials stored in DA spreadsheet at /config/auth (email | password | name | created).
 * Login reads from /config/auth.json (published DA sheet).
 * Registration writes via POST /api/auth (Cloudflare Worker).
 * Session lasts 8 hours in localStorage under 'nash-auth'.
 * @param {Element} block
 */

const SESSION_KEY = 'nash-auth';
const SESSION_HOURS = 8;

const DEFAULT_SENTENCES = [
  'Qualify faster. Win smarter.',
  'Know your AEM fit score before the meeting.',
  'Turn RFPs into structured intelligence.',
  'Stop guessing on competitive positioning.',
  'Your team\'s AEM expertise, one click away.',
  'Better assessments. Fewer surprises.',
  'From RFP to recommendation, in minutes.',
];

const LOADING_SENTENCES = [
  'Checking your credentials…',
  'Asking the server very politely…',
  'Almost there…',
  'Verifying with the mothership…',
  'This usually takes less time than a café order…',
];

const PERSONS = [
  {
    match: (email) => email.includes('vgabriel') || email.startsWith('vitor.gabriel'),
    name: 'Vitor',
    greeting: 'Olá, Vitor.',
    sentences: [
      'Still thinking about that pastel de nata?',
      'Lisbon called. It wants its best sales engineer back.',
      'You literally built this thing. Sign in already.',
      'Bacalhau for lunch, AEM deals for dessert.',
      'A Portuguesa plays softly in the background.',
      'The saudade hits different when you\'re qualifying deals.',
    ],
  },
  {
    match: (email) => email.includes('kvaneeghem'),
    name: 'Koen',
    greeting: 'Hey Koen.',
    sentences: [
      'Did your cat approve this login attempt?',
      'Hakuna Matata. Your access awaits.',
      'The real AEM expert has entered the building.',
      'Somewhere, a cat is judging your password choice.',
      'You can fix this component. You always can.',
      'Under the sea there are no deadlines. But up here there are.',
    ],
  },
  {
    match: (email) => email.includes('erven'),
    name: 'Sanne',
    greeting: 'Hey Sanne.',
    sentences: [
      'Strong opinions. Great taste. Correct, usually.',
      'Someone has to keep this team together. Thanks for that.',
      'Padel score: won. Meeting score: also won.',
      'Padel can wait. The pipeline won\'t.',
      'Already know what everyone else should be doing? Same.',
      'Are those new shoes? Bold choice for a Monday login.',
      'The playlist is ready. The deals are not. Let\'s fix that.',
      'Strong opinions. Great taste. Correct, usually.',
    ],
  },
  {
    match: (email) => email.includes('biederma'),
    name: 'Max',
    greeting: 'Guten Tag, Max.',
    sentences: [
      'You co-built this. The least it can do is let you in.',
      'Precision in the kitchen. Precision in the code.',
      'A Michelin star for the architecture, please.',
      'Even your error messages are perfectly seasoned.',
      'The Germans invented the car. You\'re just perfecting the pipeline.',
      'Reduce, reuse, refactor — and always deglaze the pan.',
    ],
  },
  {
    match: (email) => email.includes('wsmeets'),
    name: 'Waldo',
    greeting: 'Goedemiddag, baas.',
    sentences: [
      'You walked in and the room got 40% more organised.',
      'The boss has arrived. Typos are now being corrected.',
      '15 years at Adobe. Still no one reads the brief.',
      'Carnival is over. Time to qualify some deals.',
      'All spelling mistakes have been quietly removed. Welcome.',
      'Marketing strategy loading… please hold.',
      'The most experienced person in the room just signed in.',
    ],
  },
  {
    match: (email) => email.includes('pvanoosterho'),
    name: 'Paul',
    greeting: 'Hey Paul.',
    sentences: [
      'Why did the data pipeline break down? It ran out of schema. Hi Paul.',
      'Scooter: fixed. Garden: tended. Deals: unqualified. Let\'s fix that.',
      'What do you call a solutions architect who gardens? A root cause analyst.',
      'The only person who debugs engines AND data models. Respect.',
      'I asked my garden for insights. It said it prefers the cloud.',
      'Dad joke loading… Why did the architect sit outside? For the edge delivery.',
    ],
  },
];

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
  try {
    const result = await callAuthApi({ action: 'login', email, hash });
    // Only trust the worker result if it's a proper auth response (no HTTP error code)
    const isHttpError = result.reason && result.reason.startsWith('http_');
    if (!isHttpError) return result;
  } catch { /* worker unavailable, fall through to sheet */ }
  try {
    const rows = await readAuthSheet();
    const row = rows.find((r) => r.email && r.email.toLowerCase() === email.toLowerCase());
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.password !== hash) return { ok: false, reason: 'wrong_password' };
    return { ok: true, name: row.name || '' };
  } catch {
    return { ok: false, reason: 'sheet_unavailable' };
  }
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

function getPerson(email) {
  const lc = email.toLowerCase().trim();
  return PERSONS.find((p) => p.match(lc)) || null;
}

function logoSvg() {
  const attrs = 'width="26" height="26" viewBox="0 0 20 20" '
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  return `<svg ${attrs}>`
    + '<rect width="20" height="20" rx="3" fill="#eb1000"/>'
    + '<polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>'
    + '</svg>';
}

function makeRotator(el, initialSentences) {
  let pool = initialSentences.slice();
  let idx = 0;
  let timer = null;

  function show(text) {
    el.classList.add('nash-login-quote-out');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('nash-login-quote-out');
    }, 380);
  }

  function tick() {
    idx = (idx + 1) % pool.length;
    show(pool[idx]);
  }

  function start() {
    timer = setInterval(tick, 4000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function swap(newPool) {
    stop();
    pool = newPool.slice();
    idx = 0;
    show(pool[0]);
    start();
  }

  start();
  return { stop, swap };
}

const LOGIN_ERRORS = {
  not_found: 'No account found with that email address.',
  wrong_password: 'Incorrect password. Please try again.',
  sheet_unavailable: 'Could not reach the auth service. Try again shortly.',
  default: 'Something went wrong. Please try again.',
};

const REGISTER_ERRORS = {
  email_taken: 'An account with that email already exists.',
  http_404: 'Registration is not available yet. Ask your team admin.',
  default: 'Could not create your account. Please try again.',
};

function getMsg(map, reason) {
  return map[reason] || map.default;
}

function showError(errorEl, btn, label, msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  btn.disabled = false;
  btn.textContent = label;
}

function renderSignIn(block, switchFn) {
  const logo = logoSvg();
  const firstSentence = DEFAULT_SENTENCES[0];

  block.innerHTML = `
    <div class="nash-login-left">
      <div class="nash-login-card">
        <div class="nash-login-logo-row">
          ${logo}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-heading">Sign in to Nash</h1>
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
          <button class="nash-login-btn" type="submit">Continue</button>
        </form>
        <p class="nash-login-footer">
          First time here?
          <button class="nash-login-switch" type="button">Create an account</button>
        </p>
      </div>
    </div>
    <div class="nash-login-right" aria-hidden="true">
      <div class="nash-login-stage">
        <div class="nash-login-quote-mark">&ldquo;</div>
        <p class="nash-login-quote">${firstSentence}</p>
        <p class="nash-login-quote-label">Nash &middot; Solution Qualifier</p>
      </div>
    </div>
  `;

  const form = block.querySelector('.nash-login-form');
  const errorEl = block.querySelector('.nash-login-error');
  const btn = block.querySelector('.nash-login-btn');
  const emailEl = block.querySelector('#nl-email');
  const quoteEl = block.querySelector('.nash-login-quote');

  const rotator = makeRotator(quoteEl, DEFAULT_SENTENCES);

  emailEl.addEventListener('input', () => {
    const person = getPerson(emailEl.value);
    rotator.swap(person ? person.sentences : DEFAULT_SENTENCES);
  });

  block.querySelector('.nash-login-switch').addEventListener('click', () => {
    rotator.stop();
    switchFn('create');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    rotator.swap(LOADING_SENTENCES);

    const email = emailEl.value.trim();
    const password = block.querySelector('#nl-pass').value;

    try {
      const result = await doLogin(email, password);
      if (result.ok) {
        storeSession(email, result.name);
        window.location.href = '/';
      } else {
        const person = getPerson(email);
        rotator.swap(person ? person.sentences : DEFAULT_SENTENCES);
        showError(errorEl, btn, 'Continue', getMsg(LOGIN_ERRORS, result.reason));
      }
    } catch {
      rotator.swap(DEFAULT_SENTENCES);
      showError(errorEl, btn, 'Continue', LOGIN_ERRORS.default);
    }
  });

  return rotator;
}

function renderCreateAccount(block, switchFn) {
  const logo = logoSvg();
  const firstSentence = DEFAULT_SENTENCES[0];

  block.innerHTML = `
    <div class="nash-login-left">
      <div class="nash-login-card">
        <div class="nash-login-logo-row">
          ${logo}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-heading">Create your account</h1>
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
              type="password" placeholder="Create a password (min. 8 chars)"
              autocomplete="new-password" required/>
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
    <div class="nash-login-right" aria-hidden="true">
      <div class="nash-login-stage">
        <div class="nash-login-quote-mark">&ldquo;</div>
        <p class="nash-login-quote">${firstSentence}</p>
        <p class="nash-login-quote-label">Nash &middot; Solution Qualifier</p>
      </div>
    </div>
  `;

  const form = block.querySelector('.nash-login-form');
  const errorEl = block.querySelector('.nash-login-error');
  const btn = block.querySelector('.nash-login-btn');
  const emailEl = block.querySelector('#nl-email');
  const quoteEl = block.querySelector('.nash-login-quote');

  const rotator = makeRotator(quoteEl, DEFAULT_SENTENCES);

  emailEl.addEventListener('input', () => {
    const person = getPerson(emailEl.value);
    rotator.swap(person ? person.sentences : DEFAULT_SENTENCES);
  });

  block.querySelector('.nash-login-switch').addEventListener('click', () => {
    rotator.stop();
    switchFn('signin');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const name = block.querySelector('#nl-name').value.trim();
    const email = emailEl.value.trim();
    const password = block.querySelector('#nl-pass').value;
    const confirm = block.querySelector('#nl-pass2').value;

    if (password.length < 8) {
      showError(errorEl, btn, 'Create account', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      showError(errorEl, btn, 'Create account', 'Passwords do not match.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    rotator.swap(LOADING_SENTENCES);

    try {
      const result = await doRegister(email, password, name);
      if (result.ok) {
        storeSession(email, name);
        window.location.href = '/';
      } else {
        rotator.swap(DEFAULT_SENTENCES);
        showError(errorEl, btn, 'Create account', getMsg(REGISTER_ERRORS, result.reason));
      }
    } catch {
      rotator.swap(DEFAULT_SENTENCES);
      showError(errorEl, btn, 'Create account', REGISTER_ERRORS.default);
    }
  });

  return rotator;
}

export default async function decorate(block) {
  // Break out of EDS section/main max-width so the login fills the full viewport
  const section = block.closest('.section');
  const main = block.closest('main');
  [section, main].forEach((el) => {
    if (!el) return;
    el.style.maxWidth = 'none';
    el.style.width = '100%';
    el.style.margin = '0';
    el.style.padding = '0';
  });

  let rotator = null;

  function switchMode(mode) {
    if (rotator) rotator.stop();
    if (mode === 'create') {
      rotator = renderCreateAccount(block, switchMode);
    } else {
      rotator = renderSignIn(block, switchMode);
    }
  }

  rotator = renderSignIn(block, switchMode);
}
