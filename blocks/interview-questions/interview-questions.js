/**
 * interview-questions block
 *
 * Authored by solution experts in the DA solution doc. Each row is one
 * discovery question. Nash reads these (from the page's plain.html) and folds
 * them into the pre-assessment interview for any assessment where this solution
 * is in scope. On the solution page itself we render them as a titled list.
 *
 * Authored structure (one question per row):
 *   | Interview Questions |
 *   | Is the storefront headless or traditional (EDS/PWA)? |
 *   | Catalog size and monthly order volume? |
 */
const ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>';

export default function decorate(block) {
  const questions = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);
  block.textContent = '';

  const heading = document.createElement('h3');
  heading.className = 'interview-questions-title';
  heading.innerHTML = `${ICON}<span>Interview questions</span>`;

  const list = document.createElement('ul');
  questions.forEach((q) => {
    const li = document.createElement('li');
    li.textContent = q;
    list.append(li);
  });

  block.append(heading, list);
}
