import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import { GRANTED_CONSENT, DENIED_CONSENT } from '@/lib/tracking/consent';
import { TrackingContext, type TrackingContextValue } from '@/lib/tracking/provider';
import type { TrackingConsentState } from '@/lib/db/types';
import type { WebVitalsEvent } from '@/lib/tracking/web-vitals';

// Capture du callback passé à `useReportWebVitals` pour simuler les mesures.
let reportFn: ((metric: Record<string, unknown>) => void) | null = null;
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (fn: (metric: Record<string, unknown>) => void) => {
    reportFn = fn;
  },
}));

import { WEB_VITALS_FLUSH_DELAY_MS, WebVitalsReporter } from './WebVitalsReporter';

const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);

function renderReporter(
  { consent = GRANTED_CONSENT, random = () => 0 }: { consent?: TrackingConsentState; random?: () => number } = {},
) {
  const value = { consent } as unknown as TrackingContextValue;
  return render(
    <TrackingContext.Provider value={value}>
      <WebVitalsReporter random={random} />
    </TrackingContext.Provider>,
  );
}

function metric(name: string, value: number, extra: Record<string, unknown> = {}) {
  act(() => reportFn?.({ name, value, rating: 'good', navigationType: 'navigate', id: `${name}-1`, ...extra }));
}

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function sentEvents(callIndex = 0): Promise<WebVitalsEvent[]> {
  const blob = beacon.mock.calls[callIndex]![1];
  const body = JSON.parse(await blob.text()) as { events: WebVitalsEvent[] };
  return body.events;
}

beforeEach(() => {
  reportFn = null;
  beacon.mockClear();
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
  document.documentElement.lang = 'fr';
});

afterEach(() => {
  cleanup();
  delete (document as unknown as { visibilityState?: unknown }).visibilityState;
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('WebVitalsReporter', () => {
  it('/kit : 100 % échantillonné, lot unique envoyé au masquage via sendBeacon', async () => {
    window.history.replaceState(null, '', '/kit?code=GLOW99');
    renderReporter({ random: () => 0.99 });
    metric('TTFB', 120.6);
    metric('FCP', 980.2);
    metric('LCP', 2100.4);
    metric('CLS', 0.012345);
    metric('INP', 88);
    metric('FID', 3); // non suivi
    expect(beacon).not.toHaveBeenCalled();

    hidePage();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]![0]).toBe('/api/track');
    const events = await sentEvents();
    expect(events.map((e) => e.params.name)).toEqual(['TTFB', 'FCP', 'LCP', 'CLS', 'INP']);
    expect(events.every((e) => e.event === 'web_vitals')).toBe(true);
    const lcp = events.find((e) => e.params.name === 'LCP')!;
    expect(lcp.params).toEqual({
      name: 'LCP',
      value: 2100,
      rating: 'good',
      navigation_type: 'navigate',
      page_route: '/kit',
      metric_id: 'LCP-1',
      sample_rate: 1,
    });
    expect(events.find((e) => e.params.name === 'CLS')!.params.value).toBe(0.0123);
    expect(lcp.page.path).toBe('/kit');
    expect(lcp.page.locale).toBe('fr');
    expect(lcp.user.anonymous_id).toMatch(/^aid_/);
  });

  it('page non-kit : exclue si le tirage dépasse 20 %', () => {
    window.history.replaceState(null, '', '/fr/journal');
    renderReporter({ random: () => 0.5 });
    metric('LCP', 1500);
    hidePage();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('page non-kit : incluse si le tirage est sous 20 %, sample_rate = 0.2', async () => {
    window.history.replaceState(null, '', '/fr/journal');
    renderReporter({ random: () => 0.1 });
    metric('LCP', 1500);
    hidePage();
    const [event] = await sentEvents();
    expect(event!.params.sample_rate).toBe(0.2);
    expect(event!.params.page_route).toBe('/fr/journal');
  });

  it('jamais sur l’admin', () => {
    window.history.replaceState(null, '', '/admin/components');
    renderReporter({ random: () => 0 });
    metric('LCP', 1500);
    hidePage();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('consentement entièrement refusé → rien n’est envoyé', () => {
    window.history.replaceState(null, '', '/kit');
    renderReporter({ consent: DENIED_CONSENT });
    metric('LCP', 1500);
    hidePage();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('envoi anticipé après le délai si l’onglet reste visible', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/ar/kit');
    document.documentElement.lang = 'ar';
    renderReporter();
    metric('TTFB', 90);
    metric('FCP', 700);
    act(() => {
      vi.advanceTimersByTime(WEB_VITALS_FLUSH_DELAY_MS);
    });
    expect(beacon).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    const events = await sentEvents();
    expect(events).toHaveLength(2);
    expect(events[0]!.page.locale).toBe('ar');
  });

  it('la route d’atterrissage est figée (navigation client ultérieure ignorée)', async () => {
    window.history.replaceState(null, '', '/kit');
    renderReporter({ random: () => 0.99 });
    window.history.replaceState(null, '', '/fr/journal');
    metric('CLS', 0.2);
    hidePage();
    const [event] = await sentEvents();
    expect(event!.params.page_route).toBe('/kit');
    expect(event!.params.sample_rate).toBe(1);
  });
});
