/**
 * Tests enrichEvent — cœur du fix attribution.
 *
 * Couvre les 4 chemins de résolution :
 *  1. DB attribution (visitor_attribution rempli)
 *  2. Request signals (UTM + click IDs depuis cookies)
 *  3. Client hint (entry.attribution annoté)
 *  4. Fallback direct
 *
 * Mock `findAttributionByVisitor` via vi.mock pour isoler le helper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enrichEvent } from './enrich-event';
import type { RequestSignals } from './request-signals';

vi.mock('../attribution/repository', () => ({
  findAttributionByVisitor: vi.fn(),
}));

import { findAttributionByVisitor } from '../attribution/repository';

const mockedFindAttribution = vi.mocked(findAttributionByVisitor);

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
  mockedFindAttribution.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('enrichEvent — DB attribution (priorité 1)', () => {
  it('DB attribution Meta paid → paid_social, source meta', async () => {
    mockedFindAttribution.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          click_id: 'FB123',
          click_id_field: 'fbclid',
          utm: { source: 'meta', medium: 'cpc', campaign: 'spring' },
          detected_at: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    const enriched = await enrichEvent({
      anonymousId: 'visitor-1',
      requestSignals: emptySignals,
    });

    expect(enriched.trafficSource).toBe('paid_social');
    expect(enriched.trafficMedium).toBe('cpc');
    expect(enriched.utm.source).toBe('meta');
    expect(enriched.utm.campaign).toBe('spring');
    expect(enriched.resolutionSource).toBe('db_attribution');
    expect(enriched.classification.isPaid).toBe(true);
  });

  it('DB attribution Google Ads paid → paid_search', async () => {
    mockedFindAttribution.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'google_ads',
          is_paid: true,
          click_id: 'GCLID-ABC',
          click_id_field: 'gclid',
          utm: { source: 'google', medium: 'cpc' },
          detected_at: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v1',
      requestSignals: emptySignals,
    });

    expect(enriched.trafficSource).toBe('paid_search');
    expect(enriched.resolutionSource).toBe('db_attribution');
  });

  it('DB sans paid_history mais last_touch organic → utilise last_touch (strategy default)', async () => {
    // last_paid_touch (default) sans paid_history → defaultDirect
    // Donc on retombe sur étape 2 (request signals) → puis 4 (direct).
    mockedFindAttribution.mockResolvedValue({
      first_touch: {
        channel: 'organic',
        is_paid: false,
        utm: { source: 'google', medium: 'organic' },
        detected_at: '2026-05-01T10:00:00.000Z',
      },
      last_touch: {
        channel: 'organic',
        is_paid: false,
        utm: { source: 'google', medium: 'organic' },
        detected_at: '2026-05-01T10:00:00.000Z',
      },
      paid_history: [],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v1',
      requestSignals: emptySignals,
    });

    // Avec strategy=last_paid_touch et pas de paid → direct
    expect(enriched.resolutionSource).toBe('fallback');
    expect(enriched.trafficSource).toBe('direct');
  });

  it('strategy=last_touch utilise last_touch (paid ou non)', async () => {
    mockedFindAttribution.mockResolvedValue({
      first_touch: null,
      last_touch: {
        channel: 'organic',
        is_paid: false,
        utm: { source: 'google', medium: 'organic' },
        detected_at: '2026-05-01T10:00:00.000Z',
      },
      paid_history: [],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v1',
      requestSignals: emptySignals,
      strategy: 'last_touch',
    });

    expect(enriched.trafficSource).toBe('organic_search');
    expect(enriched.resolutionSource).toBe('db_attribution');
  });
});

describe('enrichEvent — Request signals (priorité 2)', () => {
  it('cookies fbclid → paid_social (sans DB)', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'new-visitor',
      requestSignals: {
        ...emptySignals,
        clickIds: { fbclid: 'FB-NEW' },
      },
    });

    expect(enriched.trafficSource).toBe('paid_social');
    expect(enriched.classification.source).toBe('meta');
    expect(enriched.resolutionSource).toBe('request_signals');
  });

  it('UTM medium=cpc + source=google (sans DB) → paid_search', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        utm: { source: 'google', medium: 'cpc' },
      },
    });

    expect(enriched.trafficSource).toBe('paid_search');
    expect(enriched.utm.source).toBe('google');
  });

  it('referrer instagram → organic_social (sans DB ni UTM)', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        referrer: 'https://www.instagram.com/',
      },
    });

    expect(enriched.trafficSource).toBe('organic_social');
    expect(enriched.classification.source).toBe('instagram');
  });

  it('anonymousId null → skip DB, utilise request signals', async () => {
    const enriched = await enrichEvent({
      anonymousId: null,
      requestSignals: {
        ...emptySignals,
        clickIds: { gclid: 'G' },
      },
    });

    expect(mockedFindAttribution).not.toHaveBeenCalled();
    expect(enriched.trafficSource).toBe('paid_search');
  });
});

describe('enrichEvent — Client hint (priorité 3)', () => {
  it('clientHint meta paid (sans DB ni signals) → paid_social', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      clientHint: {
        channel: 'meta',
        isPaid: true,
        utm: { source: 'meta', medium: 'cpc', campaign: 'x' },
      },
    });

    expect(enriched.trafficSource).toBe('paid_social');
    expect(enriched.resolutionSource).toBe('client_hint');
  });

  it('clientHint direct → ne fait pas remonter direct depuis hint, va au fallback', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
      clientHint: { channel: 'direct', isPaid: false },
    });

    expect(enriched.resolutionSource).toBe('fallback');
    expect(enriched.trafficSource).toBe('direct');
  });
});

describe('enrichEvent — Fallback direct (priorité 4)', () => {
  it('aucun signal nulle part → direct/none/fallback', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: emptySignals,
    });

    expect(enriched.trafficSource).toBe('direct');
    expect(enriched.trafficMedium).toBe('none');
    expect(enriched.resolutionSource).toBe('fallback');
    expect(enriched.fbc).toBe(null);
  });
});

describe('enrichEvent — Champs auxiliaires', () => {
  it('fbp + fbc propagés depuis requestSignals', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        fbp: 'fb.1.123.456',
        fbc: 'fb.1.789.ABC',
        clickIds: { fbclid: 'XYZ' },
      },
    });

    expect(enriched.fbp).toBe('fb.1.123.456');
    expect(enriched.fbc).toBe('fb.1.789.ABC');
  });

  it('gclid propagé', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        clickIds: { gclid: 'GCLID-XYZ' },
      },
    });

    expect(enriched.gclid).toBe('GCLID-XYZ');
  });

  it('referrer propagé même si direct', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        referrer: 'https://unknown-site.com/',
      },
    });

    // referrer inconnu → bucket 'referral' (low confidence)
    expect(enriched.trafficSource).toBe('referral');
    expect(enriched.referrer).toBe('https://unknown-site.com/');
  });
});

describe('enrichEvent — Priorité entre couches', () => {
  it('DB attribution écrase request signals même si signals présents', async () => {
    mockedFindAttribution.mockResolvedValue({
      first_touch: null,
      last_touch: null,
      paid_history: [
        {
          channel: 'meta',
          is_paid: true,
          click_id_field: 'fbclid',
          detected_at: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        clickIds: { gclid: 'WRONG-GOOGLE-CLICK' }, // signal différent
      },
    });

    // DB Meta gagne, on n'utilise pas le gclid request
    expect(enriched.trafficSource).toBe('paid_social');
    expect(enriched.resolutionSource).toBe('db_attribution');
  });

  it('request signals écrase client hint quand DB vide', async () => {
    mockedFindAttribution.mockResolvedValue(null);

    const enriched = await enrichEvent({
      anonymousId: 'v',
      requestSignals: {
        ...emptySignals,
        clickIds: { gclid: 'G1' }, // signals dit paid_search
      },
      clientHint: {
        channel: 'meta', // hint dit paid_social
        isPaid: true,
      },
    });

    expect(enriched.trafficSource).toBe('paid_search'); // signals gagne
    expect(enriched.resolutionSource).toBe('request_signals');
  });
});
