import { describe, expect, it } from 'vitest';

import { DENIED_CONSENT, GRANTED_CONSENT } from '@/lib/tracking/consent';
import { getEventSchema } from '@/lib/tracking/schemas';
import {
  buildWebVitalsBatch,
  consentAllowsWebVitals,
  DEFAULT_SAMPLE_RATE,
  isKitRoute,
  isReportableRoute,
  isSampledIn,
  KIT_SAMPLE_RATE,
  roundMetricValue,
  sampleRateForRoute,
  shapeWebVitalParams,
} from './web-vitals';

describe('routes et échantillonnage', () => {
  it('reconnaît /kit, /kit/…, /{locale}/kit mais pas /kitchen', () => {
    expect(isKitRoute('/kit')).toBe(true);
    expect(isKitRoute('/kit/')).toBe(true);
    expect(isKitRoute('/fr/kit')).toBe(true);
    expect(isKitRoute('/ar/kit/details')).toBe(true);
    expect(isKitRoute('/kitchen')).toBe(false);
    expect(isKitRoute('/fr/kitchen')).toBe(false);
    expect(isKitRoute('/de/kit')).toBe(false);
    expect(isKitRoute('/')).toBe(false);
  });

  it('exclut admin et API', () => {
    expect(isReportableRoute('/admin')).toBe(false);
    expect(isReportableRoute('/admin/components/x')).toBe(false);
    expect(isReportableRoute('/api/track')).toBe(false);
    expect(isReportableRoute('/fr/journal')).toBe(true);
    expect(isReportableRoute('/administration')).toBe(true);
  });

  it('100 % sur /kit, 20 % ailleurs, 0 sur admin', () => {
    expect(sampleRateForRoute('/kit')).toBe(KIT_SAMPLE_RATE);
    expect(sampleRateForRoute('/ar/kit')).toBe(1);
    expect(sampleRateForRoute('/fr/journal')).toBe(DEFAULT_SAMPLE_RATE);
    expect(sampleRateForRoute('/')).toBe(0.2);
    expect(sampleRateForRoute('/admin/login')).toBe(0);
  });

  it('tirage : 1 → toujours, 0 → jamais, sinon random() < rate', () => {
    expect(isSampledIn(1, () => 0.999)).toBe(true);
    expect(isSampledIn(0, () => 0)).toBe(false);
    expect(isSampledIn(0.2, () => 0.19)).toBe(true);
    expect(isSampledIn(0.2, () => 0.2)).toBe(false);
  });

  it('répartition ≈ 20 % sur un tirage déterministe uniforme', () => {
    let i = 0;
    const uniform = () => (i++ % 100) / 100;
    const hits = Array.from({ length: 1000 }, () => isSampledIn(0.2, uniform)).filter(Boolean);
    expect(hits).toHaveLength(200);
  });
});

describe('mise en forme des métriques', () => {
  it('arrondit les ms à l’entier et CLS à 4 décimales', () => {
    expect(roundMetricValue('LCP', 2345.678)).toBe(2346);
    expect(roundMetricValue('TTFB', 0.4)).toBe(0);
    expect(roundMetricValue('CLS', 0.123456)).toBe(0.1235);
  });

  it('produit les params attendus', () => {
    expect(
      shapeWebVitalParams(
        { name: 'LCP', value: 2501.4, rating: 'needs-improvement', navigationType: 'navigate', id: 'v4-1' },
        '/kit',
        1,
      ),
    ).toEqual({
      name: 'LCP',
      value: 2501,
      rating: 'needs-improvement',
      navigation_type: 'navigate',
      page_route: '/kit',
      metric_id: 'v4-1',
      sample_rate: 1,
    });
  });

  it('ignore les métriques non suivies ou invalides', () => {
    expect(shapeWebVitalParams({ name: 'FID', value: 12 }, '/kit', 1)).toBeNull();
    expect(shapeWebVitalParams({ name: 'Next.js-hydration', value: 12 }, '/kit', 1)).toBeNull();
    expect(shapeWebVitalParams({ name: 'LCP', value: Number.NaN }, '/kit', 1)).toBeNull();
    expect(shapeWebVitalParams({ name: 'LCP', value: -1 }, '/kit', 1)).toBeNull();
  });

  it('écarte un rating inconnu sans rejeter la mesure', () => {
    const params = shapeWebVitalParams({ name: 'INP', value: 80, rating: 'meh' }, '/kit', 1);
    expect(params?.rating).toBeUndefined();
    expect(params?.value).toBe(80);
  });

  it('les params produits passent le schéma serveur web_vitals', () => {
    const schema = getEventSchema('web_vitals');
    expect(schema).not.toBeNull();
    const params = shapeWebVitalParams(
      { name: 'CLS', value: 0.05, rating: 'good', navigationType: 'back-forward-cache', id: 'x' },
      '/fr/journal',
      0.2,
    );
    expect(schema!.safeParse(params).success).toBe(true);
    expect(schema!.safeParse({ ...params, extra: 1 }).success).toBe(false);
  });
});

describe('lot /api/track', () => {
  const page = { url: 'https://x.test/kit', path: '/kit', title: 'Kit', referrer: '', locale: 'fr' };
  const user = { anonymous_id: 'aid_test', session_id: 'sid_test' };

  it('un événement web_vitals par métrique, enveloppe complète', () => {
    const a = shapeWebVitalParams({ name: 'FCP', value: 900 }, '/kit', 1)!;
    const b = shapeWebVitalParams({ name: 'TTFB', value: 120 }, '/kit', 1)!;
    const batch = buildWebVitalsBatch([a, b], {
      consent: GRANTED_CONSENT,
      user,
      page,
      now: Date.parse('2026-10-30T10:00:00Z'),
    });
    expect(batch.events).toHaveLength(2);
    const [first, second] = batch.events;
    expect(first!.event).toBe('web_vitals');
    expect(first!.timestamp).toBe('2026-10-30T10:00:00.000Z');
    expect(first!.params).toEqual(a);
    expect(first!.page).toEqual(page);
    expect(first!.user).toEqual(user);
    expect(first!.event_id).not.toBe(second!.event_id);
    expect(first!.event_id.length).toBeGreaterThanOrEqual(8);
  });

  it('consentement : rejeté seulement si analytics ET ads refusés', () => {
    expect(consentAllowsWebVitals(GRANTED_CONSENT)).toBe(true);
    expect(consentAllowsWebVitals(DENIED_CONSENT)).toBe(false);
    expect(consentAllowsWebVitals({ ...DENIED_CONSENT, analytics_storage: 'granted' })).toBe(true);
  });
});
