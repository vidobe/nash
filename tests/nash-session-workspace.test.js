/* eslint-env node, es2020 */
/* eslint-disable max-classes-per-file */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assessmentWorkspaceFor,
  assessmentWorkspaceGeometry,
  disposeAssessmentWorkspace,
  mountAssessmentWorkspace,
} from '../blocks/nash-session/nash-session-workspace.js';

class TrackedTarget extends EventTarget {
  constructor() {
    super();
    this.listeners = new Map();
  }

  addEventListener(type, listener, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    this.listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
  }
}

class TestStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value, priority = '') {
    this.values.set(name, { value, priority });
  }

  getPropertyValue(name) {
    return this.values.get(name)?.value || '';
  }

  getPropertyPriority(name) {
    return this.values.get(name)?.priority || '';
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

// Only DOM primitives used by the controller are modeled; no browser/layout dependency.
class TestElement extends TrackedTarget {
  constructor(doc, tag) {
    super();
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = new TestStyle();
    this.clientWidth = 1134;
    this.clientHeight = 800;
    this.scrollTop = 0;
    this.text = '';
    this.captured = new Set();
  }

  get parentElement() { return this.parentNode; }

  get nextSibling() {
    const siblings = this.parentNode?.children || [];
    return siblings[siblings.indexOf(this) + 1] || null;
  }

  get isConnected() { return this.ownerDocument.documentElement.contains(this); }

  get className() { return this.getAttribute('class') || ''; }

  set className(value) { this.setAttribute('class', value); }

  get id() { return this.getAttribute('id') || ''; }

  set id(value) { this.setAttribute('id', value); }

  get hidden() { return this.hasAttribute('hidden'); }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  get dataset() {
    return Object.fromEntries([...this.attributes]
      .filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [
        name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value,
      ]));
  }

  get classList() {
    return {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (name) => this.classList.toggle(name, true),
      remove: (name) => this.classList.toggle(name, false),
      toggle: (name, force = !this.classList.contains(name)) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (force) names.add(name);
        else names.delete(name);
        this.className = [...names].join(' ');
        return force;
      },
    };
  }

  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }

  set textContent(value) {
    this.replaceChildren();
    this.text = String(value);
  }

  set innerHTML(html) {
    this.replaceChildren();
    const stack = [this];
    const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
    tokens.forEach((token) => {
      if (token.startsWith('</')) {
        stack.pop();
      } else if (token.startsWith('<')) {
        const [, tag, attributes] = token.match(/^<([\w-]+)([^>]*)>/);
        const node = this.ownerDocument.createElement(tag);
        [...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].forEach(([, name, value]) => {
          node.setAttribute(name, value || '');
        });
        stack.at(-1).append(node);
        if (!token.endsWith('/>')) stack.push(node);
      } else {
        stack.at(-1).text += token;
      }
    });
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }

  hasAttribute(name) { return this.attributes.has(name); }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }

  removeAttribute(name) { this.attributes.delete(name); }

  append(...nodes) {
    nodes.forEach((node) => this.insertBefore(node, null));
  }

  prepend(node) { this.insertBefore(node, this.children[0] || null); }

  insertBefore(node, next) {
    node.remove();
    const index = next ? this.children.indexOf(next) : this.children.length;
    this.children.splice(index, 0, node);
    node.parentNode = this;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  replaceChildren(...nodes) {
    [...this.children].forEach((node) => node.remove());
    this.text = '';
    this.append(...nodes);
  }

  contains(node) {
    return this === node || this.children.some((child) => child.contains(node));
  }

  matches(selector) {
    const tag = selector.match(/^[\w-]+/)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map(([, name]) => name);
    if (!classes.every((name) => this.classList.contains(name))) return false;
    return [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)]
      .every(([, name, value]) => (value === undefined
        ? this.hasAttribute(name) : this.getAttribute(name) === value));
  }

  querySelectorAll(selector) {
    return this.children.flatMap((node) => [
      ...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector),
    ]);
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  closest(selector) {
    if (this.matches(selector)) return this;
    return this.parentNode?.closest(selector) || null;
  }

  cloneNode(deep) {
    const clone = this.ownerDocument.createElement(this.tagName);
    clone.attributes = new Map(this.attributes);
    clone.text = this.text;
    if (deep) clone.append(...this.children.map((node) => node.cloneNode(true)));
    return clone;
  }

  focus() { this.ownerDocument.activeElement = this; }

  close() { this.open = false; }

  setPointerCapture(id) { this.captured.add(id); }

  hasPointerCapture(id) { return this.captured.has(id); }

  releasePointerCapture(id) { this.captured.delete(id); }

  getBoundingClientRect() {
    return {
      top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight,
    };
  }
}

