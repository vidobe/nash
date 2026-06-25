/**
 * nash-login block — Adobe SSO (Okta) sign-in only.
 * Two-column layout: sign-in card (left) + rotating quote panel (right).
 * Sign-in runs the PKCE flow in scripts/nash-auth.js; the token is the session.
 * @param {Element} block
 */

import { login as oktaLogin } from '../../scripts/nash-auth.js';

const DEFAULT_SENTENCES = [
  'Qualify faster. Win smarter.',
  'Know your AEM fit score before the meeting.',
  'Turn RFPs into structured intelligence.',
  'Stop guessing on competitive positioning.',
  'Your team\'s AEM expertise, one click away.',
  'Better assessments. Fewer surprises.',
  'From RFP to recommendation, in minutes.',
];

function logoSvg(size) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 20 20" `
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  return `<svg ${attrs}>`
    + '<rect width="20" height="20" rx="3" fill="#eb1000"/>'
    + '<polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>'
    + '</svg>';
}

function makeRotator(el, sentences) {
  let idx = 0;
  const show = (text) => {
    el.classList.add('nash-login-quote-out');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('nash-login-quote-out');
    }, 380);
  };
  setInterval(() => {
    idx = (idx + 1) % sentences.length;
    show(sentences[idx]);
  }, 4000);
}

export default async function decorate(block) {
  // Break out of EDS section/main max-width so the login fills the full viewport.
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
    <div class="nash-login-left">
      <div class="nash-login-card">
        <div class="nash-login-logo-row">
          ${logoSvg(26)}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-heading">Sign in to Nash</h1>
        <p class="nash-login-subhead">Use your Adobe account to continue.</p>
        <button class="nash-login-sso" type="button">
          ${logoSvg(18)}
          Sign in with Adobe
        </button>
      </div>
    </div>
    <div class="nash-login-right" aria-hidden="true">
      <div class="nash-login-stage">
        <div class="nash-login-quote-mark">&ldquo;</div>
        <p class="nash-login-quote">${DEFAULT_SENTENCES[0]}</p>
        <p class="nash-login-quote-label">Nash &middot; Solution Qualifier</p>
      </div>
    </div>
  `;

  makeRotator(block.querySelector('.nash-login-quote'), DEFAULT_SENTENCES);
  block.querySelector('.nash-login-sso').addEventListener('click', () => oktaLogin());
}
