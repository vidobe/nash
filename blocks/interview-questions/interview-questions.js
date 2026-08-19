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
export default function decorate(block) {
  const questions = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);
  block.textContent = '';

  const heading = document.createElement('h3');
  heading.className = 'interview-questions-title';
  heading.textContent = 'Interview questions';

  const list = document.createElement('ul');
  questions.forEach((q) => {
    const li = document.createElement('li');
    li.textContent = q;
    list.append(li);
  });

  block.append(heading, list);
}
