/*
 * Deletion permissions. Admins can delete any assessment; everyone else can
 * delete only assessments they created (owner email matches theirs).
 */

import { getUserInfo } from './nash-auth.js';

// Emails allowed to delete ANY assessment.
export const ADMINS = ['vgabriel@adobe.com'];

export function currentEmail() {
  return (getUserInfo()?.email || '').toLowerCase();
}

export function isAdmin() {
  const me = currentEmail();
  return !!me && ADMINS.some((e) => e.toLowerCase() === me);
}

/**
 * Whether the current user may delete an item owned by `ownerEmail`.
 * @param {string} ownerEmail the assessment's creator email
 * @returns {boolean}
 */
export function canDelete(ownerEmail) {
  const me = currentEmail();
  if (!me) return false;
  if (isAdmin()) return true;
  return (ownerEmail || '').toLowerCase() === me;
}