const element = (doc, tag, className = '') => {
  const node = doc.createElement(tag);
  node.className = className;
  return node;
};

function renderFixture(block, dialog = true) {
  const doc = block.ownerDocument;
  const report = element(doc, 'div', 'nash-session-assess');
  const title = element(doc, 'h1', 'nash-session-assess-title');
  title.textContent = 'Assessment';
  const head = element(doc, 'div', 'nash-session-assess-head');
  head.append(title);
  const panels = element(doc, 'div', 'nash-session-panels');
  const assessment = element(doc, 'div', 'nash-session-panel active');
  assessment.setAttribute('data-panel', 'assessment');
  const decision = element(doc, 'div', 'nash-session-panel');
  decision.setAttribute('data-panel', 'decision');
  const experiment = element(doc, 'div', 'nash-session-panel');
  experiment.setAttribute('data-panel', 'experiment');
  const scroll = element(doc, 'div', 'nash-session-assess-scroll');
  const all = element(doc, 'button', 'nash-session-dimension-filter active');
  all.setAttribute('data-dimension-index', 'all');
  const technical = element(doc, 'button', 'nash-session-dimension-filter');
  technical.setAttribute('data-dimension-index', '1');
  const technicalLabel = element(doc, 'span');
  technicalLabel.textContent = 'Technical Fit';
  technical.append(technicalLabel);
  scroll.append(all, technical);
  const shell = element(doc, 'div', 'nash-session-fluffy-shell');
  shell.hidden = true;
  const oldDialog = dialog ? element(doc, 'dialog', 'nash-session-fluffy-chat') : null;
  const thread = element(doc, 'div', 'nash-session-thread');
  const message = element(doc, 'article');
  thread.append(message);
  thread.setAttribute('aria-live', 'polite');
  if (oldDialog) {
    oldDialog.append(thread);
    shell.append(oldDialog);
  } else scroll.append(thread);
  const island = element(doc, 'div', 'nash-session-fluffy-island');
  const attachments = element(doc, 'div', 'nash-session-attachments');
  const form = element(doc, 'form', 'nash-session-composer');
  const composerMain = element(doc, 'div', 'nash-session-composer-main');
  const mark = element(doc, 'span', 'nash-session-pix');
  mark.id = 'original-pixel-mark';
  const input = element(doc, 'textarea', 'nash-session-input');
  input.value = 'Unsent draft';
  input.selectionStart = 3;
  const file = element(doc, 'input', 'nash-session-attach-input');
  file.files = Object.freeze([{ name: 'fixture.txt' }]);
  composerMain.append(mark, input);
  form.append(composerMain, file);
  island.append(attachments, form);
  shell.append(island);
  assessment.append(scroll, shell);
  panels.append(assessment, decision, experiment);
  report.append(head, panels);
  block.append(report);
  return {
    report,
    assessment,
    decision,
    experiment,
    all,
    technical,
    oldDialog,
    shell,
    scroll,
    thread,
    message,
    island,
    attachments,
    form,
    input,
    file,
    mark,
  };
}

