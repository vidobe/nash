/**
 * loads and decorates the nash-hero block
 *
 * Content model:
 *   Row 1: Hero headline (HTML allowed)
 *   Row 2: Hero sub-text
 *
 * @param {Element} block The block element
 */

/* GitHub-style activity heatmap (last 26 weeks) from qualification timestamps. */
function buildActivity(rows, usingMock) {
  const WEEKS = 26;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  const counts = {};
  rows.forEach((r) => {
    const ts = Number(r.lastmodified || r.lastModified) || 0;
    if (!ts) return;
    const d = new Date(ts * 1000);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  });

  let total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total && usingMock) {
    for (let i = 0; i < WEEKS * 7; i += 1) {
      if (Math.random() < 0.3) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        counts[d.toISOString().slice(0, 10)] = Math.ceil(Math.random() * 4);
      }
    }
    total = Object.values(counts).reduce((a, b) => a + b, 0);
  }

  const levelFor = (c) => {
    if (!c) return 0;
    if (c === 1) return 1;
    if (c === 2) return 2;
    if (c <= 4) return 3;
    return 4;
  };

  const days = [];
  const cur = new Date(start);
  while (cur <= today) {
    const key = cur.toISOString().slice(0, 10);
    days.push({ date: key, count: counts[key] || 0, level: levelFor(counts[key] || 0) });
    cur.setDate(cur.getDate() + 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;
  const monthRow = weeks.map((week) => {
    const m = new Date(week[0].date).getMonth();
    if (m !== lastMonth) { lastMonth = m; return `<span class="nash-hero-act-month">${MONTHS[m]}</span>`; }
    return '<span class="nash-hero-act-month"></span>';
  }).join('');

  const cols = weeks.map((week) => `
    <div class="nash-hero-act-col">
      ${week.map((d) => `<span class="nash-hero-act-cell" data-level="${d.level}" title="${d.date}: ${d.count} assessment${d.count === 1 ? '' : 's'}"></span>`).join('')}
    </div>
  `).join('');

  const legend = [0, 1, 2, 3, 4].map((l) => `<span class="nash-hero-act-cell" data-level="${l}"></span>`).join('');

  return `
    <div class="nash-hero-activity">
      <div class="nash-hero-act-head">
        <span class="nash-hero-act-title">Activity</span>
        <span class="nash-hero-act-total">${total} in the last 6 months</span>
      </div>
      <div class="nash-hero-act-scroll">
        <div class="nash-hero-act-months">${monthRow}</div>
        <div class="nash-hero-act-grid">${cols}</div>
      </div>
      <div class="nash-hero-act-legend"><span>Less</span>${legend}<span>More</span></div>
    </div>
  `;
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div > div')];
  const headline = rows[0]?.innerHTML.trim() || 'Your secret weapon<br>for customer meetings';
  const sub = rows[1]?.textContent.trim()
    || 'AI-powered opportunity qualification — AEM fit scoring, competitive analysis, and solution recommendations. Ready in minutes.';

  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  let data = [];
  let usingMock = false;
  try {
    const resp = await fetch('/qualifications/query.json');
    if (resp.ok) {
      const json = await resp.json();
      data = json.data || [];
    }
    if (!data.length) usingMock = true;
  } catch {
    usingMock = true;
  }

  block.innerHTML = `
    <div class="nash-hero-row">
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
      </div>
      <div class="nash-hero-aside">
        ${buildActivity(data, usingMock)}
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
