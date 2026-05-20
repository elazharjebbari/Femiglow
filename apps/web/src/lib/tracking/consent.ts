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
  // T34 / C4.T.3 — Consent Mode v2 propagation à tous les tags loaded.
  // On pousse via plusieurs canaux pour couvrir gtag (Google), GTM (via
  // dataLayer), Meta (fbq) et TikTok (ttq). Les tags pas encore chargés
  // récupéreront la dernière valeur depuis la queue du dataLayer / window.
  const w = window as unknown as Record<string, unknown>;
  // 1) gtag direct (GA4/Ads/GTM) — Consent API native.
  const gtag = w.gtag as ((...args: unknown[]) => void) | undefined;
  if (typeof gtag === 'function') {
    gtag('consent', 'update', state);
  }
  // 2) dataLayer.push pour GTM (déclencheurs Custom Event listener).
  const dataLayer = (w.dataLayer ?? []) as unknown[];
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: 'fg_consent_update', consent: state });
    w.dataLayer = dataLayer;
  }
  // 3) Meta fbq — Meta gère son consent via grantConsent/revokeConsent.
  const fbq = w.fbq as ((...args: unknown[]) => void) | undefined;
  if (typeof fbq === 'function') {
    fbq('consent', state.ad_storage === 'granted' ? 'grant' : 'revoke');
  }
  // 4) TikTok ttq — API analytics.disable() / .enable() (best effort,
  //    no-op si non chargé).
  const ttq = w.ttq as { disable?: () => void; enable?: () => void } | undefined;
  if (ttq && typeof ttq === 'object') {
    if (state.ad_storage === 'granted') ttq.enable?.();
    else ttq.disable?.();
  }
  // 5) Snap snaptr — no official consent API. SnapPixelEvents component
  //    gates event firing on ad_storage === 'granted'. When consent is
  //    revoked, we re-init with empty matching params to flush PII.
  const snapPixelId = w.__fg_snap_pixel_id as string | undefined;
  const snaptr = w.snaptr as ((...args: unknown[]) => void) | undefined;
  if (typeof snaptr === 'function' && snapPixelId) {
    if (state.ad_storage !== 'granted') {
      snaptr('init', snapPixelId, { user_hashed_email: '', user_hashed_phone_number: '' });
    }
  }
  window.dispatchEvent(new CustomEvent('fg:consent-changed', { detail: state }));
}

export function hasGivenConsent(state: TrackingConsentState): boolean {
  return state.analytics_storage === 'granted' || state.ad_storage === 'granted';
}