function fixture(t, { dialog = true } = {}) {
  const doc = new TrackedTarget();
  doc.createElement = (tag) => new TestElement(doc, tag);
  doc.documentElement = doc.createElement('html');
  const body = element(doc, 'body');
  doc.documentElement.append(body);
  const main = element(doc, 'main');
  const section = element(doc, 'section');
  const wrapper = element(doc, 'div');
  const block = element(doc, 'div', 'nash-session wide');
  body.append(main);
  main.append(section);
  section.append(wrapper);
  wrapper.append(block);
  const observers = [];
  class TestObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      this.disconnected = false;
      observers.push(this);
    }

    observe(target) { this.targets.add(target); }

    disconnect() {
      this.disconnected = true;
      this.targets.clear();
    }
  }
  const frames = new Map();
  let frameId = 0;
  const view = new TrackedTarget();
  view.AbortController = globalThis.AbortController;
  view.ResizeObserver = TestObserver;
  view.MutationObserver = TestObserver;
  const frame = {
    background: 'linear-gradient(white, whitesmoke)',
    border: '1px solid rgb(228, 227, 223)',
    borderRadius: '24px',
    boxShadow: '0px 10px 34px rgba(17, 19, 24, 0.03)',
  };
  view.getComputedStyle = (_, pseudo) => (pseudo ? frame : { paddingTop: '18px' });
  view.requestAnimationFrame = (callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  };
  view.cancelAnimationFrame = (id) => frames.delete(id);
  doc.defaultView = view;
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  const content = renderFixture(block, dialog);
  t.after(() => disposeAssessmentWorkspace(block));
  return {
    doc, view, main, section, wrapper, block, observers, frames, frame, flush, ...content,
  };
}

function event(type, properties = {}) {
  return Object.assign(new Event(type, { cancelable: true }), properties);
}

test('horizontal geometry starts at exactly 492 usable pixels with both pane minima', () => {
  const result = assessmentWorkspaceGeometry({ width: 492, height: 800 });
  assert.deepEqual(result, {
    horizontal: true, minimum: 260, maximum: 260, size: 260, reportMinimum: 220,
  });
  assert.equal(assessmentWorkspaceGeometry({ width: 491.99, height: 800 }).horizontal, false);
});

test('uses 420px by default and the full available maximum without a 600px cap', () => {
  const width = 1440 - 240 - 22 - 44;
  const normal = assessmentWorkspaceGeometry({ width, height: 900 });
  const expanded = assessmentWorkspaceGeometry({ width, height: 900, expanded: true });
  assert.equal(normal.size, 420);
  assert.equal(expanded.size, 902);
  assert.equal(width - expanded.size - 12, 220);
  assert.ok(expanded.size > 700);
  assert.equal(assessmentWorkspaceGeometry({ width: 1600, expanded: true }).size, 1368);
});

test('clamps fractional bounds, invalid sizes and narrow heights without losing preferences', () => {
  [492, 492.25, 718, 1134, 1600].forEach((width) => {
    [-100, 0, 420, 900, Infinity, NaN].forEach((preferredWidth) => {
      const result = assessmentWorkspaceGeometry({ width, preferredWidth });
      assert.ok(result.size >= 260);
      assert.ok(result.size <= width - 220 - 12);
      assert.ok(Number.isInteger(result.size));
    });
  });
  [0, 100, 300, 800].forEach((height) => {
    const result = assessmentWorkspaceGeometry({ width: 300, height });
    assert.ok(Number.isFinite(result.size));
    assert.ok(result.size >= 0);
    assert.ok(result.minimum <= result.size && result.size <= result.maximum);
  });
  const preference = { preferredWidth: 900, width: 718 };
  assert.equal(assessmentWorkspaceGeometry(preference).size, 486);
  assert.equal(assessmentWorkspaceGeometry({ ...preference, width: 1134 }).size, 900);
  assert.equal(preference.preferredWidth, 900);
  assert.equal(assessmentWorkspaceGeometry({ width: NaN, height: Infinity }).size, 0);
});

test('stacked geometry has an adjustable normal-flow height and a separate height preference', () => {
  assert.deepEqual(assessmentWorkspaceGeometry({ width: 400, height: 800 }), {
    horizontal: false, minimum: 320, maximum: 608, size: 480, reportMinimum: 180,
  });
  assert.equal(assessmentWorkspaceGeometry({
    width: 400, height: 800, preferredHeight: 350, preferredWidth: 900,
  }).size, 350);
  assert.equal(assessmentWorkspaceGeometry({
    width: 400, height: 800, expanded: true,
  }).size, 608);
});

