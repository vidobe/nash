/* eslint-disable no-use-before-define */

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  layers: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  compare: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>',
  attach: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  send: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
};

const PROMPTS = [
  { icon: 'plus', text: 'Create a new analysis', prompt: 'Start a new qualification. I want to assess an RFP for AEM.' },
  { icon: 'search', text: 'Find a previous analysis', prompt: 'Show me my previous qualifications.' },
  { icon: 'layers', text: 'Summarize a skills file', prompt: 'Summarize the latest AEM skills file for me.' },
  { icon: 'compare', text: 'Compare two opportunities', prompt: 'Help me compare two opportunities side by side.' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
}

function render(block, name) {
  block.innerHTML = `
    <div class="nash-session-hero">
      <div class="nash-session-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>
      </div>
      <h1 class="nash-session-greeting">${greeting()}, ${name}</h1>
      <p class="nash-session-sub">How can I help you qualify today?</p>

      <form class="nash-session-composer" autocomplete="off">
        <textarea class="nash-session-input" rows="1" placeholder="Ask Nash anything, or describe the opportunity…" aria-label="Message Nash"></textarea>
        <div class="nash-session-toolbar">
          <button type="button" class="nash-session-icon-btn" aria-label="Attach a document">${ICONS.attach}</button>
          <button type="submit" class="nash-session-send" aria-label="Send message" disabled>${ICONS.send}</button>
        </div>
      </form>

      <div class="nash-session-prompts">
        ${PROMPTS.map((p) => `
          <button type="button" class="nash-session-chip" data-prompt="${p.prompt}">
            <span class="nash-session-chip-icon" aria-hidden="true">${ICONS[p.icon]}</span>
            ${p.text}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="nash-session-thread" hidden aria-live="polite"></div>
  `;
}

function addMessage(thread, role, text) {
  const msg = document.createElement('div');
  msg.className = `nash-session-msg ${role}`;
  if (role === 'assistant') {
    msg.innerHTML = `<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble">${text}</div>`;
  } else {
    msg.innerHTML = `<div class="nash-session-bubble">${text}</div>`;
  }
  thread.append(msg);
  thread.scrollTop = thread.scrollHeight;
  return msg;
}

function typingIndicator(thread) {
  const msg = document.createElement('div');
  msg.className = 'nash-session-msg assistant';
  msg.innerHTML = '<div class="nash-session-avatar" aria-hidden="true">N</div><div class="nash-session-bubble"><span class="nash-session-typing"><i></i><i></i><i></i></span></div>';
  thread.append(msg);
  thread.scrollTop = thread.scrollHeight;
  return msg;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function send(block, text) {
  const value = text.trim();
  if (!value) return;

  const hero = block.querySelector('.nash-session-hero');
  const thread = block.querySelector('.nash-session-thread');
  const input = block.querySelector('.nash-session-input');

  // transition from hero to conversation
  hero.classList.add('compact');
  thread.hidden = false;

  addMessage(thread, 'user', escapeHtml(value));
  input.value = '';
  autoResize(input);
  block.querySelector('.nash-session-send').disabled = true;

  const typing = typingIndicator(thread);

  // placeholder response until FluffyJaws is wired in
  window.setTimeout(() => {
    typing.remove();
    addMessage(
      thread,
      'assistant',
      'I’m connected and ready — once the FluffyJaws assessment endpoint is live I’ll start qualifying right here. For now this is the conversational shell.',
    );
  }, 900);

  document.dispatchEvent(new CustomEvent('nash:session-message', { detail: { text: value }, bubbles: true }));
}

/**
 * loads and decorates the nash-session block
 * Claude-style conversational home. No authored content required.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const name = 'Vitor';
  render(block, name);

  const form = block.querySelector('.nash-session-composer');
  const input = block.querySelector('.nash-session-input');
  const sendBtn = block.querySelector('.nash-session-send');

  input.addEventListener('input', () => {
    autoResize(input);
    sendBtn.disabled = input.value.trim().length === 0;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(block, input.value);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(block, input.value);
  });

  block.querySelectorAll('.nash-session-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      send(block, chip.dataset.prompt);
    });
  });
}
