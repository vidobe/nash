/*
 * FluffyJaws client — Adobe's internal AI gateway.
 * Streams qualification responses over SSE from the public /api/v1/stream route.
 *
 * Auth: a PKCE Okta user token (scope `fluffyjaws`), refreshed by nash-auth.js.
 * Without a token, the development placeholder is explicitly marked as a mock.
 *
 * Docs: https://fluffyjaws.adobe.com/docs/api
 */

import { ensureFreshToken } from './nash-auth.js';

const FJ_BASE_URL = 'https://api.fluffyjaws.adobe.com';
const MODEL = 'gpt-5.4';

// Optional FluffyPack slug for focused context. Leave empty for plain chat —
// sending a slug that doesn't exist makes /api/v1/stream return 404.
const FLUFFYPACK_SLUG = '';

const AUTH_KEY = 'nash-fj-auth';

/** Returns a valid FluffyJaws access token, or null if unauthenticated/expired. */
export function getToken() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    if (auth && auth.accessToken && Date.now() < auth.expires) return auth.accessToken;
  } catch {
    // fall through
  }
  return null;
}

/** True when a live FluffyJaws token is present. */
export function isConnected() {
  return getToken() !== null;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

/*
 * Return false from onEvent to stop reading at a terminal response event.
 * A transport EOF or [DONE] marker alone does not establish successful completion.
 */
async function readSSE(response, onEvent, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let ended = false;
  const cancel = () => { reader.cancel().catch(() => {}); };
  const dispatch = (chunk) => {
    throwIfAborted(signal);
    let eventName = 'message';
    const dataLines = [];
    chunk.split(/\r?\n/).forEach((line) => {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    });
    if (['ping', 'heartbeat', 'keepalive', 'keep-alive'].includes(eventName)) return true;
    if (!dataLines.length) {
      if (eventName.startsWith('response.') || eventName === 'error') {
        throw new Error('Malformed FluffyJaws stream event.');
      }
      return true;
    }
    const raw = dataLines.join('\n');
    if (raw === '[DONE]') return onEvent('done', null) !== false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Malformed FluffyJaws stream event.');
    }
    return onEvent(eventName, data) !== false;
  };

  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      throwIfAborted(signal);
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      buffer += decoder.decode(value, { stream: !done });
      if (done) ended = true;

      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop();
      if (!chunks.every(dispatch)) return;
      if (done) {
        if (buffer) dispatch(buffer);
        return;
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (!ended) cancel();
    reader.releaseLock();
  }
}

/* Dev fallback: streams a focused placeholder response token-by-token. */
async function mockStream({ onDelta, onDone, signal }) {
  const text = 'I’m the qualification assistant. Once FluffyJaws is connected I’ll '
    + 'analyse the opportunity against your Solutions Files and return a fit score, '
    + 'verdict, red flags, and recommended AEM products. Attach an RFI/RFP or describe '
    + 'the deal to begin.';
  const words = text.split(' ');
  // eslint-disable-next-line no-restricted-syntax
  for (const word of words) {
    throwIfAborted(signal);
    onDelta(`${word} `);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 28); });
  }
  throwIfAborted(signal);
  onDone({ responseId: null, model: null, mock: true });
}

/**
 * Streams a qualification turn from FluffyJaws.
 * @param {object} opts
 * @param {Array} opts.messages chat messages [{ role, content }]
 * @param {string} [opts.previousResponseId] continue an existing thread
 * @param {(delta:string)=>void} opts.onDelta called with each text chunk
 * @param {(meta:object)=>void} [opts.onDone] live completion metadata:
 *   { responseId, model, requestedModel, mock: false }; placeholders have mock: true
 * @param {(err:Error)=>void} [opts.onError] called once on failure, never with onDone
 * @param {AbortSignal} [opts.signal] abort the stream
 */
const TOOL_LABELS = {
  field_readiness_sharepoint_search: 'Searching Adobe Field Readiness…',
  experience_league_documentation_search: 'Searching Experience League docs…',
  sharepoint_search: 'Searching Adobe SharePoint…',
  web_search: 'Searching the web…',
};

function toolLabel(name) {
  return TOOL_LABELS[name] || `Looking up ${(name || 'sources').replace(/_/g, ' ')}…`;
}

function responseError(data) {
  const response = data.response || data;
  const reason = response.incomplete_details?.reason || data.incomplete_details?.reason;
  const error = response.error || data.error;
  if (reason === 'content_filter' || error?.code === 'content_filter'
    || data.code === 'content_filter') return new Error('content_filter');
  if (reason) return new Error(`Run stopped early (${reason}).`);
  return new Error(error?.message || (typeof error === 'string' && error) || data.message
    || 'FluffyJaws response failed or was incomplete.');
}