test('moves the actual thread and island into block-owned sibling panes, closed by default', (t) => {
  const f = fixture(t);
  const originalFiles = f.file.files;
  let submits = 0;
  f.form.addEventListener('submit', () => { submits += 1; });
  const controller = mountAssessmentWorkspace(f.block);
  const aside = f.block.querySelector('.nash-session-workspace__chat');
  const divider = f.block.querySelector('.nash-session-workspace__divider');
  const toggle = f.block.querySelector('.nash-session-workspace__toggle');
  assert.deepEqual(f.block.children, [f.report, divider, aside, toggle]);
  assert.equal(aside.tagName, 'ASIDE');
  assert.equal(f.thread.parentNode, aside);
  assert.equal(f.island.parentNode, aside);
  assert.equal(f.block.querySelector('.nash-session-input'), f.input);
  assert.equal(f.block.querySelector('.nash-session-attach-input').files, originalFiles);
  assert.equal(f.block.querySelector('.nash-session-composer'), f.form);
  assert.equal(f.thread.children[0], f.message);
  assert.equal(f.shell.isConnected, false);
  assert.equal(f.oldDialog.isConnected, false);
  assert.equal(toggle.getAttribute('aria-controls'), aside.id);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(aside.getAttribute('aria-labelledby'), aside.querySelector('h2').id);
  assert.equal(divider.getAttribute('role'), 'separator');
  assert.equal(divider.getAttribute('aria-valuemin'), '260');
  assert.equal(divider.getAttribute('aria-valuemax'), '902');
  assert.equal(f.thread.getAttribute('role'), 'log');
  assert.equal(f.thread.getAttribute('tabindex'), '0');
  assert.equal(aside.hasAttribute('aria-modal'), false);
  assert.equal(f.report.hasAttribute('inert'), false);
  assert.equal(controller.isOpen, false);
  assert.equal(aside.hidden, true);
  assert.equal(divider.hidden, true);
  f.form.dispatchEvent(event('submit'));
  assert.equal(submits, 1);
  assert.equal(f.input.value, 'Unsent draft');
  assert.equal(f.input.selectionStart, 3);
  assert.equal(f.mark.id, 'original-pixel-mark');
  assert.equal(aside.querySelector('.nash-session-pix').hasAttribute('id'), false);
  assert.equal(mountAssessmentWorkspace(f.block), controller);
  assert.equal(assessmentWorkspaceFor(f.block), controller);
  assert.equal(f.block.querySelectorAll('.nash-session-workspace__chat').length, 1);
});

test('toggles preserve draft, attachment, message and scroll state without stealing composer focus', (t) => {
  const f = fixture(t, { dialog: false });
  const controller = mountAssessmentWorkspace(f.block);
  const { files } = f.file;
  controller.open();
  f.input.focus();
  f.thread.scrollTop = 120;
  controller.open();
  assert.equal(f.doc.activeElement, f.input);
  controller.close();
  assert.equal(f.doc.activeElement, f.block.querySelector('.nash-session-workspace__toggle'));
  controller.toggle();
  assert.equal(f.thread.scrollTop, 120);
  f.input.focus();
  const escape = event('keydown', { key: 'Escape' });
  f.doc.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(controller.isOpen, false);
  assert.equal(f.doc.activeElement, f.block.querySelector('.nash-session-workspace__toggle'));
  assert.equal(f.input.value, 'Unsent draft');
  assert.equal(f.file.files, files);
  assert.equal(f.thread.children[0], f.message);
});

test('controller signal survives close/reopen and aborts once on destroy for per-render cleanup', (t) => {
  const f = fixture(t);
  const controller = mountAssessmentWorkspace(f.block);
  const { signal } = controller;
  const renderCleanup = new f.view.AbortController();
  let aborts = 0;
  signal.addEventListener('abort', () => {
    aborts += 1;
    renderCleanup.abort();
  }, { once: true });
  assert.ok(signal instanceof globalThis.AbortSignal);
  assert.equal(signal.aborted, false);
  controller.open();
  controller.open();
  controller.close();
  controller.toggle();
  controller.refresh();
  assert.equal(mountAssessmentWorkspace(f.block).signal, signal);
  assert.equal(signal.aborted, false);
  assert.equal(renderCleanup.signal.aborted, false);
  disposeAssessmentWorkspace(f.block);
  assert.equal(signal.aborted, true);
  assert.equal(renderCleanup.signal.aborted, true);
  assert.equal(aborts, 1);
  controller.destroy();
  disposeAssessmentWorkspace(f.block);
  assert.equal(aborts, 1);
  const next = mountAssessmentWorkspace(f.block);
  assert.notEqual(next.signal, signal);
  assert.equal(next.signal.aborted, false);
});

