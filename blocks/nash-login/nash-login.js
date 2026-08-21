/**
 * nash-login block — Adobe SSO (Okta) sign-in.
 * Split layout: branded panel with a rotating background image + logo, name and
 * title (left) and the sign-in box (right). Sign-in runs the PKCE flow in
 * scripts/nash-auth.js; the token is the session.
 * @param {Element} block
 */

import { login as oktaLogin } from '../../scripts/nash-auth.js';

const BG_COUNT = 7;

function logoSvg(size) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 20 20" `
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  return `<svg ${attrs}>`
    + '<rect width="20" height="20" rx="3" fill="#eb1000"/>'
    + '<polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>'
    + '</svg>';
}

/* Pick one background per calendar day (stable for the whole day). */
function setBackground(block) {
  const bg = block.querySelector('.nash-login-bg');
  if (!bg) return;
  const day = Math.floor(Date.now() / 86400000);
  const n = (day % BG_COUNT) + 1;
  bg.style.backgroundImage = `url("${window.hlx.codeBasePath}/blocks/nash-login/login-bg-${n}.jpg")`;
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
    <div class="nash-login-scrim" aria-hidden="true"></div>
    <div class="nash-login-content">
      <div class="nash-login-brand">
        <div class="nash-login-logo-row">
          ${logoSvg(36)}
          <span class="nash-login-wordmark">Nash</span>
        </div>
        <h1 class="nash-login-title"><span>Understand the opportunity.</span><span>Shape the solution. Share it.</span></h1>
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
  setBackground(block);
}
