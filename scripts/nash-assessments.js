/*
 * localStorage store for Nash assessments created from the launcher.
 * An assessment = { id, company, dr, fileName, status, createdAt,
 *   messages: [{ role, content }], previousResponseId }.
 * Published assessments live in /qualifications; these are the in-progress
 * client-side ones until the DA write-back is wired.
 */

const KEY = 'nash-assessments';
const MAX = 100;

export function listAssessments() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getAssessment(id) {
  return listAssessments().find((a) => a.id === id) || null;
}

export function saveAssessment(assessment, userEmail = '') {
  const others = listAssessments().filter((a) => a.id !== assessment.id);
  const user = assessment.user || userEmail || '';
  const next = [{ ...assessment, user, updatedAt: Date.now() }, ...others].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  document.dispatchEvent(new CustomEvent('nash:assessments-changed', { bubbles: true }));
}

export function deleteAssessment(id) {
  const next = listAssessments().filter((a) => a.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  document.dispatchEvent(new CustomEvent('nash:assessments-changed', { bubbles: true }));
}

export function newAssessmentId() {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Bookmarks & hidden-from-sidebar (per-browser, keyed by a stable string) ── */

const BOOKMARKS_KEY = 'nash-bookmarks';
const HIDDEN_KEY = 'nash-hidden';

function readSet(key) {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeSet(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore quota errors
  }
  document.dispatchEvent(new CustomEvent('nash:assessments-changed', { bubbles: true }));
}

export function isBookmarked(key) {
  return readSet(BOOKMARKS_KEY).includes(key);
}

/** Toggle a bookmark; returns the new bookmarked state. */
export function toggleBookmark(key) {
  const arr = readSet(BOOKMARKS_KEY);
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
  writeSet(BOOKMARKS_KEY, arr);
  return arr.includes(key);
}

export function isHidden(key) {
  return readSet(HIDDEN_KEY).includes(key);
}

/** Hide an item from the sidebar list without deleting the assessment. */
export function hideFromList(key) {
  const arr = readSet(HIDDEN_KEY);
  if (!arr.includes(key)) arr.push(key);
  writeSet(HIDDEN_KEY, arr);
}