test('new replies arriving while closed reopen at the end of the conversation', (t) => {
  const f = fixture(t);
  const controller = mountAssessmentWorkspace(f.block);
  controller.open();
  f.thread.scrollTop = 120;
  controller.close();
  f.thread.scrollHeight = 900;
  const observer = f.observers.find((candidate) => candidate.targets.has(f.doc.documentElement));
  observer.callback([{ target: f.thread }]);
  controller.open();
  assert.equal(f.thread.scrollTop, 900);
});

test('context uses only the active report tab and visible dimension label', (t) => {
  const f = fixture(t);
  const controller = mountAssessmentWorkspace(f.block, { company: '<img src=x>' });
  const label = f.block.querySelector('.nash-session-workspace__context-view');
  assert.equal(controller.getContext(), 'Assessment overview');
  assert.equal(f.block.querySelector('.nash-session-workspace__company').textContent, '<img src=x>');
  assert.equal(f.block.querySelector('img'), null);
  f.all.classList.remove('active');
  f.technical.classList.add('active');
  f.block.dispatchEvent(event('click'));
  f.flush();
  assert.equal(controller.getContext(), 'Technical Fit');
  assert.equal(label.textContent, 'Technical Fit');
  f.assessment.classList.remove('active');
  f.decision.classList.add('active');
  controller.refresh();
  assert.equal(controller.getContext(), 'Decision quality');
  f.decision.classList.remove('active');
  f.experiment.classList.add('active');
  controller.refresh();
  assert.equal(label.textContent, 'Experimental report');
  assert.equal(f.island.parentNode, f.block.querySelector('.nash-session-workspace__chat'));
  assert.equal(f.block.querySelector('.nash-session-input'), f.input);
});

test('divider dragging has no initial jump, captures the pointer and supports keyboard/expand/reset', (t) => {
  const f = fixture(t);
  const controller = mountAssessmentWorkspace(f.block);
  controller.open();
  const divider = f.block.querySelector('.nash-session-workspace__divider');
  const expand = f.block.querySelector('.nash-session-workspace__expand');
  const size = () => Number(divider.getAttribute('aria-valuenow'));
  divider.dispatchEvent(event('pointerdown', { button: 0, pointerId: 7, clientX: 501 }));
  assert.equal(divider.hasPointerCapture(7), true);
  divider.dispatchEvent(event('pointermove', { pointerId: 7, clientX: 501 }));
  assert.equal(size(), 420);
  divider.dispatchEvent(event('pointermove', { pointerId: 99, clientX: 200 }));
  assert.equal(size(), 420);
  divider.dispatchEvent(event('pointermove', { pointerId: 7, clientX: 401 }));
  assert.equal(size(), 520);
  divider.dispatchEvent(event('pointerup', { pointerId: 7 }));
  assert.equal(divider.hasPointerCapture(7), false);
  assert.equal(f.block.classList.contains('nash-session--workspace-resizing'), false);
  divider.dispatchEvent(event('keydown', { key: 'End' }));
  assert.equal(size(), 902);
  divider.dispatchEvent(event('keydown', { key: 'Home' }));
  assert.equal(size(), 260);
  divider.dispatchEvent(event('keydown', { key: 'ArrowLeft' }));
  assert.equal(size(), 276);
  expand.dispatchEvent(event('click'));
  assert.equal(size(), 902);
  assert.equal(expand.getAttribute('aria-pressed'), 'true');
  expand.dispatchEvent(event('click'));
  assert.equal(size(), 276);
  divider.dispatchEvent(event('dblclick'));
  assert.equal(size(), 420);
});

