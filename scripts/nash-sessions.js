/*
 * Lightweight localStorage store for Nash chat sessions.
 * A session = { id, title, messages: [{ role, content }], previousResponseId, updatedAt }.
 * The chat block writes sessions; the sidebar reads them for the Recent list.
 */

const KEY = 'nash-sessions';
const MAX = 50;

export function listSessions() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getSession(id) {
  return listSessions().find((s) => s.id === id) || null;
}

export function saveSession(session) {
  const others = listSessions().filter((s) => s.id !== session.id);
  const next = [{ ...session, updatedAt: Date.now() }, ...others].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  document.dispatchEvent(new CustomEvent('nash:sessions-changed', { bubbles: true }));
}

export function deleteSession(id) {
  const next = listSessions().filter((s) => s.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  document.dispatchEvent(new CustomEvent('nash:sessions-changed', { bubbles: true }));
}

export function newSessionId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
