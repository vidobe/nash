/**
 * loads and decorates the nash-hero block
 *
 * Content model:
 *   Row 1: Hero headline (HTML allowed)
 *   Row 2: Hero sub-text
 *
 * @param {Element} block The block element
 */

import { getUserInfo } from '../../scripts/nash-auth.js';

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div > div')];
  const headline = rows[0]?.innerHTML.trim() || 'Qualify, position, and win.';
  const sub = rows[1]?.textContent.trim()
    || 'Turn an RFP into a grounded Adobe opportunity assessment — solution-fit scoring across AEM, Commerce, Workfront and more, with objectives, competition, and ways to win. Discuss it with Fluffy, manage the opportunity, and publish a shareable report.';

  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  const name = (getUserInfo()?.name || '').split(' ')[0];

  block.innerHTML = `
    <div class="nash-hero-row">
      <div class="nash-hero-body">
        <p class="nash-hero-greeting">${greeting}${name ? `, ${name}` : ''}</p>
        <h1 class="nash-hero-title">${headline}</h1>
        <p class="nash-hero-sub">${sub}</p>
        <div class="nash-hero-actions">
          <button class="nash-hero-btn-primary" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Analysis
          </button>
        </div>
      </div>
    </div>
  `;

  block.querySelector('.nash-hero-btn-primary').addEventListener('click', () => {
    window.location.href = '/indextest';
  });
}
