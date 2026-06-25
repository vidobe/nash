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

export function saveAssessment(assessment) {
  const others = listAssessments().filter((a) => a.id !== assessment.id);
  const next = [{ ...assessment, updatedAt: Date.now() }, ...others].slice(0, MAX);
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
