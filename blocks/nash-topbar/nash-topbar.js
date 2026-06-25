/**
 * loads and decorates the nash-topbar block
 *
 * Content model (all rows optional):
 *   Row 1: User full name | user email
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  block.innerHTML = `
    <div class="nash-topbar-left">
      <a class="nash-topbar-brand" href="/" aria-label="Nash home">
        <span class="nash-topbar-adobe-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adobe">
            <rect width="20" height="20" rx="2" fill="#eb1000"/>
            <polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/>
          </svg>
        </span>
        <span class="nash-topbar-wordmark">Nash</span>
        <span class="nash-topbar-subtitle">/ Solution Qualifier</span>
      </a>
    </div>
    <div class="nash-topbar-center">
      <span class="nash-topbar-page-title" data-nash-page-title>Overview</span>
    </div>
    <div class="nash-topbar-right"></div>
  `;

  // Allow other blocks to update the page title via custom event
  document.addEventListener('nash:page-title', (e) => {
    const titleEl = block.querySelector('[data-nash-page-title]');
    if (titleEl && e.detail?.title) titleEl.textContent = e.detail.title;
  });
}
