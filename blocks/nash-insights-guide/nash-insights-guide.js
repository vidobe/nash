/**
 * nash-insights-guide block — under construction placeholder.
 * @param {Element} block
 */
export default async function decorate(block) {
  block.innerHTML = `
    <div class="nash-guide-shell">
      <div class="nash-guide-badge">Coming soon</div>
      <h1 class="nash-guide-title">The Insights Guide<br>is being written.</h1>
      <p class="nash-guide-sub">
        Ironically, the people who built a tool to generate reports faster<br>
        have not yet found the time to document how to use it.
      </p>
      <p class="nash-guide-sub2">
        Nash would have had this finished in 27 pages by age 21.<br>
        We are not Nash.
      </p>
      <div class="nash-guide-eta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ETA: soon&trade;
      </div>
    </div>
  `;

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'Insights Guide' }, bubbles: true }));
}
