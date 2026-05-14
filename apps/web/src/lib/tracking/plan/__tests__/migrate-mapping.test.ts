import { describe, it, expect } from 'vitest';
import { mapProviders, mapEvents } from '../../../../../scripts/migrate-tracking-to-plan';
import type { TrackingProvider as LegacyProvider } from '@/lib/db/types';

function legacyProvider(partial: Partial<LegacyProvider> & { kind: LegacyProvider['kind'] }): LegacyProvider {
  return {
    id: 'p_' + partial.kind,
    kind: partial.kind,
    status: partial.status ?? 'disabled',
    pixelId: partial.pixelId ?? null,
    capiToken: null,
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: null,
    customHead: null,
    customBody: null,
    config: partial.config ?? {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('mapProviders', () => {
  it('mappe google_ga4 vers ga4 et extrait measurementId depuis config', () => {
    const { providers, envConfig } = mapProviders([
      legacyProvider({ kind: 'google_ga4', status: 'enabled', config: { measurementId: 'G-5VHP17SDZM' } }),
    ]);
    expect(providers).toEqual([{ id: 'ga4', active: true }]);
    expect(envConfig.ga4MeasurementId).toBe('G-5VHP17SDZM');
  });

  it('fallback sur pixelId si config.measurementId absent', () => {
    const { envConfig } = mapProviders([
      legacyProvider({ kind: 'google_ga4', status: 'enabled', pixelId: 'G-FALLBACK' }),
    ]);
    expect(envConfig.ga4MeasurementId).toBe('G-FALLBACK');
  });

  it('mappe meta et tiktok via pixelId', () => {
    const { providers, envConfig } = mapProviders([
      legacyProvider({ kind: 'meta', status: 'enabled', pixelId: '987654321987654' }),
      legacyProvider({ kind: 'tiktok', status: 'enabled', pixelId: 'CRP12345' }),
    ]);
    expect(providers).toEqual([
      { id: 'meta', active: true },
      { id: 'tiktok', active: true },
    ]);
    expect(envConfig.metaPixelId).toBe('987654321987654');
    expect(envConfig.tiktokPixelId).toBe('CRP12345');
  });

  it('skippe les providers sans équivalent (snap, pinterest, custom)', () => {
    const { providers, skipped } = mapProviders([
      legacyProvider({ kind: 'snap', status: 'enabled' }),
      legacyProvider({ kind: 'pinterest', status: 'enabled' }),
      legacyProvider({ kind: 'custom', status: 'enabled' }),
    ]);
    expect(providers).toEqual([]);
    expect(skipped).toHaveLength(3);
  });

  it('respecte le statut enabled/disabled', () => {
    const { providers } = mapProviders([
      legacyProvider({ kind: 'meta', status: 'enabled' }),
      legacyProvider({ kind: 'tiktok', status: 'disabled' }),
    ]);
    expect(providers).toEqual([
      { id: 'meta', active: true },
      { id: 'tiktok', active: false },
    ]);
  });
});

describe('mapEvents', () => {
  it('mappe les noms valides en snake_case avec providers connus', () => {
    const events = mapEvents(
      [
        { name: 'page_view', defaultProviders: ['google_ga4', 'meta'] },
        { name: 'purchase', defaultProviders: ['google_ga4', 'google_ads'] },
      ],
      ['ga4', 'meta', 'googleAds'],
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ key: 'page_view', providers: { ga4: true, meta: true } });
    expect(events[1]).toEqual({ key: 'purchase', providers: { ga4: true, googleAds: true } });
  });

  it('ignore les events dont le nom ne matche pas snake_case', () => {
    const events = mapEvents(
      [{ name: 'PageView', defaultProviders: ['google_ga4'] }],
      ['ga4'],
    );
    expect(events).toEqual([]);
  });

  it('exclut les providers non présents dans le plan', () => {
    const events = mapEvents(
      [{ name: 'page_view', defaultProviders: ['google_ga4', 'snap'] }],
      ['ga4'],
    );
    expect(events[0]?.providers).toEqual({ ga4: true });
  });
});
