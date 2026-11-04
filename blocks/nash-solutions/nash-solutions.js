/**
 * loads and decorates the nash-solutions block
 * Fetches /solutions/query.json for solution cards.
 * Each solution document provides: title, description, status, productcount, lastUpdated
 * @param {Element} block The block element
 */

const PILLARS = [
  {
    id: 'brand-visibility',
    name: 'Brand Visibility',
  },
  {
    id: 'customer-engagement',
    name: 'Customer Engagement',
  },
  {
    id: 'content-supply-chain',
    name: 'Content Supply Chain',
  },
  {
    id: 'ai-orchestration',
    name: 'AI Platform & Orchestration',
  },
  {
    id: 'developer',
    name: 'Developer & Extensibility',
  },
];

const SOLUTION_PILLARS = {
  advertising: 'brand-visibility',
  aem: 'brand-visibility',
  'aem-forms': 'brand-visibility',
  'aem-guides': 'brand-visibility',
  'brand-concierge': 'brand-visibility',
  commerce: 'brand-visibility',
  'commerce-optimizer': 'brand-visibility',
  llmo: 'brand-visibility',
  'sites-optimizer': 'brand-visibility',
  analytics: 'customer-engagement',
  'audience-manager': 'customer-engagement',
  campaign: 'customer-engagement',
  cja: 'customer-engagement',
  'content-analytics': 'customer-engagement',
  'experience-platform': 'customer-engagement',
  'experimentation-accelerator': 'customer-engagement',
  'journey-optimizer': 'customer-engagement',
  'journey-optimizer-b2b': 'customer-engagement',
  'marketing-campaign-analytics': 'customer-engagement',
  marketo: 'customer-engagement',
  'marketo-measure': 'customer-engagement',
  'marketo-optimizer': 'customer-engagement',
  'marketo-qualifier': 'customer-engagement',
  rtcdp: 'customer-engagement',
  target: 'customer-engagement',
  'adobe-express': 'content-supply-chain',
  'aem-assets': 'content-supply-chain',
  'firefly-creative-production': 'content-supply-chain',
  'firefly-custom-models': 'content-supply-chain',
  'firefly-foundry': 'content-supply-chain',
  'firefly-graph': 'content-supply-chain',
  'firefly-services': 'content-supply-chain',
  'frame-io': 'content-supply-chain',
  'learning-manager': 'content-supply-chain',
  'substance-3d': 'content-supply-chain',
  workfront: 'content-supply-chain',
  'agent-orchestrator': 'ai-orchestration',
  'brand-intelligence': 'ai-orchestration',
  'cx-enterprise-coworker': 'ai-orchestration',
  'developer-app-builder': 'developer',
};

const SOLUTION_TILES = {
  advertising: ['Ad', 1],
  'brand-concierge': ['Bc', 2],
  llmo: ['Bv', 3],
  commerce: ['Co', 4],
  'commerce-optimizer': ['Cm', 5],
  'aem-forms': ['Fm', 6],
  'aem-guides': ['Gd', 7],
  aem: ['Si', 8],
  'sites-optimizer': ['So', 9],
  analytics: ['An', 12],
  'audience-manager': ['Am', 13],
  campaign: ['Ca', 14],
  'content-analytics': ['Cn', 15],
  cja: ['Cj', 16],
  'experience-platform': ['Ep', 17],
  'journey-optimizer': ['Jo', 18],
  'journey-optimizer-b2b': ['Jb', 19],
  'experimentation-accelerator': ['Ea', 20],
  'marketing-campaign-analytics': ['Mc', 21],
  marketo: ['Me', 22],
  'marketo-measure': ['Mm', 23],
  'marketo-optimizer': ['Mo', 24],
  'marketo-qualifier': ['Mq', 25],
  rtcdp: ['Rt', 26],
  target: ['Ta', 27],
  'aem-assets': ['As', 28],
  'adobe-express': ['Ex', 29],
  'firefly-creative-production': ['Fp', 30],
  'firefly-custom-models': ['Fc', 31],
  'firefly-foundry': ['Ff', 33],
  'firefly-graph': ['Fg', 34],
  'firefly-services': ['Fs', 35],
  'frame-io': ['Fr', 36],
  'learning-manager': ['Lm', 40],
  'substance-3d': ['Sb', 41],
  workfront: ['Wf', 42],
};

function fallbackSymbol(title) {
  const words = title.replace(/^Adobe\s+/i, '').split(/[^a-z0-9]+/i).filter(Boolean);
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').slice(0, 2) || '?';
}

