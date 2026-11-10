/* eslint-env es2020 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { streamQualification } from '../scripts/fluffyjaws.js';

const encoder = new TextEncoder();

function event(type, data = {}) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

function streamResponse(chunks) {
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      });
      controller.close();
    },
  }));
}

function setup(t, chunks = [], { authenticated = true, response } = {}) {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => (authenticated
        ? JSON.stringify({ accessToken: 'test-only-token', expires: Date.now() + 60000 })
        : null),
    },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const result = {
    answer: '', thinking: '', activity: [], done: [], errors: [], requests: [],
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    result.requests.push({ url, body: JSON.parse(options.body) });
    return response || streamResponse(chunks);
  });
  result.run = (options = {}) => streamQualification({
    messages: [{ role: 'user', content: 'Assess the supplied requirements.' }],
    onDelta: (delta) => { result.answer += delta; },
    onThinking: (delta) => { result.thinking += delta; },
    onActivity: (activity) => { result.activity.push(activity); },
    onDone: (meta) => { result.done.push(meta); },
    onError: (error) => { result.errors.push(error); },
    ...options,
  });
  return result;
}

function assertFailed(result, message) {
  assert.equal(result.done.length, 0);
  assert.equal(result.errors.length, 1);
  if (message) assert.match(result.errors[0].message, message);
}

test('completes live text once with the gateway model and response metadata', async (t) => {
  const result = setup(t, [
    event('response.created', { response: { id: 'resp_live', model: 'gpt-6-luna' } }),
    event('tool_executing', { tool_name: 'web_search' }),
    event('tool_complete'),
    event('response.output_text.delta', { item_id: 'answer', delta: 'Real ' }),
    event('response.output_text.delta', { item_id: 'answer', delta: 'assessment' }),
    event('response.output_text.done', { item_id: 'answer', text: 'Real assessment' }),
    event('response.completed', { response: { id: 'resp_live', status: 'completed' } }),
    event('response.completed'),
    event('error', { message: 'Ignored after completion' }),
    'data: [DONE]\n\n',
  ]);
  await result.run({ previousResponseId: 'resp_previous', reasoningEffort: 'medium' });
  assert.equal(result.answer, 'Real assessment');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.done, [{
    responseId: 'resp_live', model: 'gpt-6-luna', requestedModel: 'gpt-5.4', mock: false,
  }]);
  assert.deepEqual(result.activity, ['Searching the web…', 'Reviewing findings…']);
  assert.equal(result.requests[0].body.model, 'gpt-5.4');
  assert.equal(result.done[0].requestedModel, result.requests[0].body.model);
  assert.notEqual(result.done[0].requestedModel, result.done[0].model);
  assert.equal(result.requests[0].body.previousResponseId, 'resp_previous');
  assert.equal(result.requests[0].body.reasoningEffort, 'medium');
});

['id', 'response_id', 'responseId'].forEach((field) => {
  test(`reads flat gateway metadata from ${field}`, async (t) => {
    const result = setup(t, [
      `data: ${JSON.stringify({
        type: 'response.created', [field]: 'resp_flat', model: 'gpt-6-luna',
      })}\n\n`,
      event('response.output_text.done', { text: 'Final answer' }),
      event('response.completed', { [field]: 'resp_final', model: 'reported-final-model' }),
    ]);
    await result.run();
    assert.equal(result.answer, 'Final answer');
    assert.deepEqual(result.done, [{
      responseId: 'resp_final', model: 'reported-final-model', requestedModel: 'gpt-5.4', mock: false,
    }]);
    assert.deepEqual(result.errors, []);
  });
});

test('does not present the requested model or prior response as reported metadata', async (t) => {
  const result = setup(t, [event('response.completed')]);
  await result.run({ previousResponseId: 'resp_previous' });
  assert.deepEqual(result.done, [{
    responseId: null, model: null, requestedModel: 'gpt-5.4', mock: false,
  }]);
});

test('keeps commentary and reasoning out of the answer across output items', async (t) => {
  const result = setup(t, [
    event('response.output_item.added', {
      output_index: 0, item: { id: 'commentary', type: 'message', phase: 'commentary' },
    }),
    event('response.output_text.delta', { item_id: 'commentary', delta: 'Searching evidence.' }),
    event('response.output_text.done', { item_id: 'commentary', text: 'Searching evidence.' }),
    event('response.reasoning_summary_text.delta', { delta: 'Private reasoning summary.' }),
    event('response.output_item.added', {
      output_index: 1, item: { id: 'reasoning', type: 'reasoning' },
    }),
    event('response.output_text.delta', { output_index: 1, delta: 'Thinking.' }),
    event('response.output_text.delta', { phase: 'commentary', item_id: 'flat', delta: 'Checking.' }),
    event('response.output_item.added', {
      output_index: 2, item: { id: 'answer', type: 'message', phase: 'final_answer' },
    }),
    event('response.output_text.delta', { item_id: 'answer', content_index: 0, delta: 'Final ' }),
    event('response.output_text.delta', { item_id: 'answer', content_index: 0, delta: 'answer.' }),
    event('response.output_text.done', { output_index: 2, content_index: 0, text: 'Final answer.' }),
    event('response.output_text.done', { item_id: 'answer', content_index: 1, text: ' More evidence.' }),
    event('response.output_text.done', { item_id: 'answer', content_index: 1, text: ' More evidence.' }),
    event('response.completed'),
  ]);
  await result.run();
  assert.equal(result.answer, 'Final answer. More evidence.');
  assert.equal(result.thinking, 'Searching evidence.Thinking.Checking.');
  assert.equal(result.done.length, 1);
  assert.deepEqual(result.errors, []);
});

test('supports CRLF, multiline data, split UTF-8 and an unterminated final event', async (t) => {
  const text = 'Garanti 🌍 — İstanbul assessment.';
  const sse = [
    ': keepalive\r\n\r\nevent: heartbeat\r\ndata: still alive\r\n\r\n',
    'event: response.created\r\ndata: {"response":{\r\n',
    'data: "id":"resp_crlf","model":"gpt-6-luna"}}\r\n\r\n',
    event('response.output_text.delta', { delta: text }).replace(/\n/g, '\r\n'),
    'event: response.completed\r\ndata: {"response_id":"resp_crlf","status":"completed"}',
  ].join('');
  const chunks = Array.from(encoder.encode(sse), (byte) => Uint8Array.of(byte));
  const result = setup(t, chunks);
  await result.run();
  assert.equal(result.answer, text);
  assert.deepEqual(result.done, [{
    responseId: 'resp_crlf', model: 'gpt-6-luna', requestedModel: 'gpt-5.4', mock: false,
  }]);
  assert.deepEqual(result.errors, []);
});

[
  ['empty EOF', ''],
  ['partial text at EOF', event('response.output_text.delta', { delta: 'Partial' })],
  ['unterminated delta at EOF', 'event: response.output_text.delta\ndata: {"delta":"Partial"}'],
  ['bare DONE marker', 'data: [DONE]\n\n'],
  ['partial text followed by DONE', `${event('response.output_text.delta', { delta: 'Partial' })}data: [DONE]\n\n`],
].forEach(([name, sse]) => {
  test(`rejects ${name} without positive completion`, async (t) => {
    const result = setup(t, [sse]);
    await result.run();
    assertFailed(result, /before response\.completed/);
  });
});

[
  ['error', event('error', { message: 'Gateway unavailable' }), /Gateway unavailable/],
  ['nested failure', event('response.failed', { response: { error: { message: 'Run failed' } } }), /Run failed/],
  ['flat failure', event('response.failed', { error: { message: 'Flat failure' } }), /Flat failure/],
  ['incomplete without reason', event('response.incomplete'), /incomplete/],
  ['nested incomplete', event('response.incomplete', {
    response: { incomplete_details: { reason: 'max_output_tokens' } },
  }), /max_output_tokens/],
  ['flat incomplete', event('response.incomplete', {
    incomplete_details: { reason: 'max_output_tokens' },
  }), /max_output_tokens/],
  ['nested content filter', event('response.incomplete', {
    response: { incomplete_details: { reason: 'content_filter' } },
  }), /^content_filter$/],
  ['flat content filter', event('response.incomplete', {
    incomplete_details: { reason: 'content_filter' },
  }), /^content_filter$/],
  ['error content filter', event('error', {
    error: { code: 'content_filter', message: 'Blocked' },
  }), /^content_filter$/],
  ['contradictory completion', event('response.completed', {
    response: { status: 'incomplete', incomplete_details: { reason: 'content_filter' } },
  }), /^content_filter$/],
].forEach(([name, failure, message]) => {
  test(`reports ${name} once and never follows it with success`, async (t) => {
    const result = setup(t, [
      event('response.output_text.delta', { delta: 'Partial answer' }),
      failure,
      event('response.output_text.delta', { delta: ' Must not arrive' }),
      event('response.completed', { id: 'resp_invalid' }),
    ]);
    await result.run();
    assert.equal(result.answer, 'Partial answer');
    assertFailed(result, message);
  });
});

[
  ['invalid JSON', 'event: response.output_text.delta\ndata: {invalid}\n\n'],
  ['null completion', 'event: response.completed\ndata: null\n\n'],
  ['missing completion data', 'event: response.completed\n\n'],
  ['non-object completion', 'event: response.completed\ndata: []\n\n'],
  ['malformed delta', event('response.output_text.delta', { delta: 42 })],
  ['missing delta', event('response.output_text.delta')],
  ['malformed done text', event('response.output_text.done', { text: null })],
  ['malformed item', event('response.output_item.added', { item: null })],
  ['malformed response', event('response.completed', { response: 'invalid' })],
  ['malformed metadata', event('response.completed', { model: 42 })],
  ['conflicting event type', 'event: error\ndata: {"type":"response.completed"}\n\n'],
].forEach(([name, malformed]) => {
  test(`rejects ${name} even when completion follows`, async (t) => {
    const result = setup(t, [malformed, event('response.completed')]);
    await result.run();
    assertFailed(result, /Malformed/);
  });
});

test('rejects truncated UTF-8 rather than quietly discarding bytes at EOF', async (t) => {
  const result = setup(t, [new Uint8Array([0xc3])]);
  await result.run();
  assertFailed(result);
});

test('reports callback errors instead of swallowing them and later succeeding', async (t) => {
  const result = setup(t, [
    event('response.output_text.delta', { delta: 'Answer' }),
    event('response.completed'),
  ]);
  await result.run({ onDelta: () => { throw new Error('Rendering failed'); } });
  assertFailed(result, /Rendering failed/);
});

test('rejects HTTP failures without falling back to a mock', async (t) => {
  const result = setup(t, [], { response: new Response('', { status: 503 }) });
  await result.run();
  assert.equal(result.answer, '');
  assertFailed(result, /503/);
});

test('rejects a signal aborted before authentication or fetch', async (t) => {
  const controller = new AbortController();
  controller.abort();
  const result = setup(t, [event('response.completed')]);
  await result.run({ signal: controller.signal });
  assert.equal(result.requests.length, 0);
  assertFailed(result);
  assert.equal(result.errors[0].name, 'AbortError');
});

test('does not complete when aborted before a completion in the same chunk', async (t) => {
  const controller = new AbortController();
  const result = setup(t, [
    event('response.output_text.delta', { delta: 'Partial' }) + event('response.completed'),
  ]);
  await result.run({
    signal: controller.signal,
    onDelta: (delta) => { result.answer += delta; controller.abort(); },
  });
  assert.equal(result.answer, 'Partial');
  assertFailed(result);
  assert.equal(result.errors[0].name, 'AbortError');
});

test('cancels a pending stream read on abort', { timeout: 1000 }, async (t) => {
  const controller = new AbortController();
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(stream) {
      stream.enqueue(encoder.encode(event('response.output_text.delta', { delta: 'Partial' })));
    },
    cancel() { cancelled = true; },
  }));
  const result = setup(t, [], { response });
  await result.run({
    signal: controller.signal,
    onDelta: () => { queueMicrotask(() => controller.abort()); },
  });
  assertFailed(result);
  assert.equal(result.errors[0].name, 'AbortError');
  assert.equal(cancelled, true);
});

test('keeps the intentional unauthenticated development response explicitly marked as mock', async (t) => {
  t.mock.method(globalThis, 'setTimeout', (callback) => { callback(); return 0; });
  const result = setup(t, [], { authenticated: false });
  await result.run();
  assert.match(result.answer, /Once FluffyJaws is connected/);
  assert.equal(result.requests.length, 0);
  assert.deepEqual(result.done, [{
    responseId: null, model: null, requestedModel: 'gpt-5.4', mock: true,
  }]);
  assert.deepEqual(result.errors, []);
});

test('does not complete an aborted development mock', async (t) => {
  t.mock.method(globalThis, 'setTimeout', (callback) => { callback(); return 0; });
  const controller = new AbortController();
  const result = setup(t, [], { authenticated: false });
  await result.run({
    signal: controller.signal,
    onDelta: () => { controller.abort(); },
  });
  assertFailed(result);
  assert.equal(result.errors[0].name, 'AbortError');
});
