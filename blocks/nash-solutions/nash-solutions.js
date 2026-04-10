/**
 * loads and decorates the nash-solutions block
 * Fetches /solutions/query.json for solution cards.
 * Each solution document provides: title, description, status, productcount, lastUpdated
 * @param {Element} block The block element
 */

function statusBadge(status) {
  if ((status || '').toLowerCase() === 'active') {
    return '<span class="nash-solutions-badge active">Active</span>';
  }
  return '<span class="nash-solutions-badge beta">Beta</span>';
}

function buildCard(sol) {
  const card = document.createElement('a');
  card.className = 'nash-solutions-card';
  card.href = sol.path || '#';

  card.innerHTML = `
    <div class="nash-solutions-card-header">
      <div class="nash-solutions-logo" aria-hidden="true">${sol.logo || sol.title.charAt(0)}</div>
      <div class="nash-solutions-card-meta">
        ${statusBadge(sol.status)}
      </div>
    </div>
    <div class="nash-solutions-card-body">
      <h3 class="nash-solutions-title">${sol.title}</h3>
      <p class="nash-solutions-desc">${sol.description || ''}</p>
    </div>
    <div class="nash-solutions-card-footer">
      <span class="nash-solutions-stat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${sol.signalcount || '0'} signals
      </span>
      <span class="nash-solutions-stat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${sol.productcount || '0'} products
      </span>
      <span class="nash-solutions-configure">
        Configure
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </span>
    </div>
  `;

  return card;
}

export default async function decorate(block) {
  let solutions = [];

  try {
    const resp = await fetch('/solutions/query.json');
    if (resp.ok) {
      const json = await resp.json();
      solutions = (json.data || []).map((row) => ({
        path: row.path,
        title: (row.title || '').replace(/\s*\|.*$/, '').trim() || row.path.split('/').pop(),
        description: row.description || '',
        status: row.status || 'active',
        signalcount: row.signalcount || '0',
        productcount: row.productcount || '0',
        logo: row.logo || '',
      }));
    }
  } catch {
    // no fallback — show empty state
  }

  block.innerHTML = `
    <div class="nash-solutions-header">
      <div>
        <h2 class="nash-solutions-heading">Solutions Files</h2>
        <p class="nash-solutions-subhead">Manage the qualification knowledge base for each solution. Nash uses these files to score opportunities.</p>
      </div>
    </div>
    <div class="nash-solutions-grid" id="nash-solutions-grid"></div>
    ${solutions.length === 0 ? `<div class="nash-solutions-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <p>No solutions configured yet.</p>
    </div>` : ''}
  `;

  const grid = block.querySelector('#nash-solutions-grid');
  solutions.forEach((sol) => grid.appendChild(buildCard(sol)));

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'Solutions Files' }, bubbles: true }));
}
