/**
 * Root layout — aperçu brouillon « médias par audience » (`x-fg-hmv-preview`).
 *
 * Marqueur présent (posé par le middleware) : aucune couche de mesure
 * (GTM, pixels, Web Vitals, attribution, bandeau), `TrackingProvider` en
 * `previewMode`, métadonnées `noindex`. Marqueur absent : rendu habituel.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

const hdr = vi.hoisted(() => ({ current: new Headers() }));
vi.mock('next/headers', () => ({ headers: () => hdr.current }));
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-local' }) }));
vi.mock('next/font/google', () => ({ Cairo: () => ({ variable: 'font-cairo' }) }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('@/lib/boot/seed-on-boot', () => ({ ensureSeedOnce: async () => undefined }));
vi.mock('@/lib/db/queries/tracking/settings', () => ({
  getTrackingSetting: async (_k: string, fallback: unknown) => fallback,
  TRACKING_SETTING_KEYS: { CONSENT_BANNER_ENABLED: 'a', CONSENT_DEFAULT_GRANTED: 'b' },
}));
vi.mock('@/lib/tracking/attribution/server', () => ({ getAttributionStrategy: async () => 'last_paid_touch' }));
vi.mock('@/lib/legal/repository', () => ({ listPlacementsForZone: async () => [] }));

const { marker } = vi.hoisted(() => ({
  // Factories hissées : pas de JSX ici (le runtime JSX n'est pas encore importé).
  marker: (name: string) => () => `[mount:${name}]`,
}));
vi.mock('@/components/tracking/GtmHeadScript', () => ({ GtmHeadScript: marker('gtm') }));
vi.mock('@/components/tracking/PixelLoader', () => ({ PixelLoader: marker('pixels') }));
vi.mock('@/components/tracking/WebVitalsReporter', () => ({ WebVitalsReporter: marker('web-vitals') }));
vi.mock('@/components/tracking/SnapPixelEvents', () => ({ SnapPixelEvents: marker('snap') }));
vi.mock('@/components/tracking/AttributionCaptureBridge', () => ({ AttributionCaptureBridge: marker('attribution') }));
vi.mock('@/components/tracking/DebugOverlay', () => ({ DebugOverlay: marker('debug') }));
vi.mock('@/components/layout/SkipLink', () => ({ SkipLink: marker('skip') }));
vi.mock('@/components/a11y/MobileFocusGuard', () => ({ MobileFocusGuard: marker('focus-guard') }));
vi.mock('@/components/chat/ChatWidgetMount', () => ({ ChatWidgetMount: marker('chat') }));
vi.mock('@/lib/tracking/global-listener', () => ({ TrackingGlobalListener: marker('listener') }));
vi.mock('@/components/tracking/ConsentBanner', () => ({
  ConsentBanner: marker('consent-banner'),
  DEFAULT_CONSENT_LABELS: {},
}));
vi.mock('@/lib/tracking/provider', () => ({
  TrackingProvider: ({ children, previewMode }: { children: ReactNode; previewMode?: boolean }) => (
    <div data-provider={previewMode ? 'preview' : 'live'}>{children}</div>
  ),
}));

import RootLayout from './layout';

async function renderLayout(): Promise<string> {
  const tree = await RootLayout({ children: <main>page</main> });
  return renderToStaticMarkup(tree);
}

const TRACKING = ['gtm', 'pixels', 'web-vitals', 'snap', 'attribution', 'consent-banner', 'listener'];

describe('RootLayout — aperçu brouillon (x-fg-hmv-preview)', () => {
  beforeEach(() => {
    hdr.current = new Headers({ 'x-locale': 'ar' });
  });

  it('sans marqueur : couches de mesure montées', async () => {
    const html = await renderLayout();
    for (const name of TRACKING) expect(html).toContain(`[mount:${name}]`);
    expect(html).toContain('data-provider="live"');
  });

  it('avec marqueur : aucune couche de mesure, provider muet', async () => {
    hdr.current.set('x-fg-hmv-preview', '1');
    const html = await renderLayout();
    for (const name of TRACKING) expect(html).not.toContain(`[mount:${name}]`);
    expect(html).toContain('data-provider="preview"');
    expect(html).toContain('<main>page</main>');
  });
});
