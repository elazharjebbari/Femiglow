/**
 * Aperçu brouillon admin (`?hmv_preview=draft`) — client muet et provider
 * en consentement refusé forcé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { TrackingClient } from './client';
import { getDataLayer } from './datalayer';
import { TrackingProvider, useTrackingContext } from './provider';
import { GRANTED_CONSENT, saveConsent } from './consent';

beforeEach(() => {
  getDataLayer().flush();
  (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('TrackingClient — disabled', () => {
  it('emit ne pousse rien dans le dataLayer et n’envoie rien', async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const client = new TrackingClient({
      consent: () => GRANTED_CONSENT,
      user: () => ({ anonymous_id: 'a', session_id: 's' }),
      page: () => ({ url: '', path: '/kit', title: '', referrer: '', locale: 'fr' }),
      disabled: true,
      batchIntervalMs: 0,
    });
    client.emit('view_item', { value: 1 });
    client.emit('web_vitals', { name: 'LCP' });
    await client.flush();
    expect(getDataLayer().entries).toHaveLength(0);
    expect(beacon).not.toHaveBeenCalled();
    expect(client.disabled).toBe(true);
  });
});

describe('TrackingProvider — previewMode', () => {
  function Probe({ onCtx }: { onCtx: (c: ReturnType<typeof useTrackingContext>) => void }) {
    onCtx(useTrackingContext());
    return null;
  }

  it('consentement refusé même si accordé en stockage, client muet, événements de consentement ignorés', async () => {
    saveConsent(GRANTED_CONSENT);
    let ctx: ReturnType<typeof useTrackingContext> | null = null;
    render(
      <TrackingProvider bannerEnabled={false} defaultGranted previewMode>
        <Probe onCtx={(c) => (ctx = c)} />
      </TrackingProvider>,
    );
    await act(async () => {
      window.dispatchEvent(new CustomEvent('fg:consent-changed', { detail: GRANTED_CONSENT }));
    });
    expect(ctx!.consent.analytics_storage).toBe('denied');
    expect(ctx!.consent.ad_storage).toBe('denied');
    expect(ctx!.client.disabled).toBe(true);
    ctx!.client.emit('view_item', {});
    expect(getDataLayer().entries).toHaveLength(0);
  });

  it('hors aperçu : comportement inchangé (consentement par défaut accordé)', async () => {
    let ctx: ReturnType<typeof useTrackingContext> | null = null;
    render(
      <TrackingProvider bannerEnabled={false} defaultGranted>
        <Probe onCtx={(c) => (ctx = c)} />
      </TrackingProvider>,
    );
    await act(async () => {});
    expect(ctx!.consent.analytics_storage).toBe('granted');
    expect(ctx!.client.disabled).toBe(false);
  });
});
