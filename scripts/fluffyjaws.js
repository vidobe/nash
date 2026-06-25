/*
 * FluffyJaws client — Adobe's internal AI gateway.
 * Streams qualification responses over SSE from the public /api/v1/stream route.
 *
 * Auth: a PKCE Okta user token (scope `fluffyjaws`) stored in localStorage under
 * `nash-fj-auth` as { accessToken, expires }. Until the Okta app is live, getToken()
 * returns null and the client falls back to a local mock stream so the UI works in dev.
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

/*
 * Parses an SSE byte stream, invoking onEvent(eventName, data) for each event.
 * FluffyJaws follows the OpenAI Responses SSE shape: `event:` + `data:` line pairs.
 */
async function readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop();

    chunks.forEach((chunk) => {
      let eventName = 'message';
      const dataLines = [];
      chunk.split('\n').forEach((line) => {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      });
      if (!dataLines.length) return;
      const raw = dataLines.join('\n');
      if (raw === '[DONE]') {
        onEvent('done', null);
        return;
      }
      try {
        onEvent(eventName, JSON.parse(raw));
      } catch {
        // ignore unparseable keep-alive lines
      }
    });
  }
}

/* Dev fallback: streams a focused placeholder response token-by-token. */
async function mockStream({ onDelta, onDone }) {
  const text = 'I’m the qualification assistant. Once FluffyJaws is connected I’ll '
    + 'analyse the opportunity against your Solutions Files and return a fit score, '
    + 'verdict, red flags, and recommended AEM products. Attach an RFI/RFP or describe '
    + 'the deal to begin.';
  const words = text.split(' ');
  // eslint-disable-next-line no-restricted-syntax
  for (const word of words) {
    onDelta(`${word} `);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 28); });
  }
  onDone({ responseId: null, mock: true });
}

/**
 * Streams a qualification turn from FluffyJaws.
 * @param {object} opts
 * @param {Array} opts.messages chat messages [{ role, content }]
 * @param {string} [opts.previousResponseId] continue an existing thread
 * @param {(delta:string)=>void} opts.onDelta called with each text chunk
 * @param {(meta:object)=>void} [opts.onDone] called once on completion
 * @param {(err:Error)=>void} [opts.onError] called on failure
 * @param {AbortSignal} [opts.signal] abort the stream
 */
export async function streamQualification({
  messages, previousResponseId, onDelta, onThinking = () => {}, onDone = () => {},
  onError = () => {}, signal, webSearch = false, canvasMode = false, reasoningEffort,
} = {}) {
  const token = await ensureFreshToken();

  if (!token) {
    await mockStream({ onDelta, onDone });
    return;
  }

  try {
    const body = {
      model: MODEL,
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

    let responseId = previousResponseId || null;
    let sawDelta = false;
    let finished = false;
    const phases = {}; // item_id → phase ('commentary' = thinking, else = answer)
    const seen = {};
    const finish = () => { if (!finished) { finished = true; onDone({ responseId }); } };

    await readSSE(response, (eventName, data) => {
      if (!data) {
        if (eventName === 'done') finish();
        return;
      }
      const type = data.type || eventName;
      seen[type] = (seen[type] || 0) + 1;
      if (type === 'response.created' || type === 'response.completed') {
        responseId = data.response?.id || data.id || responseId;
      }
      if (type === 'response.output_item.added' && data.item?.id) {
        phases[data.item.id] = data.item.phase || 'answer';
        // eslint-disable-next-line no-console
        console.log('[fluffyjaws] item added — phase:', data.item.phase, 'id:', data.item.id);
      }
      if (type === 'response.output_text.delta' && typeof data.delta === 'string') {
        if (phases[data.item_id] === 'commentary') {
          onThinking(data.delta);
        } else {
          sawDelta = true;
          onDelta(data.delta);
        }
      }
      if (type === 'response.output_text.done' && !sawDelta && typeof data.text === 'string'
        && phases[data.item_id] !== 'commentary') {
        onDelta(data.text);
      }
      if (type === 'response.completed') {
        // eslint-disable-next-line no-console
        console.log('[fluffyjaws] completed. events:', seen, 'answerDeltas:', sawDelta);
        finish();
      }
      if (type === 'response.failed' || type === 'error') {
        onError(new Error(data.error?.message || data.message || 'FluffyJaws error'));
      }
    });
    // Stream closed — render whatever we have even if no explicit "completed" arrived.
    // eslint-disable-next-line no-console
    console.log('[fluffyjaws] stream closed. events:', seen, 'answerDeltas:', sawDelta);
    finish();
  } catch (err) {
    onError(err);
  }
}
