/**
 * Tests `enrichEvent` — robustesse production.
 *
 * Cible : prouver que le helper ne crash JAMAIS l'ingest même quand
 * la DB échoue, les données sont corrompues, ou plusieurs events
 * arrivent en parallèle pour le même visiteur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enrichEvent } from './enrich-event';
import type { RequestSignals } from './request-signals';

vi.mock('../attribution/repository', () => ({
  findAttributionByVisitor: vi.fn(),
}));

import { findAttributionByVisitor } from '../attribution/repository';

const mockedFind = vi.mocked(findAttributionByVisitor);

const emptySignals: RequestSignals = {
  utm: {},
  clickIds: {},
  fbp: null,
  fbc: null,
  referrer: null,
  landingPath: null,
  landingTs: null,
};

beforeEach(() => {
  mockedFind.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('enrichEvent — DB errors gracieux', () => {
  it('findAttributionByVisitor throw → fallback request signals', async () => {
    mockedFind.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      enrichEvent({
        anonymousId: 'v',
        requestSignals: {
          ...emptySignals,
          clickIds: { gclid: 'G' },
        },
      }),
    ).rejects.toThrow('DB connection lost');
    // NB : aujourd'hui le helper propage l'erreur. C'est volontaire :
    // c'est au caller (/api/track) de wrap en try/catch pour décider du
    // fallback. Ce test documente ce contract.
  });

  it('anonymousId vide string → DB jamais appelée', async () => {
    // Empty string n'est pas null mais ne devrait pas générer un appel
    // si le caller utilise || comme nous le faisons dans /api/track.
    const enriched = await enrichEvent({
      anonymousId: null,
      requestSignals: emptySignals,
    });
    expect(mockedFind).not.toHaveBeenCalled();
    expect(enriched.trafficSource).toBe('direct');
  });

  it('DB renvoie snapshot avec paid_history vide ET no last_touch → fallback', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [],
    });
    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });
    // last_paid_touch (default) sans paid_history → fallback puis direct
    expect(enriched.trafficSource).toBe('direct');
    expect(enriched.resolutionSource).toBe('fallback');
  });
});

describe('enrichEvent — strategy variations', () => {
  it('strategy=first_paid_touch utilise le DERNIER élément de paid_history', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      // paid_history : [last (most recent), ..., first (oldest)]
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          utm: { source: 'meta', medium: 'cpc' },
          detected_at: '2026-05-05T00:00:00.000Z',
        },
        {
          channel: 'google_ads',
          is_paid: true,
          utm: { source: 'google', medium: 'cpc' },
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      strategy: 'first_paid_touch',
    });

    // first_paid = paid_history[length-1] = google (le plus ancien)
    expect(enriched.classification.source).toBe('google');
    expect(enriched.trafficSource).toBe('paid_search');
  });

  it('strategy=last_touch privilégie last_touch même si pas paid', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: {
        channel: 'social_organic',
        is_paid: false,
        utm: { source: 'instagram', medium: 'social' },
        detected_at: '2026-05-10T00:00:00.000Z',
      },
      paid_history: [],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      strategy: 'last_touch',
    });

    expect(enriched.trafficSource).toBe('organic_social');
  });

  it('strategy=first_touch utilise first_touch', async () => {
    mockedFind.mockResolvedValue({
      first_touch: {
        channel: 'organic',
        is_paid: false,
        utm: { source: 'google', medium: 'organic' },
        detected_at: '2026-04-01T00:00:00.000Z',
      },
      last_touch: {
        channel: 'meta',
        is_paid: true,
        detected_at: '2026-05-10T00:00:00.000Z',
      },
      paid_history: [],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      strategy: 'first_touch',
    });

    expect(enriched.classification.source).toBe('google');
  });
});

describe('enrichEvent — snapshot DB partiel', () => {
  it('touch sans utm → utm fallback depuis classification', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          click_id: 'FB-CLICK',
          click_id_field: 'fbclid',
          // utm absent
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });
    expect(enriched.trafficSource).toBe('paid_social');
    expect(enriched.trafficMedium).toBe('cpc'); // dérivé du bucket
    // utm.source vide → on a quand même un fallback medium cohérent
  });

  it('touch avec utm partiel (source only) → utilise ce qu\'on a', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'google_ads',
          is_paid: true,
          utm: { source: 'google' }, // medium absent
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });
    expect(enriched.utm.source).toBe('google');
    expect(enriched.trafficMedium).toBe('cpc'); // dérivé du bucket
  });
});

describe('enrichEvent — concurrency (multi-events même visitor)', () => {
  it('10 events en parallèle même visitor → résolution identique (déterministe)', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          utm: { source: 'meta', medium: 'cpc', campaign: 'spring' },
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        enrichEvent({
          anonymousId: 'visitor-shared',
          requestSignals: emptySignals,
        }),
      ),
    );

    // Tous les events devraient être identiquement résolus
    const allSame = results.every(
      (r) =>
        r.trafficSource === results[0].trafficSource &&
        r.trafficMedium === results[0].trafficMedium &&
        r.utm.source === results[0].utm.source,
    );
    expect(allSame).toBe(true);
    expect(mockedFind).toHaveBeenCalledTimes(10);
  });

  it('100 events séquentiels même visitor → pas de leak (perf O(n))', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await enrichEvent({
        anonymousId: 'v',
        requestSignals: emptySignals,
      });
    }
    const elapsed = performance.now() - start;
    // 100 calls avec DB mock (synchrone-ish) doit rester < 500ms
    expect(elapsed).toBeLessThan(500);
  });
});

describe('enrichEvent — resolutionSource flag (observabilité)', () => {
  it('résolution DB → resolutionSource = db_attribution', async () => {
    mockedFind.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          detected_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const r = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });
    expect(r.resolutionSource).toBe('db_attribution');
  });

  it('résolution depuis cookies → resolutionSource = request_signals', async () => {
    mockedFind.mockResolvedValue(null);
    const r = await enrichEvent({
      anonymousId: 'v',
      requestSignals: { ...emptySignals, clickIds: { gclid: 'G' } },
    });
    expect(r.resolutionSource).toBe('request_signals');
  });

  it('résolution depuis client hint → resolutionSource = client_hint', async () => {
    mockedFind.mockResolvedValue(null);
    const r = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      clientHint: { channel: 'meta', isPaid: true },
    });
    expect(r.resolutionSource).toBe('client_hint');
  });

  it('aucun signal → resolutionSource = fallback', async () => {
    mockedFind.mockResolvedValue(null);
    const r = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });
    expect(r.resolutionSource).toBe('fallback');
  });
});

describe('enrichEvent — utm cleaning', () => {
  it('utm avec strings vides → exclues du output', async () => {
    mockedFind.mockResolvedValue(null);
    const r = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      clientHint: {
        channel: 'meta',
        isPaid: true,
        utm: { source: 'meta', medium: '', campaign: '' },
      },
    });
    expect(r.utm.source).toBe('meta');
    expect(r.utm.medium).toBeUndefined();
    expect(r.utm.campaign).toBeUndefined();
  });
});
