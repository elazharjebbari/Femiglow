'use client';

import type { TrackingConsentState } from '@/lib/db/types';

const STORAGE_KEY = 'fg_consent';
const COOKIE_NAME = 'fg_consent';

export const DENIED_CONSENT: TrackingConsentState = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functional_storage: 'denied',
};

export const GRANTED_CONSENT: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

export function loadConsent(): TrackingConsentState {
  if (typeof window === 'undefined') return DENIED_CONSENT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DENIED_CONSENT;
    const parsed = JSON.parse(raw) as Partial<TrackingConsentState>;
    return { ...DENIED_CONSENT, ...parsed };
  } catch {
    return DENIED_CONSENT;
  }
}

export function saveConsent(state: TrackingConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('consent', 'update', state);
  }
  window.dispatchEvent(new CustomEvent('fg:consent-changed', { detail: state }));
}

export function hasGivenConsent(state: TrackingConsentState): boolean {
  return state.analytics_storage === 'granted' || state.ad_storage === 'granted';
}
