/**
 * Tests unitaires du module Consent Mode v2 (T34, C4.T.3).
 *
 * Vérifie que saveConsent() propage correctement à TOUS les canaux :
 *   - gtag (Google) via consent update
 *   - dataLayer (GTM) via push d'event fg_consent_update
 *   - fbq (Meta) via grant/revoke
 *   - ttq (TikTok) via enable/disable
 *
 * Et que les canaux non chargés ne provoquent pas d'erreur (best-effort).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConsent, GRANTED_CONSENT, DENIED_CONSENT } from './consent';

// jsdom fournit window/document. Reset des canaux tracking avant chaque test.
beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).gtag;
  delete (window as unknown as Record<string, unknown>).dataLayer;
  delete (window as unknown as Record<string, unknown>).fbq;
  delete (window as unknown as Record<string, unknown>).ttq;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveConsent — Consent Mode v2 propagation', () => {
  it('appelle gtag("consent", "update", state) si gtag est défini', () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
    saveConsent(GRANTED_CONSENT);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', GRANTED_CONSENT);
  });

  it('push dans dataLayer un event fg_consent_update avec le state', () => {
    const dataLayer: unknown[] = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dataLayer;
    saveConsent(GRANTED_CONSENT);
    const pushed = dataLayer.find(
      (e) =>
        typeof e === 'object' && e !== null && (e as { event?: string }).event === 'fg_consent_update',
    );
    expect(pushed).toBeDefined();
    expect((pushed as { consent: typeof GRANTED_CONSENT }).consent).toEqual(GRANTED_CONSENT);
  });

  it('crée le dataLayer si absent (idempotent côté GTM bootstrap)', () => {
    expect((window as unknown as Record<string, unknown>).dataLayer).toBeUndefined();
    saveConsent(GRANTED_CONSENT);
    expect(Array.isArray((window as unknown as { dataLayer: unknown[] }).dataLayer)).toBe(true);
  });

  it('appelle fbq("consent","grant") quand ad_storage=granted', () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: typeof fbq }).fbq = fbq;
    saveConsent(GRANTED_CONSENT);
    expect(fbq).toHaveBeenCalledWith('consent', 'grant');
  });

  it('appelle fbq("consent","revoke") quand ad_storage=denied', () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: typeof fbq }).fbq = fbq;
    saveConsent(DENIED_CONSENT);
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke');
  });

  it('appelle ttq.enable() / ttq.disable() selon ad_storage', () => {
    const ttq = { enable: vi.fn(), disable: vi.fn() };
    (window as unknown as { ttq: typeof ttq }).ttq = ttq;
    saveConsent(GRANTED_CONSENT);
    expect(ttq.enable).toHaveBeenCalled();
    expect(ttq.disable).not.toHaveBeenCalled();

    ttq.enable.mockClear();
    saveConsent(DENIED_CONSENT);
    expect(ttq.disable).toHaveBeenCalled();
    expect(ttq.enable).not.toHaveBeenCalled();
  });

  it("dispatch un CustomEvent fg:consent-changed sur window", () => {
    const handler = vi.fn();
    window.addEventListener('fg:consent-changed', handler as EventListener);
    saveConsent(GRANTED_CONSENT);
    expect(handler).toHaveBeenCalled();
    const firstCall = handler.mock.calls[0];
    expect(firstCall).toBeDefined();
    const event = firstCall![0] as CustomEvent;
    expect(event.detail).toEqual(GRANTED_CONSENT);
    window.removeEventListener('fg:consent-changed', handler as EventListener);
  });

  it('ne plante pas si AUCUN canal tracking est chargé (best-effort)', () => {
    // Aucun gtag, dataLayer, fbq, ttq.
    expect(() => saveConsent(GRANTED_CONSENT)).not.toThrow();
  });

  it('persiste le consent en localStorage', () => {
    saveConsent(GRANTED_CONSENT);
    const stored = window.localStorage.getItem('fg_consent');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(GRANTED_CONSENT);
  });
});
