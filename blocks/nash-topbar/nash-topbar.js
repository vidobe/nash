/**
 * loads and decorates the nash-topbar block
 *
 * Content model (all rows optional):
 *   Row 1: User full name | user email
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  // Extract optional user info from authored content
  const firstRow = block.querySelector(':scope > div');
  const cells = firstRow ? [...firstRow.querySelectorAll(':scope > div')] : [];
  const userName = cells[0]?.textContent.trim() || 'VG Gabriel';
  const userEmail = cells[1]?.textContent.trim() || 'vgabriel@adobe.com';

  // Build 2-letter initials from user name
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  block.innerHTML = `
    <div class="nash-topbar__left">
      <a class="nash-topbar__brand" href="/" aria-label="Nash home">
        <span class="nash-topbar__adobe-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adobe">
            <rect width="20" height="20" rx="2" fill="#eb1000"/>
            <polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>
          </svg>
        </span>
        <span class="nash-topbar__wordmark">Nash</span>
        <span class="nash-topbar__subtitle">/ AEM Qualifier</span>
      </a>
    </div>
    <div class="nash-topbar__center">
      <span class="nash-topbar__page-title" data-nash-page-title>Overview</span>
    </div>
    <div class="nash-topbar__right">
      <button class="nash-topbar__new-btn" type="button" aria-label="Start new analysis">
        <svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        New Analysis
      </button>
      <button class="nash-topbar__avatar" type="button" aria-label="User profile: ${userName}" title="${userName} — ${userEmail}">${initials}</button>
    </div>
  `;

  // Broadcast new-analysis intent so sidebar/chat can respond
  block.querySelector('.nash-topbar__new-btn').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('nash:new-analysis', { bubbles: true }));
  });

  // Allow other blocks to update the page title via custom event
  document.addEventListener('nash:page-title', (e) => {
    const titleEl = block.querySelector('[data-nash-page-title]');
    if (titleEl && e.detail?.title) titleEl.textContent = e.detail.title;
  });
}
