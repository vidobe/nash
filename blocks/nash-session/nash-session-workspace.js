const workspaces = new WeakMap();
const mainOwners = new WeakMap();
const workspaceClasses = [
  'nash-session--workspace',
  'nash-session--workspace-open',
  'nash-session--workspace-stacked',
  'nash-session--workspace-resizing',
];
let nextWorkspaceId = 0;

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/**
 * Sizes use the block's usable content box, not the viewport or the sidebar width.
 * Preferences are deliberately not overwritten when a smaller workspace clamps them.
 */
export function assessmentWorkspaceGeometry({
  width = 0, height = 0, preferredWidth = 420, preferredHeight = null, expanded = false,
} = {}) {
  const availableWidth = Math.max(0, finite(width, 0));
  const availableHeight = Math.max(0, finite(height, 0));
  const horizontal = availableWidth >= 492;
  const available = horizontal ? availableWidth : availableHeight;
  const reportMinimum = horizontal ? 220 : Math.min(180, availableHeight * 0.35);
  const maximum = Math.max(0, Math.floor(available - reportMinimum - 12));
  const minimum = Math.min(horizontal ? 260 : 320, maximum);
  const preferred = horizontal
    ? finite(preferredWidth, 420) : finite(preferredHeight, availableHeight * 0.6);
  const size = expanded ? maximum : Math.max(minimum, Math.min(maximum, Math.round(preferred)));
  return {
    horizontal, minimum, maximum, size, reportMinimum,
  };
}

function ownStyles(element) {
  const properties = new Map();
  return {
    set(name, value) {
      if (!properties.has(name)) {
        properties.set(name, {
          value: element.style.getPropertyValue(name),
          priority: element.style.getPropertyPriority(name),
        });
      }
      const property = properties.get(name);
      property.assigned = value;
      if (element.style.getPropertyValue(name) !== value
        || element.style.getPropertyPriority(name)) element.style.setProperty(name, value);
    },
    restore() {
      properties.forEach((property, name) => {
        if (element.style.getPropertyValue(name) !== property.assigned
          || element.style.getPropertyPriority(name)) return;
        if (property.value) element.style.setProperty(name, property.value, property.priority);
        else element.style.removeProperty(name);
      });
    },
  };
}

function positionOf(node) {
  return { node, parent: node.parentNode, next: node.nextSibling };
}

function restorePosition({ node, parent, next }) {
  parent.insertBefore(node, next?.parentNode === parent ? next : null);
}

const shortLabel = (label) => String(label || '').replace(/\s+/g, ' ').trim().slice(0, 80);

function reportContext(report) {
  const panel = report.querySelector('.nash-session-panel.active[data-panel]');
  const name = panel?.dataset.panel;
  if (!name || name === 'assessment') {
    const filter = panel?.querySelector('.nash-session-dimension-filter.active');
    if (!filter || filter.dataset.dimensionIndex === 'all') return 'Assessment overview';
    return shortLabel(filter.querySelector('span')?.textContent
      || filter.getAttribute('aria-label') || filter.textContent) || 'Assessment overview';
  }
  if (name === 'decision') return 'Decision quality';
  if (name === 'experiment') return 'Experimental report';
  const tab = [...report.querySelectorAll('.nash-session-tab[data-tab]')]
    .find((candidate) => candidate.dataset.tab === name);
  return shortLabel(tab?.getAttribute('aria-label') || tab?.getAttribute('title')
    || tab?.textContent) || 'Assessment overview';
}

/** Returns null after an assessment has been replaced or disconnected. */
export function assessmentWorkspaceFor(block) {
  const entry = workspaces.get(block);
  if (!entry) return null;
  if (!entry.isValid()) {
    entry.controller.destroy();
    return null;
  }
  return entry.controller;
}

export function disposeAssessmentWorkspace(block) {
  workspaces.get(block)?.controller.destroy();
}

/**
 * Mount after rendering the assessment and before wiring its existing composer.
 * No form, input, upload, message, or request handler is owned by this controller.
 * The controller signal aborts on teardown, including DOM replacement, never on close.
 * Returns null when the connected assessment DOM is not yet available.
 */
