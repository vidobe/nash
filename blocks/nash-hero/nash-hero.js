/**
 * loads and decorates the nash-hero block
 *
 * Content model:
 *   Row 1: Hero headline (HTML allowed)
 *   Row 2: Hero sub-text
 *
 * Stats are loaded dynamically from /reports/query.json.
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div > div')];
  const headline = rows[0]?.innerHTML.trim() || 'Your secret weapon<br>for customer meetings';
  const sub = rows[1]?.textContent.trim()
    || 'AI-powered opportunity qualification — AEM fit scoring, competitive analysis, and solution recommendations. Ready in minutes.';

  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  let total = 12;
  let generating = 4;
  try {
    const resp = await fetch('/qualifications/query.json');
    if (resp.ok) {
      const json = await resp.json();
      const rows2 = json.data || [];
      total = rows2.length;
      generating = rows2.filter((r) => r.status === 'generating').length;
    }
  } catch {
    // use defaults
  }

  block.innerHTML = `
    <div class="nash-hero-body">
      <p class="nash-hero-greeting">${greeting}, Vitor</p>
      <h1 class="nash-hero-title">${headline}</h1>
      <p class="nash-hero-sub">${sub}</p>
      <div class="nash-hero-actions">
        <button class="nash-hero-btn-primary" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Analysis
        </button>
        <button class="nash-hero-btn-secondary" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
          Solutions Skills
        </button>
      </div>
      <div class="nash-hero-stats">
        <div class="nash-hero-stat">
          <div class="nash-hero-stat-val" id="nash-stat-total">${total}</div>
          <div class="nash-hero-stat-label">Total qualifications</div>
        </div>
        <div class="nash-hero-stat accent">
          <div class="nash-hero-stat-val" id="nash-stat-gen">${generating}</div>
          <div class="nash-hero-stat-label">Generating now</div>
        </div>
        <div class="nash-hero-stat">
          <div class="nash-hero-stat-val">~5.0h</div>
          <div class="nash-hero-stat-label">Avg generation time</div>
        </div>
        <div class="nash-hero-stat">
          <div class="nash-hero-stat-val">Claude 4.6</div>
          <div class="nash-hero-stat-label">AI model</div>
        </div>
      </div>
    </div>
  `;

  block.querySelector('.nash-hero-btn-primary').addEventListener('click', () => {
    window.location.href = '/new-analysis';
  });

  block.querySelector('.nash-hero-btn-secondary').addEventListener('click', () => {
    window.location.href = '/solutions/';
  });
}
