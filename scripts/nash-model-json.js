/*
 * Tolerant parsing for structured FluffyJaws output.
 * The gateway can restart a generation mid-stream, appending a fresh copy after a partial
 * one, and long, deeply nested answers occasionally slip a closing bracket. These repairs
 * never invent content: every parsed result must still pass the strict assessment validators.
 */

const EXCERPT_LENGTH = 70;

/** Keeps only the final generation when a restarted copy follows a partial one. */
export function latestGeneration(answer, probeLength = 64) {
  const text = String(answer || '');
  const probe = text.slice(0, probeLength);
  if (probe.trim().length < probeLength / 2) return text;
  const restart = text.lastIndexOf(probe);
  return restart > 0 ? text.slice(restart) : text;
}

function continuesRoot(source, from, keys) {
  const member = /^\s*,\s*"([^"\\]+)"\s*:/.exec(source.slice(from, from + 200));
  return !!member && keys.includes(member[1]);
}

/**
 * Repairs the closing-bracket slips seen in long, deeply nested model answers.
 * Inner closers skipped before an outer closer (`}}]` where `}]}}]` was required) are
 * restored. When the caller names the root object's members, those members always start at
 * the root: containers still open before one are closed (`]}}, "requirementCorrections"`
 * where `]}}], …` was required), an extra closer that ends the root before one is dropped,
 * and so are stray closers after the final root close. The caller must reject unknown root
 * members, so nothing can be silently misplaced. Truncated text returns null.
 * memberKeys name members of a nested object that the caller relocates itself. Only an extra
 * closer that ends the root before one is dropped, leaving it at the root for the caller.
 */
export function repairJsonClosers(text, { rootKeys = [], memberKeys = [] } = {}) {
  const source = String(text || '');
  const lateKeys = [...rootKeys, ...memberKeys];
  const open = [];
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    let keep = true;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
    } else if (character === '{') {
      open.push('}');
    } else if (character === '[') {
      open.push(']');
    } else if (character === ',' && open.length > 1 && continuesRoot(source, index, rootKeys)) {
      while (open.length > 1) output += open.pop();
    } else if (character === '}' || character === ']') {
      const depth = open.lastIndexOf(character);
      if (depth < 0) {
        if (!rootKeys.length || open.length || /[^\s}\]]/.test(source.slice(index))) return null;
        keep = false;
      } else if (character === '}' && open.length === 1
        && continuesRoot(source, index + 1, lateKeys)) {
        keep = false;
      } else {
        while (open.length - 1 > depth) output += open.pop();
        open.pop();
      }
    }
    if (keep) output += character;
  }
  return open.length || inString ? null : output;
}

function withoutFence(text) {
  return String(text || '').trim()
    .replace(/^```(?:json)?\s*\n/i, '').replace(/\n```\s*$/, '')
    .trim();
}

function errorOffset(text, error) {
  const message = String(error?.message || '');
  const position = /position (\d+)/.exec(message);
  if (position) return Number(position[1]);
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (!lineColumn) return -1;
  return text.split('\n').slice(0, Number(lineColumn[1]) - 1)
    .reduce((offset, line) => offset + line.length + 1, Number(lineColumn[2]) - 1);
}

function syntaxHint(text, error) {
  const offset = errorOffset(text, error);
  const reason = `JSON syntax error: ${String(error?.message || 'invalid JSON').replace(/\.$/, '')}.`;
  if (offset < 0) return reason;
  const excerpt = (from, to) => text.slice(Math.max(0, from), to).replace(/\s+/g, ' ');
  return `${reason} The text around it is: …${excerpt(offset - EXCERPT_LENGTH, offset)}<<<HERE>>>${excerpt(offset, offset + EXCERPT_LENGTH)}…`;
}

/**
 * Parses model JSON, recovering only from gateway restarts and the bracket slips handled by
 * repairJsonClosers (reported to onRepair). A failure carries `jsonHint`, locating the slip
 * for a correction request.
 */
export function parseModelJson(answer, { rootKeys = [], memberKeys = [], onRepair } = {}) {
  const original = withoutFence(answer);
  try {
    return JSON.parse(original);
  } catch (error) {
    // After a restart only the final copy is trustworthy; the joined text is never repaired.
    const latest = withoutFence(latestGeneration(original));
    let failure = { text: original, error };
    if (latest !== original) {
      try {
        return JSON.parse(latest);
      } catch (latestError) {
        failure = { text: latest, error: latestError };
      }
    }
    const repaired = repairJsonClosers(latest, { rootKeys, memberKeys });
    if (repaired) {
      try {
        const value = JSON.parse(repaired);
        onRepair?.({
          type: 'json-brackets-repaired',
          detail: 'Misplaced closing brackets in the JSON were repaired',
        });
        return value;
      } catch {
        // Report the model's own text below, not the repair attempt.
      }
    }
    failure.error.jsonHint = syntaxHint(failure.text, failure.error);
    throw failure.error;
  }
}

/** Correction guidance for an answer that was not valid JSON, or '' for any other rejection. */
export function syntaxCorrection(error) {
  const hint = error?.cause?.jsonHint || error?.jsonHint;
  return hint ? `\n${hint}\nFix that exact spot (usually a missing or extra closing bracket) and keep everything else unchanged.` : '';
}
