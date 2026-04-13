/**
 * loads and decorates the nash-topbar block
 *
 * Content model (all rows optional):
 *   Row 1: User full name | user email
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  // Read session for real name/email if available
  let sessionName = '';
  let sessionEmail = '';
  try {
    const auth = JSON.parse(localStorage.getItem('nash-auth') || 'null');
    if (auth) {
      sessionName = auth.name || '';
      sessionEmail = auth.email || '';
    }
  } catch { /* ignore */ }

  // Fall back to authored content, then hard defaults
  const firstRow = block.querySelector(':scope > div');
  const cells = firstRow ? [...firstRow.querySelectorAll(':scope > div')] : [];
  const userName = sessionName || cells[0]?.textContent.trim() || 'VG Gabriel';
  const userEmail = sessionEmail || cells[1]?.textContent.trim() || 'vgabriel@adobe.com';

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
    <div class="nash-topbar-right">
      <button class="nash-topbar-new-btn" type="button" aria-label="Start new analysis">
        <svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        New Analysis
      </button>
      <div class="nash-topbar-avatar-wrap">
        <button class="nash-topbar-avatar" type="button"
          aria-label="User menu" aria-haspopup="true" aria-expanded="false">
          ${initials}
        </button>
        <div class="nash-topbar-dropdown" role="menu" hidden>
          <div class="nash-topbar-dropdown-user">
            <span class="nash-topbar-dropdown-name">${userName}</span>
            <span class="nash-topbar-dropdown-email">${userEmail}</span>
          </div>
          <hr class="nash-topbar-dropdown-divider"/>
          <button class="nash-topbar-dropdown-item nash-topbar-signout" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  `;

  block.querySelector('.nash-topbar-new-btn').addEventListener('click', () => {
    window.location.href = '/new-analysis';
  });

  // Avatar dropdown toggle
  const avatarBtn = block.querySelector('.nash-topbar-avatar');
  const dropdown = block.querySelector('.nash-topbar-dropdown');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !dropdown.hidden;
    dropdown.hidden = open;
    avatarBtn.setAttribute('aria-expanded', String(!open));
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.hidden = true;
    avatarBtn.setAttribute('aria-expanded', 'false');
  });

  // Sign out
  block.querySelector('.nash-topbar-signout').addEventListener('click', () => {
    localStorage.removeItem('nash-auth');
    window.location.href = '/login';
  });

  // Allow other blocks to update the page title via custom event
  document.addEventListener('nash:page-title', (e) => {
    const titleEl = block.querySelector('[data-nash-page-title]');
    if (titleEl && e.detail?.title) titleEl.textContent = e.detail.title;
  });
}
