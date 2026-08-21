/**
 * nash-login block — Adobe SSO (Okta) sign-in.
 * Split layout: branded panel with a rotating background image + logo, name and
 * title (left) and the sign-in box (right). Sign-in runs the PKCE flow in
 * scripts/nash-auth.js; the token is the session.
 * @param {Element} block
 */

import { login as oktaLogin } from '../../scripts/nash-auth.js';

const BG_COUNT = 7;

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
          <span class="nash-login-mark" aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 240 234" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adobe">
              <rect height="234" rx="42.5" width="240" fill="#fa0f00"/>
              <path fill="#fff" d="M186.617 175.95h-28.506a6.243 6.243 0 0 1-5.847-3.769l-30.947-72.359a1.364 1.364 0 0 0-2.611-.034L99.42 145.731a1.635 1.635 0 0 0 1.506 2.269h21.2a3.27 3.27 0 0 1 3.01 1.994l9.281 20.655a3.812 3.812 0 0 1-3.507 5.301H53.734a3.518 3.518 0 0 1-3.213-4.904l49.09-116.902A6.639 6.639 0 0 1 105.843 50h28.314a6.628 6.628 0 0 1 6.232 4.144l49.43 116.902a3.517 3.517 0 0 1-3.202 4.904z"/>
            </svg>
          </span>
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
