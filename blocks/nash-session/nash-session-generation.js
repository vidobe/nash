const PHASES = {
  preparing: 'Preparing your source material',
  assessment: 'Assessing fit and recommendations',
  requirements: 'Reviewing your requirements',
  review: 'Checking the final recommendation',
};

export function generationDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function generationStatus({
  phase = 'preparing', reviewed = 0, total = 0, startedAt, lastActivityAt, now, retry,
}) {
  if (!Object.hasOwn(PHASES, phase)) throw new Error(`Unknown generation phase: ${phase}`);
  const idle = Math.max(0, now - lastActivityAt);
  const waiting = idle >= 90000;
  let note = 'Keep this page open. Your assessment will appear here when it is ready.';
  if (waiting) note = 'No recent update has arrived. Keep this page open while we wait for the next update.';
  else if (retry) note = `The connection dropped, so this step restarted automatically (attempt ${retry.attempt} of ${retry.maxAttempts}). Keep this page open.`;
  return {
    phase: phase === 'requirements' && total > 0
      ? `${PHASES[phase]} (${reviewed} of ${total})` : PHASES[phase],
    waiting,
    status: waiting ? 'Waiting for an update' : 'Running',
    elapsed: `${generationDuration(now - startedAt)} elapsed`,
    updated: idle < 2000 ? 'Updated just now' : `Last update ${generationDuration(idle)} ago`,
    note,
  };
}

export function createGenerationProgress(host, { title = 'Generating your assessment' } = {}) {
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const root = doc.createElement('section');
  root.className = 'nash-session-generation';
  root.setAttribute('aria-label', 'Assessment generation');
  root.innerHTML = `
    <div class="nash-session-generation__status" role="status" aria-live="polite">
      <span class="nash-session-generation__indicator" aria-hidden="true"></span>
      <span class="nash-session-generation__badge"></span>
    </div>
    <h2 class="nash-session-generation__title"></h2>
    <p class="nash-session-generation__phase" role="status" aria-live="polite"></p>
    <p class="nash-session-generation__note"></p>
    <p class="nash-session-generation__timing" aria-live="off">
      <span class="nash-session-generation__elapsed"></span>
      <span class="nash-session-generation__updated"></span>
    </p>
    <details class="nash-session-generation__details" hidden>
      <summary>Error details</summary>
      <p class="nash-session-generation__error"></p>
    </details>
    <button class="nash-session-btn-primary nash-session-generation__retry" type="button" hidden>Try again</button>`;
  host.replaceChildren(root);
  const find = (name) => root.querySelector(`.nash-session-generation__${name}`);
  const badge = find('badge');
  const heading = find('title');
  const phaseNode = find('phase');
  const note = find('note');
  const elapsed = find('elapsed');
  const updated = find('updated');
  const retry = find('retry');
  const startedAt = Date.now();
  let lastActivityAt = startedAt;
  let progress = { phase: 'preparing' };
  let retryState = null;
  let terminal = false;
  let disposed = false;
  let timer;
  const text = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const stop = () => view.clearInterval(timer);
  const dispose = () => {
    disposed = true;
    stop();
    retry.onclick = null;
  };
  const render = () => {
    if (disposed || terminal) return;
    if (!root.isConnected) { dispose(); return; }
    const state = generationStatus({
      ...progress, startedAt, lastActivityAt, now: Date.now(), retry: retryState,
    });
    root.dataset.state = state.waiting ? 'waiting' : 'running';
    root.setAttribute('aria-busy', 'true');
    text(badge, state.status);
    text(phaseNode, state.phase);
    text(elapsed, state.elapsed);
    text(updated, state.updated);
    text(note, state.note);
  };
  const pulse = () => {
    if (terminal || disposed) return;
    lastActivityAt = Date.now();
    if (root.dataset.state === 'waiting') render();
  };
  const finish = (state, message) => {
    terminal = true;
    stop();
    root.dataset.state = state;
    root.setAttribute('aria-busy', 'false');
    text(elapsed, `${generationDuration(Date.now() - startedAt)} elapsed`);
    updated.hidden = true;
    text(phaseNode, message);
  };
  heading.textContent = title;
  timer = view.setInterval(render, 1000);
  render();
  return {
    root,
    pulse,
    update(value) {
      if (terminal || disposed) return;
      progress = value;
      retryState = null;
      pulse();
      render();
    },
    reconnecting({ attempt, maxAttempts }) {
      if (terminal || disposed) return;
      retryState = { attempt, maxAttempts };
      pulse();
      render();
    },
    complete() {
      if (disposed) return;
      finish('complete', 'Your assessment is ready.');
      text(badge, 'Complete');
      text(heading, 'Assessment complete');
      text(note, '');
    },
    fail(message, onRetry) {
      if (disposed) return;
      finish('error', 'No incomplete report has been saved.');
      text(badge, 'Not completed');
      text(heading, 'We could not finish the assessment');
      text(note, 'You can try again. Any existing report has not been replaced.');
      find('details').hidden = false;
      find('error').textContent = message;
      retry.hidden = !onRetry;
      retry.onclick = onRetry || null;
    },
    dispose,
  };
}