export function mountAssessmentWorkspace(block, { company } = {}) {
  const current = assessmentWorkspaceFor(block);
  if (current) {
    if (company !== undefined) workspaces.get(block).setCompany(company);
    current.refresh();
    return current;
  }
  const main = block?.closest('main');
  const report = block?.querySelector('.nash-session-assess');
  const thread = block?.querySelector('.nash-session-thread');
  const island = block?.querySelector('.nash-session-fluffy-island');
  if (!block?.isConnected || !main || !report || !thread || !island) return null;
  mainOwners.get(main)?.controller.destroy();

  const doc = block.ownerDocument;
  const view = doc.defaultView;
  const lifecycle = new view.AbortController();
  const mainStyles = ownStyles(main);
  const blockStyles = ownStyles(block);
  const mainClass = 'nash-session-workspace--active';
  const hadMainClass = main.classList.contains(mainClass);
  const originalClasses = workspaceClasses.map((name) => [name, block.classList.contains(name)]);
  const hosts = [];
  for (let host = block.parentElement; host && host !== main; host = host.parentElement) {
    hosts.push([host, host.classList.contains('nash-session-workspace__host')]);
    host.classList.add('nash-session-workspace__host');
  }
  const originalReportPosition = positionOf(report);
  const originalPositions = [positionOf(thread), positionOf(island)];
  const oldDialog = thread.closest('dialog');
  const oldShell = island.closest('.nash-session-fluffy-shell');
  const removed = [];
  const attributes = [];
  const listeners = [];
  let companyLabel = company;
  let open = false;
  let destroyed = false;
  let expanded = false;
  let preferredWidth = 420;
  let preferredHeight = null;
  let { scrollTop } = thread;
  let unread = false;
  let drag = null;
  let animationFrame = null;
  let resizeObserver;
  let mutationObserver;
  let entry;

  nextWorkspaceId += 1;
  const id = `nash-assessment-workspace-${nextWorkspaceId}`;
  const launcher = doc.createElement('button');
  launcher.type = 'button';
  launcher.className = 'nash-session-workspace__toggle';
  launcher.setAttribute('aria-controls', id);
  launcher.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">
    <path class="nash-session-workspace__toggle-pane" d="M12.5 3.5H16a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-3.5Z"/>
    <rect x="3" y="3" width="14" height="14" rx="2"/><path d="M12 3v14"/>
  </svg>`;
  const divider = doc.createElement('div');
  divider.className = 'nash-session-workspace__divider';
  divider.hidden = true;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('tabindex', '0');
  divider.setAttribute('aria-label', 'Resize Fluffy panel');
  divider.setAttribute('aria-controls', id);
  const aside = doc.createElement('aside');
  aside.id = id;
  aside.className = 'nash-session-workspace__chat';
  aside.hidden = true;
  aside.setAttribute('aria-labelledby', `${id}-title`);
  aside.innerHTML = `
    <header class="nash-session-workspace__head">
      <div class="nash-session-workspace__identity">
        <div><h2 id="${id}-title">Fluffy</h2><p>Your assessment copilot</p></div>
      </div>
      <button type="button" class="nash-session-workspace__expand">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/>
        </svg>
      </button>
    </header>
    <div class="nash-session-workspace__context">
      <span class="nash-session-workspace__context-dot" aria-hidden="true"></span>
      <span class="nash-session-workspace__company"></span>
      <span class="nash-session-workspace__context-divider" aria-hidden="true">/</span>
      <span class="nash-session-workspace__context-view"></span>
    </div>`;
  const mark = block.querySelector('.nash-session-pix')?.cloneNode(true);
  if (mark) {
    mark.removeAttribute('id');
    mark.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    aside.querySelector('.nash-session-workspace__identity').prepend(mark);
  }
  const expand = aside.querySelector('.nash-session-workspace__expand');
  const companyNode = aside.querySelector('.nash-session-workspace__company');
  const contextDivider = aside.querySelector('.nash-session-workspace__context-divider');
  const contextNode = aside.querySelector('.nash-session-workspace__context-view');

  function defaultAttribute(name, value) {
    if (thread.hasAttribute(name)) return;
    thread.setAttribute(name, value);
    attributes.push([name, value]);
  }
  defaultAttribute('role', 'log');
  defaultAttribute('aria-live', 'polite');
  defaultAttribute('aria-label', 'Fluffy conversation');
  defaultAttribute('tabindex', '0');

  aside.append(thread, island);
  if (oldDialog && block.contains(oldDialog)) {
    if (oldDialog.open) oldDialog.close();
    removed.push(positionOf(oldDialog));
    oldDialog.remove();
  }
  if (oldShell && block.contains(oldShell) && !oldShell.children.length) {
    removed.push(positionOf(oldShell));
    oldShell.remove();
  }
  if (report.parentNode !== block) block.append(report);
  block.append(divider, aside, launcher);

  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  }

  function isValid() {
    return !destroyed && block.isConnected && main.contains(block)
      && report.parentNode === block && aside.parentNode === block
      && divider.parentNode === block && launcher.parentNode === block
      && aside.contains(thread) && aside.contains(island)
      && workspaces.get(block) === entry && mainOwners.get(main) === entry;
  }

  function finishDrag(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const { id: pointerId } = drag;
    drag = null;
    block.classList.remove('nash-session--workspace-resizing');
    if (divider.hasPointerCapture?.(pointerId)) divider.releasePointerCapture(pointerId);
  }

  function destroy() {
    if (destroyed) return;
    if (open) scrollTop = thread.scrollTop;
    destroyed = true;
    finishDrag();
    if (animationFrame !== null) view.cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    listeners.forEach((remove) => remove());
    if (workspaces.get(block) === entry) {
      if (block.contains(report)) {
        [...removed].reverse().forEach((position) => {
          if (report.contains(position.parent)) restorePosition(position);
        });
        originalPositions.forEach((position) => {
          if (aside.contains(position.node) && report.contains(position.parent)) {
            restorePosition(position);
          }
        });
        if (originalReportPosition.parent !== block
          && block.contains(originalReportPosition.parent)) restorePosition(originalReportPosition);
      }
      attributes.forEach(([name, value]) => {
        if (thread.getAttribute(name) === value) thread.removeAttribute(name);
      });
      thread.scrollTop = scrollTop;
      launcher.remove();
      divider.remove();
      aside.remove();
      blockStyles.restore();
      originalClasses.forEach(([name, present]) => block.classList.toggle(name, present));
      workspaces.delete(block);
    }
    if (mainOwners.get(main) === entry) {
      mainStyles.restore();
      main.classList.toggle(mainClass, hadMainClass);
      hosts.forEach(([host, present]) => {
        host.classList.toggle('nash-session-workspace__host', present);
      });
      mainOwners.delete(main);
    }
    lifecycle.abort();
  }

  function live() {
    if (isValid()) return true;
    destroy();
    return false;
  }

  function geometry() {
    return assessmentWorkspaceGeometry({
      width: block.clientWidth,
      height: block.clientHeight,
      preferredWidth,
      preferredHeight,
      expanded,
    });
  }

  function syncFrame() {
    const style = view.getComputedStyle(main);
    const frame = view.getComputedStyle(main, '::before');
    mainStyles.set('--nash-workspace-frame-background', frame.background);
    mainStyles.set('--nash-workspace-frame-border', frame.border);
    mainStyles.set('--nash-workspace-frame-radius', frame.borderRadius);
    mainStyles.set('--nash-workspace-frame-shadow', frame.boxShadow);
    const top = main.getBoundingClientRect().top + (Number.parseFloat(style.paddingTop) || 0);
    mainStyles.set('--nash-workspace-top', `${Math.max(0, top)}px`);
  }

  function refresh() {
    if (!live()) return;
    const metrics = geometry();
    if (drag && drag.horizontal !== metrics.horizontal) finishDrag();
    syncFrame();
    blockStyles.set('--nash-workspace-panel-size', `${metrics.size}px`);
    block.classList.toggle('nash-session--workspace-stacked', !metrics.horizontal);
    divider.setAttribute('aria-orientation', metrics.horizontal ? 'vertical' : 'horizontal');
    divider.setAttribute('aria-valuemin', String(metrics.minimum));
    divider.setAttribute('aria-valuemax', String(metrics.maximum));
    divider.setAttribute('aria-valuenow', String(metrics.size));
    divider.setAttribute('aria-valuetext', `${metrics.size} pixel Fluffy ${metrics.horizontal ? 'width' : 'height'}`);
    divider.title = `Drag, or use the ${metrics.horizontal ? 'left and right' : 'up and down'} arrow keys`;
    expand.setAttribute('aria-label', expanded ? 'Restore Fluffy panel' : 'Expand Fluffy panel');
    expand.setAttribute('aria-pressed', String(expanded));
    expand.title = expand.getAttribute('aria-label');
    const label = shortLabel(companyLabel === undefined
      ? report.querySelector('.nash-session-assess-title')?.textContent : companyLabel);
    if (companyNode.textContent !== label) companyNode.textContent = label;
    companyNode.hidden = !label;
    contextDivider.hidden = !label;
    const context = reportContext(report);
    if (contextNode.textContent !== context) contextNode.textContent = context;
  }

  function scheduleRefresh() {
    if (destroyed || animationFrame !== null) return;
    animationFrame = view.requestAnimationFrame(() => {
      animationFrame = null;
      refresh();
    });
  }

  function setOpen(value) {
    if (!live() || open === value) return;
    if (!value) {
      scrollTop = thread.scrollTop;
      finishDrag();
    }
    open = value;
    block.classList.toggle('nash-session--workspace-open', open);
    aside.hidden = !open;
    divider.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close Fluffy panel' : 'Open Fluffy panel');
    launcher.title = launcher.getAttribute('aria-label');
    refresh();
    if (open) {
      thread.scrollTop = unread ? thread.scrollHeight : scrollTop;
      unread = false;
    } else launcher.focus({ preventScroll: true });
  }

  function resizeTo(value) {
    if (!live()) return;
    const metrics = geometry();
    const size = Math.max(metrics.minimum, Math.min(metrics.maximum, Math.round(value)));
    expanded = false;
    if (metrics.horizontal) preferredWidth = size;
    else preferredHeight = size;
    refresh();
  }

  const controller = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    refresh,
    destroy,
    getContext: () => (live() ? reportContext(report) : 'Assessment overview'),
    get isOpen() { return isValid() && open; },
    get signal() { return lifecycle.signal; },
  };
  entry = {
    controller, isValid, setCompany: (value) => { companyLabel = value; },
  };
  workspaces.set(block, entry);
  mainOwners.set(main, entry);
  syncFrame();
  main.classList.add(mainClass);
  block.classList.add('nash-session--workspace');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-label', 'Open Fluffy panel');
  launcher.title = 'Open Fluffy panel';

  listen(launcher, 'click', controller.toggle);
  listen(expand, 'click', () => {
    expanded = !expanded;
    refresh();
  });
  listen(block, 'click', scheduleRefresh);
  listen(doc, 'keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !open || !live() || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    controller.close();
  });
  listen(divider, 'pointerdown', (event) => {
    if (!open || event.button !== 0 || event.isPrimary === false || !live()) return;
    const metrics = geometry();
    drag = {
      id: event.pointerId,
      horizontal: metrics.horizontal,
      start: metrics.horizontal ? event.clientX : event.clientY,
      size: metrics.size,
    };
    try {
      divider.setPointerCapture(event.pointerId);
    } catch (error) {
      finishDrag();
      if (error.name !== 'NotFoundError') throw error;
      return;
    }
    block.classList.add('nash-session--workspace-resizing');
    divider.focus({ preventScroll: true });
    event.preventDefault();
  });
  listen(divider, 'pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const coordinate = drag.horizontal ? event.clientX : event.clientY;
    resizeTo(drag.size + drag.start - coordinate);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
    listen(divider, type, finishDrag);
  });
  listen(divider, 'keydown', (event) => {
    if (!open || !live()) return;
    const metrics = geometry();
    const increase = metrics.horizontal ? 'ArrowLeft' : 'ArrowUp';
    const decrease = metrics.horizontal ? 'ArrowRight' : 'ArrowDown';
    if (event.key === increase || event.key === decrease) {
      event.preventDefault();
      resizeTo(metrics.size + (event.key === increase ? 16 : -16));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      resizeTo(event.key === 'Home' ? metrics.minimum : metrics.maximum);
    }
  });
  listen(divider, 'dblclick', () => {
    preferredWidth = 420;
    preferredHeight = null;
    expanded = false;
    refresh();
  });
  listen(view, 'resize', scheduleRefresh);
  listen(view, 'blur', () => finishDrag());
  if (view.ResizeObserver) {
    resizeObserver = new view.ResizeObserver(scheduleRefresh);
    resizeObserver.observe(main);
    resizeObserver.observe(block);
  }
  if (view.MutationObserver) {
    mutationObserver = new view.MutationObserver((records) => {
      if (!live()) return;
      if (!open && records.some(({ target }) => thread.contains(target))) unread = true;
      if (records.some(({ target, attributeName }) => (
        attributeName === 'data-theme' || report.contains(target)
      ))) scheduleRefresh();
    });
    mutationObserver.observe(doc.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'],
    });
    mutationObserver.observe(report, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'hidden'],
    });
  }
  refresh();
  return controller;
}
