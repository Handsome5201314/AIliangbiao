import { generateUUID } from '@/lib/utils/uuid';

export const GUEST_SESSION_STORAGE_KEY = 'guest_session_id';
const LEGACY_DEVICE_STORAGE_KEY = 'device_id';

function canUseBrowserStorage() {
  return typeof window !== 'undefined';
}

export function peekGuestSessionId() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const current = window.sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (current) {
    return current;
  }

  const legacy = window.localStorage.getItem(LEGACY_DEVICE_STORAGE_KEY);
  if (legacy) {
    window.sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, legacy);
    return legacy;
  }

  return null;
}

export function getOrCreateGuestSessionId() {
  if (!canUseBrowserStorage()) {
    return generateUUID();
  }

  const existing = peekGuestSessionId();
  if (existing) {
    return existing;
  }

  const next = generateUUID();
  window.sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, next);
  return next;
}

export function clearGuestSessionId() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
}
