/**
 * nash-feedback block
 * prompt.chat-style feedback interface.
 *
 * Content model:
 *   Row 1: Funny/custom message shown above the chat (authored in DA)
 *
 * @param {Element} block
 */

const NASH_AVATAR = '<svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="20" height="20" rx="3" fill="#eb1000"/><polygon points="10,3.5 16.5,16.5 10,12.5 3.5,16.5" fill="white"/></svg>';

const QUICK_ACTIONS = [
  { label: '🐛 Report a bug', prompt: 'I found a bug I want to report.' },
  { label: '💡 Suggest a feature', prompt: 'I have a feature idea.' },
  { label: '😤 Something is broken', prompt: "Something isn't working as expected." },
  { label: '👏 Give a compliment', prompt: 'I just wanted to say something nice.' },
];

const RESPONSES = {
  bug: "Got it — bugs are not welcome here 🪲 Tell me exactly what happened, what you expected, and what URL you were on. I'll make sure it gets logged.",
  feature: 'Ooh, ideas! Nash loves ideas 💡 Describe the feature — what problem does it solve and who would use it?',
  broken: 'Ugh, the worst 😤 Walk me through what broke — steps to reproduce, browser, and any error messages you saw.',
  compliment: "Don't stop, I could do this all day 😊 What made your day?",
  default: 'Thanks for reaching out! Tell me more — the more detail you give, the faster we can act on it.',
};

function pickResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('bug') || t.includes('error') || t.includes('crash')) return RESPONSES.bug;
  if (t.includes('feature') || t.includes('idea') || t.includes('suggest')) return RESPONSES.feature;
  if (t.includes('broken') || t.includes('broke') || t.includes("doesn't work") || t.includes('not working')) return RESPONSES.broken;
  if (t.includes('great') || t.includes('love') || t.includes('nice') || t.includes('compliment') || t.includes('awesome')) return RESPONSES.compliment;
  return RESPONSES.default;
}

function buildMessage(role, text, animate) {
  const msg = document.createElement('div');
  msg.className = `nash-fb-msg nash-fb-msg-${role}${animate ? ' nash-fb-msg-in' : ''}`;

  if (role === 'nash') {
    msg.innerHTML = `
      <div class="nash-fb-avatar nash">${NASH_AVATAR}</div>
      <div class="nash-fb-bubble nash">${text}</div>
    `;
  } else {
    msg.innerHTML = `
      <div class="nash-fb-bubble user">${text}</div>
      <div class="nash-fb-avatar user" aria-hidden="true">VG</div>
    `;
  }
  return msg;
}

function buildTyping() {
  const el = document.createElement('div');
  el.className = 'nash-fb-msg nash-fb-msg-nash nash-fb-msg-in';
  el.id = 'nash-fb-typing';
  el.innerHTML = `
    <div class="nash-fb-avatar nash">${NASH_AVATAR}</div>
    <div class="nash-fb-bubble nash nash-fb-typing">
      <span></span><span></span><span></span>
    </div>
  `;
  return el;
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div > div')];
  const funnyMsg = rows[0]?.innerHTML.trim() || 'Your feedback shapes Nash. No pressure, but the whole product is basically waiting on you. 😅';

  let actionsUsed = false;

  block.innerHTML = `
    <div class="nash-fb-shell">
      <div class="nash-fb-banner">${funnyMsg}</div>
      <div class="nash-fb-chat" id="nash-fb-chat" role="log" aria-live="polite" aria-label="Feedback chat"></div>
      <div class="nash-fb-composer">
        <div class="nash-fb-composer-inner">
          <textarea
            class="nash-fb-input"
            id="nash-fb-input"
            placeholder="Type your feedback…"
            rows="1"
            aria-label="Feedback message"
          ></textarea>
          <div class="nash-fb-composer-toolbar">
            <span class="nash-fb-hint">Press <kbd>↵</kbd> to send &nbsp;·&nbsp; <kbd>Shift ↵</kbd> for new line</span>
            <button class="nash-fb-send" id="nash-fb-send" type="button" aria-label="Send feedback" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const chat = block.querySelector('#nash-fb-chat');
  const input = block.querySelector('#nash-fb-input');
  const sendBtn = block.querySelector('#nash-fb-send');

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function appendMessage(role, text, animate = true) {
    chat.appendChild(buildMessage(role, text, animate));
    scrollToBottom();
  }

  function showTyping() {
    chat.appendChild(buildTyping());
    scrollToBottom();
  }

  function hideTyping() {
    block.querySelector('#nash-fb-typing')?.remove();
  }

  function send(text) {
    const msg = text.trim();
    if (!msg) return;
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', msg);

    showTyping();
    setTimeout(() => {
      hideTyping();
      const reply = pickResponse(msg);
      appendMessage('nash', reply);
    }, 900 + Math.random() * 600);
  }

  function buildQuickActions() {
    const wrap = document.createElement('div');
    wrap.className = 'nash-fb-actions';
    wrap.id = 'nash-fb-actions';
    QUICK_ACTIONS.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'nash-fb-action-btn';
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        wrap.remove();
        send(action.prompt);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  // Welcome message
  setTimeout(() => {
    appendMessage('nash', "Hey! 👋 I'm Nash's feedback channel. What's on your mind — bug, idea, or just want to rant a little?", true);
    setTimeout(() => {
      if (!actionsUsed) {
        chat.appendChild(buildQuickActions());
        scrollToBottom();
      }
    }, 400);
  }, 300);

  // Input handling
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        actionsUsed = true;
        block.querySelector('#nash-fb-actions')?.remove();
        send(input.value);
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    actionsUsed = true;
    block.querySelector('#nash-fb-actions')?.remove();
    send(input.value);
  });

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'Feedback Hub' }, bubbles: true }));
}
