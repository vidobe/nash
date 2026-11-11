import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  generationDuration, generationStatus,
} from '../blocks/nash-session/nash-session-generation.js';

test('generation duration shows real elapsed minutes and seconds without an invented ETA', () => {
  assert.equal(generationDuration(0), '0:00');
  assert.equal(generationDuration(59999), '0:59');
  assert.equal(generationDuration(61000), '1:01');
  assert.equal(generationDuration(3601000), '60:01');
  assert.equal(generationDuration(-1000), '0:00');
});

test('quiet requests become waiting, not failed, at the exact inactivity threshold', () => {
  const input = {
    phase: 'review', startedAt: 0, lastActivityAt: 30000, now: 119999,
  };
  assert.equal(generationStatus(input).status, 'Running');
  const waiting = generationStatus({ ...input, now: 120000 });
  assert.equal(waiting.waiting, true);
  assert.equal(waiting.status, 'Waiting for an update');
  assert.equal(waiting.elapsed, '2:00 elapsed');
  assert.equal(waiting.updated, 'Last update 1:30 ago');
  const active = generationStatus({ ...input, lastActivityAt: 120000, now: 120001 });
  assert.equal(active.waiting, false);
  assert.equal(active.updated, 'Updated just now');
});

test('only actual validated requirement counts appear in the coarse phase label', () => {
  const state = generationStatus({
    phase: 'requirements',
    reviewed: 64,
    total: 166,
    startedAt: 0,
    lastActivityAt: 5000,
    now: 5000,
  });
  assert.equal(state.phase, 'Reviewing your requirements (64 of 166)');
  assert.doesNotMatch(Object.values(state).join(' '), /%|remaining|ETA/);
  assert.throws(() => generationStatus({ phase: 'raw-model-output' }), /Unknown generation phase/);
});

test('both assessment renderers use progress events rather than displaying model output', () => {
  const source = readFileSync(new URL('../blocks/nash-session/nash-session.js', import.meta.url), 'utf8');
  const generation = source.slice(source.indexOf('async function runAssessment('), source.indexOf('export function renderAssessment('));
  assert.doesNotMatch(generation, /onThinking:|onDelta:|nash-session-stream/);
  assert.equal((generation.match(/onProgress: progress.update/g) || []).length, 2);
  assert.equal((generation.match(/onHeartbeat: progress.pulse/g) || []).length, 2);
  assert.match(generation, /progress\.fail\(msg/);
  assert.match(generation, /progress\.complete\(\)/);
});