export async function streamQualification({
  messages, previousResponseId, onDelta, onThinking = () => {}, onActivity = () => {},
  onDone = () => {}, onError = () => {}, signal, webSearch = false, canvasMode = false,
  reasoningEffort,
} = {}) {
  const requestedModel = MODEL;
  let terminal = false;
  const complete = (meta) => {
    throwIfAborted(signal);
    if (terminal) return;
    terminal = true;
    onDone({ ...meta, requestedModel });
  };

  try {
    throwIfAborted(signal);
    const token = await ensureFreshToken();
    throwIfAborted(signal);
    if (!token) {
      await mockStream({ onDelta, onDone: complete, signal });
      return;
    }

    const body = {
      model: requestedModel,
      messages,
      canvasMode,
      webSearchEnabled: webSearch,
    };
    if (reasoningEffort) body.reasoningEffort = reasoningEffort;
    if (FLUFFYPACK_SLUG) body.fluffyPackSlug = FLUFFYPACK_SLUG;
    if (previousResponseId) body.previousResponseId = previousResponseId;

    const response = await fetch(`${FJ_BASE_URL}/api/v1/stream`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`FluffyJaws request failed (${response.status})`);
    }

    let responseId = null;
    let model = null;
    const items = new Map();
    const emitted = new Set();

    await readSSE(response, (eventName, data) => {
      if (eventName === 'done' && data === null) {
        throw new Error('FluffyJaws stream ended before response.completed.');
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)
        || (data.type !== undefined && typeof data.type !== 'string')
        || (data.response !== undefined
          && (!data.response || typeof data.response !== 'object' || Array.isArray(data.response)))) {
        throw new Error('Malformed FluffyJaws stream event.');
      }
      const type = data.type || eventName;
      if ((eventName.startsWith('response.') || eventName === 'error')
        && data.type && type !== eventName) {
        throw new Error('Malformed FluffyJaws stream event.');
      }
      const details = data.response || data;
      if (type === 'error' || type === 'response.failed' || type === 'response.incomplete'
        || (type === 'response.completed' && (details.error || details.incomplete_details
          || (details.status && details.status !== 'completed')))) {
        throw responseError(data);
      }
      if (['response.created', 'response.in_progress', 'response.completed'].includes(type)) {
        const id = details.id || details.response_id || details.responseId
          || data.response_id || data.responseId;
        const reportedModel = details.model || data.model;
        if ((id != null && typeof id !== 'string')
          || (reportedModel != null && typeof reportedModel !== 'string')) {
          throw new Error('Malformed FluffyJaws stream event.');
        }
        responseId = id || responseId;
        model = reportedModel || model;
      }
      if (type === 'response.output_item.added' || type === 'response.output_item.done') {
        const { item } = data;
        if (!item || typeof item !== 'object' || Array.isArray(item)
          || (!item.id && !Number.isInteger(data.output_index))) {
          throw new Error('Malformed FluffyJaws stream event.');
        }
        const state = { ...(items.get(item.id) || items.get(data.output_index)), ...item };
        if (item.id) items.set(item.id, state);
        if (Number.isInteger(data.output_index)) items.set(data.output_index, state);
      }
      if (type === 'tool_executing') onActivity(toolLabel(data.tool_name));
      if (type === 'tool_complete') onActivity('Reviewing findings…');
      if (type === 'response.output_text.delta' || type === 'response.output_text.done') {
        const delta = type === 'response.output_text.delta';
        const text = delta ? data.delta : data.text;
        if (typeof text !== 'string') throw new Error('Malformed FluffyJaws stream event.');
        const item = items.get(data.item_id) || items.get(data.output_index);
        const phase = data.phase || item?.phase;
        const thinking = item?.type === 'reasoning'
          || ['commentary', 'analysis', 'reasoning'].includes(phase);
        const itemKey = item?.id || data.item_id || (data.output_index ?? 'answer');
        const key = `${itemKey}:${data.content_index ?? 0}`;
        if (text && (delta || !emitted.has(key))) {
          emitted.add(key);
          if (thinking) onThinking(text);
          else onDelta(text);
        }
      }
      if (type === 'response.completed') {
        complete({ responseId, model, mock: false });
        return false;
      }
      return true;
    }, signal);
    if (!terminal) throw new Error('FluffyJaws stream ended before response.completed.');
  } catch (err) {
    if (!terminal) {
      terminal = true;
      onError(err);
    }
  }
}
