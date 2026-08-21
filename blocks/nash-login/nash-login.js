/**
 * nash-login block — Adobe SSO (Okta) sign-in.
 * Split layout: branded panel with a rotating background image + logo, name and
 * title (left) and the sign-in box (right). Sign-in runs the PKCE flow in
 * scripts/nash-auth.js; the token is the session.
 * @param {Element} block
 */

import { login as oktaLogin } from '../../scripts/nash-auth.js';

const BG_COUNT = 7;
const ROTATE_MS = 7000;

function logoSvg(size) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 20 20" `
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  return `<svg ${attrs}>`
    + '<rect width="20" height="20" rx="3" fill="#eb1000"/>'
    + '<polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>'
    + '</svg>';
}

/* Crossfade the two background layers through a shuffled list of images. */
function startBackground(block) {
  const base = `${window.hlx.codeBasePath}/blocks/nash-login`;
  const urls = [];
  for (let i = 1; i <= BG_COUNT; i += 1) urls.push(`${base}/login-bg-${i}.jpg`);
  for (let i = urls.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [urls[i], urls[j]] = [urls[j], urls[i]];
  }
  const layers = [...block.querySelectorAll('.nash-login-bg')];
  if (!layers.length) return;
  let idx = 0;
  let active = 0;
  layers[0].style.backgroundImage = `url("${urls[0]}")`;
  layers[0].classList.add('is-active');
  if (urls.length < 2) return;
  setInterval(() => {
    idx = (idx + 1) % urls.length;
    const next = layers[1 - active];
    next.style.backgroundImage = `url("${urls[idx]}")`;
    next.classList.add('is-active');
    layers[active].classList.remove('is-active');
    active = 1 - active;
  }, ROTATE_MS);
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
    <div class="nash-login-bg"></div>
    <div class="nash-login-bg"></div>
    <div class="nash-login-scrim" aria-hidden="true"></div>
    <div class="nash-login-content">
      <div class="nash-login-brand">
        <div class="nash-login-logo-row">
          ${logoSvg(28)}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-title">Understand the opportunity.<br>Shape the solution. Share it.</h1>
      </div>
      <div class="nash-login-card">
        <h2 class="nash-login-heading">Sign in</h2>
        <p class="nash-login-subhead">Use your Adobe account to continue.</p>
        <button class="nash-login-sso" type="button">Sign in with Adobe</button>
        <p class="nash-login-help">Access is limited to Adobe employees.</p>
      </div>
    </div>
  `;

  block.querySelector('.nash-login-sso').addEventListener('click', () => oktaLogin());
  startBackground(block);
}