function statusIcon(status) {
  const normalized = (status || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'beta') {
    return '<span class="nash-solutions-status nash-solutions-status-beta" title="Beta" aria-label="Beta">◐</span>';
  }
  if (normalized === 'earlyaccess' || normalized === 'preview') {
    return '<span class="nash-solutions-status nash-solutions-status-early" title="Early access" aria-label="Early access">✦</span>';
  }
  return '<span class="nash-solutions-status nash-solutions-status-live" title="Live" aria-label="Live">●</span>';
}

function buildCard(sol) {
  const card = document.createElement('a');
  card.className = 'nash-solutions-card';
  card.href = sol.path || '#';
  const [symbol, number] = SOLUTION_TILES[sol.slug] || [fallbackSymbol(sol.title), 0];
  const shortTitle = sol.title.replace(/^Adobe\s+/i, '');

  card.innerHTML = `
    <span class="nash-solutions-card-top">
      <span class="nash-solutions-number">${String(number).padStart(3, '0')}</span>
      ${statusIcon(sol.status)}
    </span>
    <strong class="nash-solutions-symbol">${symbol}</strong>
    <span class="nash-solutions-title">${shortTitle}</span>
  `;

  return card;
}

export default async function decorate(block) {
  let solutions = [];

  try {
    const resp = await fetch('/solutions/query.json');
    if (resp.ok) {
      const json = await resp.json();
      solutions = (json.data || [])
        .filter((row) => row.path && !row.path.endsWith('/') && row.path !== '/solutions/index')
        .map((row) => {
          const slug = row.path.split('/').pop();
          return {
            path: row.path,
            slug,
            title: (row.title || '').replace(/\s*\|.*$/, '').trim() || slug,
            status: row.status || 'active',
            signalcount: row.signalcount || '0',
            pillar: row.pillar || SOLUTION_PILLARS[slug] || '',
          };
        });
    }
  } catch {
    // no fallback — show empty state
  }

  block.innerHTML = `
    <div class="nash-solutions-header">
      <div>
        <h2 class="nash-solutions-heading">Solutions Files</h2>
        <p class="nash-solutions-subhead">Qualification knowledge organized around Adobe CX Enterprise pillars.</p>
      </div>
      <span class="nash-solutions-total">${solutions.length} solutions</span>
    </div>
    <div class="nash-solutions-legend" aria-label="Availability status">
      <span><i class="nash-solutions-status nash-solutions-status-live">●</i>Live</span>
      <span><i class="nash-solutions-status nash-solutions-status-beta">◐</i>Beta</span>
      <span><i class="nash-solutions-status nash-solutions-status-early">✦</i>Early access</span>
    </div>
    <div class="nash-solutions-groups" id="nash-solutions-groups"></div>
    ${solutions.length === 0 ? `<div class="nash-solutions-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <p>No solutions configured yet.</p>
    </div>` : ''}
  `;

  const groups = block.querySelector('#nash-solutions-groups');
  PILLARS.forEach((pillar) => {
    const pillarSolutions = solutions
      .filter((solution) => solution.pillar === pillar.id)
      .sort((a, b) => a.title.localeCompare(b.title));
    if (!pillarSolutions.length) return;

    const section = document.createElement('section');
    section.className = 'nash-solutions-group';
    section.setAttribute('aria-labelledby', `nash-solutions-${pillar.id}`);
    section.innerHTML = `
      <div class="nash-solutions-group-header">
        <h3 class="nash-solutions-group-title" id="nash-solutions-${pillar.id}">${pillar.name}</h3>
        <span class="nash-solutions-group-count">${pillarSolutions.length} solutions</span>
      </div>
      <div class="nash-solutions-grid"></div>
    `;
    const grid = section.querySelector('.nash-solutions-grid');
    pillarSolutions.forEach((solution) => grid.appendChild(buildCard(solution)));
    groups.appendChild(section);
  });

  const groupedSlugs = new Set(PILLARS.flatMap((pillar) => solutions
    .filter((solution) => solution.pillar === pillar.id)
    .map((solution) => solution.slug)));
  const uncategorized = solutions.filter((solution) => !groupedSlugs.has(solution.slug));
  if (uncategorized.length) {
    const section = document.createElement('section');
    section.className = 'nash-solutions-group';
    section.setAttribute('aria-labelledby', 'nash-solutions-other');
    section.innerHTML = `
      <div class="nash-solutions-group-header">
        <h3 class="nash-solutions-group-title" id="nash-solutions-other">Other solutions</h3>
        <span class="nash-solutions-group-count">${uncategorized.length} solutions</span>
      </div>
      <div class="nash-solutions-grid"></div>
    `;
    const grid = section.querySelector('.nash-solutions-grid');
    uncategorized.forEach((solution) => grid.appendChild(buildCard(solution)));
    groups.appendChild(section);
  }

  if (window.location.pathname.startsWith('/solutions')) {
    document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'Solutions Files' }, bubbles: true }));
  }
}
