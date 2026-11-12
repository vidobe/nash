import assert from 'node:assert/strict';
import test from 'node:test';
import {
  latestGeneration, parseModelJson, repairJsonClosers, syntaxCorrection,
} from '../scripts/nash-model-json.js';

const ROOT_KEYS = ['reviewedRequirementIds', 'dimensionUpdates', 'requirementCorrections'];
const COMPLETE = '{"reviewedRequirementIds":["CMS-01","CMS-02","CMS-03a"],"dimensionUpdates":[{"name":"AI & Agentic Fit","details":{"sections":[{"title":"Boundaries","table":{"columns":["A","B"],"rows":[["x","y"]]},"evidenceRefs":["E5"]}]}}],"requirementCorrections":[]}';

test('a restarted generation keeps only the final complete copy', () => {
  const restarted = `${COMPLETE.slice(0, 140)}${COMPLETE}`;
  assert.equal(latestGeneration(restarted), COMPLETE);
  assert.deepEqual(parseModelJson(restarted), JSON.parse(COMPLETE));
  assert.equal(latestGeneration(COMPLETE), COMPLETE, 'A normal answer is untouched');
  assert.equal(latestGeneration('{"a":1}{"a":1}'), '{"a":1}{"a":1}', 'Short probes never trigger a restart');
});

test('skipped inner closers are restored only where an outer closer proves they ended', () => {
  const skipped = COMPLETE.replace('"evidenceRefs":["E5"]}]}}]', '"evidenceRefs":["E5"]}}]');
  assert.notEqual(skipped, COMPLETE);
  assert.throws(() => JSON.parse(skipped));
  assert.equal(repairJsonClosers(skipped), COMPLETE);
  assert.deepEqual(parseModelJson(skipped), JSON.parse(COMPLETE));
});

test('truncated, stray and string-embedded brackets are never guessed', () => {
  assert.equal(repairJsonClosers('{"a":[1,2'), null, 'Truncated output is not completed');
  assert.equal(repairJsonClosers('{"a":1}]'), null, 'A closer without an opener is not repaired');
  assert.equal(repairJsonClosers('{"a":1}}'), null, 'Without a declared root, a trailing closer stays');
  assert.equal(repairJsonClosers('{"a":1}} x', { rootKeys: ['a'] }), null, 'Only closers may follow');
  assert.equal(repairJsonClosers('{"a":"]} \\" {["}'), '{"a":"]} \\" {["}');
  assert.throws(() => parseModelJson('{"a":[1,2'), SyntaxError);
  assert.throws(() => parseModelJson('{"a": "unterminated}'), SyntaxError);
});

test('a fenced answer with both a restart and a skipped closer still parses exactly', () => {
  const skipped = COMPLETE.replace('"evidenceRefs":["E5"]}]}}]', '"evidenceRefs":["E5"]}}]');
  const answer = `\`\`\`json\n${COMPLETE.slice(0, 150)}${skipped}\n\`\`\``;
  assert.deepEqual(parseModelJson(answer), JSON.parse(COMPLETE));
});

test('with a declared root, an early root close and a stray final closer are both undone', () => {
  const early = COMPLETE.replace('],"dimensionUpdates"', ']},"dimensionUpdates"');
  assert.throws(() => JSON.parse(early), SyntaxError);
  assert.equal(repairJsonClosers(early), null, 'Root repairs are opt-in');
  assert.equal(repairJsonClosers(early, { rootKeys: ROOT_KEYS }), COMPLETE);
  assert.deepEqual(parseModelJson(`${early}}`, { rootKeys: ROOT_KEYS }), JSON.parse(COMPLETE));
  assert.throws(() => parseModelJson(early), SyntaxError);
});

test('with a declared root, containers left open before a root member are closed', () => {
  const open = COMPLETE.replace('"evidenceRefs":["E5"]}]}}],"requirementCorrections"', '"evidenceRefs":["E5"]}]}},"requirementCorrections"');
  assert.notEqual(open, COMPLETE);
  assert.throws(() => JSON.parse(open), SyntaxError);
  assert.throws(() => parseModelJson(open), SyntaxError, 'Root repairs are opt-in');
  assert.equal(repairJsonClosers(open, { rootKeys: ROOT_KEYS }), COMPLETE);
  const quoted = '{"a":["x, \\"requirementCorrections\\": y"],"requirementCorrections":[]}';
  assert.equal(repairJsonClosers(quoted, { rootKeys: ROOT_KEYS }), quoted, 'Text inside strings is ignored');
});

test('an early close before a nested member is never moved to the root', () => {
  const nested = '{"coreUpdates":{"executive":"x"}},"context":"y"}}';
  assert.throws(
    () => parseModelJson(nested, { rootKeys: ['coreUpdates', 'dimensionUpdates'] }),
    SyntaxError,
  );
});

test('an unrepairable answer reports exactly where it stopped being valid JSON', () => {
  const broken = COMPLETE.replace('"name":"AI & Agentic Fit"', '"name""AI & Agentic Fit"');
  let failure;
  assert.throws(() => parseModelJson(broken), (error) => {
    failure = error;
    return error instanceof SyntaxError;
  });
  assert.match(failure.jsonHint, /^JSON syntax error: /);
  assert.ok(failure.jsonHint.includes('"name"<<<HERE>>>"AI & Agentic Fit"'), failure.jsonHint);
  const rejected = new Error('The review returned invalid JSON.', { cause: failure });
  assert.match(syntaxCorrection(rejected), /<<<HERE>>>[\s\S]*Fix that exact spot/);
  assert.equal(syntaxCorrection(new Error('The review did not cover every requirement.')), '');
});
