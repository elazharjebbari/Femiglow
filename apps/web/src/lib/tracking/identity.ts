'use client';

const ANON_KEY = 'fg_aid';
const SESSION_KEY = 'fg_sid';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_TS_KEY = 'fg_sid_ts';

function rand(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return Math.random().toString(36).slice(2, 26);
}

export function getAnonymousId(): string {
  if (typeof window === 'undefined') return 'aid_ssr';
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = `aid_${rand()}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return `aid_${rand()}`;
  }
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'sid_ssr';
  try {
    const now = Date.now();
    const ts = Number(window.sessionStorage.getItem(SESSION_TS_KEY) ?? 0);
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id || !ts || now - ts > SESSION_TIMEOUT_MS) {
      id = `sid_${rand()}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    window.sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return `sid_${rand()}`;
  }
}