test('resize observation clamps temporarily, preserves closed preferences and changes resize axis', (t) => {
  const f = fixture(t);
  const controller = mountAssessmentWorkspace(f.block);
  controller.open();
  const divider = f.block.querySelector('.nash-session-workspace__divider');
  divider.dispatchEvent(event('keydown', { key: 'End' }));
  controller.close();
  f.block.clientWidth = 718;
  f.observers[0].callback([]);
  f.flush();
  assert.equal(divider.getAttribute('aria-valuenow'), '486');
  f.block.clientWidth = 1134;
  f.observers[0].callback([]);
  f.flush();
  controller.open();
  assert.equal(divider.getAttribute('aria-valuenow'), '902');
  f.block.clientWidth = 400;
  f.observers[0].callback([]);
  f.flush();
  assert.equal(divider.getAttribute('aria-orientation'), 'horizontal');
  assert.equal(divider.getAttribute('aria-valuenow'), '480');
  divider.dispatchEvent(event('keydown', { key: 'ArrowUp' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '496');
  divider.dispatchEvent(event('keydown', { key: 'ArrowRight' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '496');
  divider.dispatchEvent(event('keydown', { key: 'Home' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '320');
  divider.dispatchEvent(event('keydown', { key: 'End' }));
  assert.equal(divider.getAttribute('aria-valuenow'), '608');
  divider.dispatchEvent(event('dblclick'));
  assert.equal(divider.getAttribute('aria-valuenow'), '480');
});

test('dispose restores original nodes and only owned styles/classes, with no listeners or observers left', (t) => {
  const f = fixture(t);
  f.main.classList.add('unrelated-state');
  f.main.style.setProperty('--nash-workspace-frame-radius', '18px', 'important');
  f.main.style.setProperty('color', 'red');
  const controller = mountAssessmentWorkspace(f.block);
  controller.open();
  f.thread.scrollTop = 75;
  f.block.dispatchEvent(event('click'));
  assert.equal(f.frames.size, 1);
  assert.equal(f.main.style.getPropertyValue('--nash-workspace-frame-background'), f.frame.background);
  f.main.style.setProperty('--nash-workspace-frame-border', '2px solid blue');
  disposeAssessmentWorkspace(f.block);
  disposeAssessmentWorkspace(f.block);
  controller.destroy();
  assert.equal(assessmentWorkspaceFor(f.block), null);
  assert.equal(f.thread.parentNode, f.oldDialog);
  assert.equal(f.island.parentNode, f.shell);
  assert.equal(f.thread.scrollTop, 75);
  assert.equal(f.thread.hasAttribute('role'), false);
  assert.equal(f.thread.getAttribute('aria-live'), 'polite');
  assert.equal(f.main.classList.contains('nash-session-workspace--active'), false);
  assert.equal(f.main.classList.contains('unrelated-state'), true);
  assert.equal(f.block.className, 'nash-session wide');
  assert.equal(f.main.style.getPropertyValue('color'), 'red');
  assert.equal(f.main.style.getPropertyValue('--nash-workspace-frame-radius'), '18px');
  assert.equal(f.main.style.getPropertyPriority('--nash-workspace-frame-radius'), 'important');
  assert.equal(f.main.style.getPropertyValue('--nash-workspace-frame-border'), '2px solid blue');
  assert.equal(f.main.style.getPropertyValue('--nash-workspace-frame-background'), '');
  assert.equal(f.block.style.getPropertyValue('--nash-workspace-panel-size'), '');
  assert.equal(f.wrapper.classList.contains('nash-session-workspace__host'), false);
  assert.equal(f.frames.size, 0);
  assert.ok(f.observers.every((observer) => observer.disconnected));
  assert.equal(f.block.listenerCount, 0);
  assert.equal(f.doc.listenerCount, 0);
  assert.equal(f.view.listenerCount, 0);
  assert.ok(mountAssessmentWorkspace(f.block));
});

test('disconnecting the block or replacing report/aside tears down automatically', (t) => {
  ['block', 'report', 'aside', 'replacement'].forEach((target) => {
    const f = fixture(t);
    const controller = mountAssessmentWorkspace(f.block);
    controller.open();
    if (target === 'replacement') f.block.innerHTML = '<div>Intake</div>';
    else if (target === 'aside') f.block.querySelector('.nash-session-workspace__chat').remove();
    else f[target].remove();
    f.observers[1].callback([{ target: f.main, type: 'childList' }]);
    assert.equal(controller.signal.aborted, true, target);
    assert.equal(assessmentWorkspaceFor(f.block), null, target);
    assert.equal(f.main.classList.contains('nash-session-workspace--active'), false, target);
    assert.equal(f.doc.listenerCount, 0, target);
    assert.equal(f.view.listenerCount, 0, target);
    assert.ok(f.observers.every((observer) => observer.disconnected), target);
    assert.equal(f.block.querySelector('.nash-session-workspace__toggle'), null, target);
  });
});

test('an old observer cannot remove a newer workspace on the same main', (t) => {
  const f = fixture(t);
  const first = mountAssessmentWorkspace(f.block);
  const staleObserver = f.observers[1];
  const secondBlock = element(f.doc, 'div', 'nash-session wide');
  f.wrapper.append(secondBlock);
  renderFixture(secondBlock);
  t.after(() => disposeAssessmentWorkspace(secondBlock));
  const second = mountAssessmentWorkspace(secondBlock);
  second.open();
  first.destroy();
  staleObserver.callback([{ target: f.main, type: 'childList' }]);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
  assert.equal(assessmentWorkspaceFor(f.block), null);
  assert.equal(assessmentWorkspaceFor(secondBlock), second);
  assert.equal(f.main.classList.contains('nash-session-workspace--active'), true);
  assert.equal(second.isOpen, true);
});

test('mount/dispose tolerate intake, incomplete and detached markup without adding a workspace', (t) => {
  const f = fixture(t);
  f.block.replaceChildren();
  assert.equal(mountAssessmentWorkspace(f.block), null);
  assert.equal(mountAssessmentWorkspace(null), null);
  disposeAssessmentWorkspace(null);
  renderFixture(f.block);
  f.block.remove();
  assert.equal(mountAssessmentWorkspace(f.block), null);
  assert.equal(f.main.classList.contains('nash-session-workspace--active'), false);
  assert.equal(f.observers.length, 0);
});

test('the obsolete floating composer stays hidden until its controls move into the report pane', (t) => {
  const f = fixture(t, { dialog: false });
  assert.equal(f.shell.hidden, true);
  const controller = mountAssessmentWorkspace(f.block);
  controller.open();
  assert.equal(f.island.parentNode.hidden, false);
  assert.equal(f.shell.isConnected, false);
  assert.equal(f.block.querySelector('.nash-session-input'), f.input);
  controller.destroy();
  assert.equal(f.shell.hidden, true);

  const css = readFileSync(new URL('../blocks/nash-session/nash-session.css', import.meta.url), 'utf8');
  const shell = css.match(/\.nash-session \.nash-session-fluffy-shell \{([^}]+)\}/)[1];
  assert.match(shell, /display: none/);
  assert.doesNotMatch(shell, /position: fixed/);
  assert.doesNotMatch(css, /padding-bottom: (?:112|96)px/);
  const source = readFileSync(new URL('../blocks/nash-session/nash-session.js', import.meta.url), 'utf8');
  assert.match(source, /<div class="nash-session-fluffy-shell" hidden>/);
});

test('workspace CSS defines real grid tracks, reserved gutter and report-container reflow, not an overlay', () => {
  const css = readFileSync(new URL('../blocks/nash-session/nash-session.css', import.meta.url), 'utf8');
  const workspace = css.slice(css.indexOf('/* Assessment workspace:'));
  assert.match(workspace, /grid-template-columns: minmax\(0, 1fr\) 12px var\(--nash-workspace-panel-size/);
  assert.match(workspace, /grid-template-rows: minmax\(0, 1fr\) 12px var\(--nash-workspace-panel-size/);
  assert.match(workspace, /padding-right: 44px/);
  assert.match(workspace, /right: 6px/);
  assert.match(workspace, /height: 100dvh/);
  assert.match(workspace, /container: nash-session-report \/ inline-size/);
  assert.match(workspace, /@container nash-session-report \(width < 720px\)/);
  const pane = workspace.match(/> \.nash-session-workspace__chat \{([^}]+)\}/)[1];
  assert.match(pane, /position: relative/);
  assert.doesNotMatch(pane, /position: (?:fixed|absolute)|inset:/);
  assert.doesNotMatch(workspace, /backdrop|600px|aria-modal/);
});
