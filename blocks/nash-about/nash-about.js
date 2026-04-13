/**
 * nash-about block
 *
 * Content model — each row: [type] | [col2] | [col3]
 *
 *   headline  | More or less everything about Nash.
 *   lead      | Nash helps sales teams...
 *   sub       | Built because...
 *   builder   | Max        | Co-creator  | #eb1000
 *   stat      | 27         | pages in his PhD dissertation, 1950
 *   section   | Why the name Nash?
 *   quote     | "Given what..." | Nash Equilibrium, simplified
 *   text      | Every AEM deal is a game...
 *   fact      | 01 | Title of fact | Body text of fact
 *   step      | 1  | Ingest        | Upload RFI, RFP...
 *   stack     | AEM EDS | Document Authoring | Claude
 *
 * @param {Element} block
 */

function cell(row, idx) {
  return row.children[idx]?.innerHTML.trim() || '';
}

function text(row, idx) {
  return row.children[idx]?.textContent.trim() || '';
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  const data = {
    headline: '',
    lead: '',
    sub: '',
    builders: [],
    stats: [],
    sections: [],
    stack: [],
  };

  let currentSection = null;

  rows.forEach((row) => {
    const type = text(row, 0).toLowerCase();

    if (type === 'headline') {
      data.headline = cell(row, 1);
    } else if (type === 'lead') {
      data.lead = cell(row, 1);
    } else if (type === 'sub') {
      data.sub = cell(row, 1);
    } else if (type === 'builder') {
      data.builders.push({
        name: text(row, 1),
        role: text(row, 2),
        color: text(row, 3) || '#111318',
      });
    } else if (type === 'stat') {
      data.stats.push({ num: text(row, 1), label: cell(row, 2) });
    } else if (type === 'section') {
      currentSection = { title: cell(row, 1), items: [] };
      data.sections.push(currentSection);
    } else if (type === 'quote' && currentSection) {
      currentSection.items.push({ kind: 'quote', quote: cell(row, 1), cite: text(row, 2) });
    } else if (type === 'text' && currentSection) {
      currentSection.items.push({ kind: 'text', html: cell(row, 1) });
    } else if (type === 'fact' && currentSection) {
      currentSection.items.push({
        kind: 'fact', idx: text(row, 1), title: cell(row, 2), body: cell(row, 3),
      });
    } else if (type === 'step' && currentSection) {
      currentSection.items.push({
        kind: 'step', num: text(row, 1), title: cell(row, 2), body: cell(row, 3),
      });
    } else if (type === 'stack') {
      data.stack = [...row.children].slice(1).map((c) => c.textContent.trim()).filter(Boolean);
    }
  });

  function renderItems(items) {
    return items.map((item) => {
      if (item.kind === 'quote') {
        return `
          <blockquote class="nash-about-quote">
            ${item.quote}
            ${item.cite ? `<cite>${item.cite}</cite>` : ''}
          </blockquote>
        `;
      }
      if (item.kind === 'text') {
        return `<p>${item.html}</p>`;
      }
      if (item.kind === 'fact') {
        return `
          <div class="nash-about-fact">
            <span class="nash-about-fact-idx">${item.idx}</span>
            <div>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </div>
          </div>
        `;
      }
      if (item.kind === 'step') {
        return `
          <div class="nash-about-step">
            <div class="nash-about-step-num">${item.num}</div>
            <div>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </div>
          </div>
        `;
      }
      return '';
    }).join('');
  }

  block.innerHTML = `
    <div class="nash-about-masthead">
      <div class="nash-about-masthead-left">
        <p class="nash-about-eyebrow">Named after a legend</p>
        <h1 class="nash-about-headline">${data.headline}</h1>
      </div>
      <div class="nash-about-masthead-right">
        ${data.lead ? `<p class="nash-about-masthead-lead">${data.lead}</p>` : ''}
        ${data.sub ? `<p class="nash-about-masthead-sub">${data.sub}</p>` : ''}
        ${data.builders.length ? `
          <div class="nash-about-builders">
            ${data.builders.map((b) => `
              <div class="nash-about-builder">
                <div class="nash-about-builder-av" style="background:${b.color}">${b.name.charAt(0)}</div>
                <div>
                  <div class="nash-about-builder-name">${b.name}</div>
                  <div class="nash-about-builder-role">${b.role}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>

    ${data.stats.length ? `
      <div class="nash-about-stats">
        ${data.stats.map((s) => `
          <div class="nash-about-stat">
            <span class="nash-about-stat-num">${s.num}</span>
            <span class="nash-about-stat-label">${s.label}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${data.sections.map((s) => `
      <div class="nash-about-row">
        <h2 class="nash-about-row-label">${s.title}</h2>
        <div class="nash-about-row-content">
          ${renderItems(s.items)}
        </div>
      </div>
    `).join('')}

    ${data.stack.length ? `
      <div class="nash-about-stack">
        <span class="nash-about-stack-label">Built with</span>
        <div class="nash-about-stack-chips">
          ${data.stack.map((c) => `<span class="nash-about-chip">${c}</span>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'About Nash' }, bubbles: true }));
}
