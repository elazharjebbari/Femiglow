import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dispatcher', () => ({
  dispatchToProviders: vi.fn(),
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/db/queries/tracking/events-log', () => ({
  logEvent: vi.fn(),
}));

vi.mock('@/lib/db/queries/tracking/pages', () => ({
  findTrackingPageByRoute: vi.fn(),
}));

import { logEvent } from '@/lib/db/queries/tracking/events-log';
import { findTrackingPageByRoute } from '@/lib/db/queries/tracking/pages';
import { dispatchToProviders } from './dispatcher';
import { serverFire, type ServerFireInput } from './server-fire';
import { logger } from '@/lib/logging/logger';

const dispatchMock = vi.mocked(dispatchToProviders);
const loggerErrorMock = vi.mocked(logger.error);
const logEventMock = vi.mocked(logEvent);
const findPageMock = vi.mocked(findTrackingPageByRoute);

function makeHeaders(map: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(map)) h.set(k, v);
  return h;
}

function makeCookies(map: Record<string, string>): ServerFireInput['cookies'] {
  return {
    get(name: string) {
      return name in map ? { value: map[name]! } : undefined;
    },
  };
}

const grantedConsent = encodeURIComponent(
  JSON.stringify({
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    functional_storage: 'granted',
  }),
);

const deniedConsent = encodeURIComponent(
  JSON.stringify({
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functional_storage: 'denied',
  }),
);

function input(overrides: Partial<ServerFireInput> = {}): ServerFireInput {
  return {
    eventName: 'view_item',
    pageId: 'kit',
    pageRoute: '/kit',
    pageUrl: 'https://femiglow-maroc.com/kit',
    params: { currency: 'MAD', value: 320, items: [{ item_id: 'kit', quantity: 1, price: 320 }] },
    headers: makeHeaders({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15',
      'accept-language': 'fr-MA,fr;q=0.9',
      'x-forwarded-for': '197.230.10.20',
    }),
    cookies: makeCookies({
      fg_consent: grantedConsent,
      _fbp: 'fb.1.1700000000000.123',
      _fbc: 'fb.1.1700000000000.abc',
      fg_session_id: 'sess_abc',
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dispatchMock.mockResolvedValue({ dispatched: ['meta'], results: {} });
  findPageMock.mockResolvedValue(null);
});

describe('serverFire — persistance tracking_events_log', () => {
  it('page_id = id tracking_pages de la route, jamais le libellé passé par la page', async () => {
    findPageMock.mockResolvedValue({ id: 'tp_kit' } as never);
    await serverFire(input());
    expect(findPageMock).toHaveBeenCalledWith('/kit');
    expect(logEventMock.mock.calls[0]![0]).toMatchObject({ pageId: 'tp_kit', pageRoute: '/kit' });
  });

  it('route inconnue ou lecture en échec : page_id null, événement quand même enregistré', async () => {
    await serverFire(input({ pageRoute: '/ar/kit' }));
    findPageMock.mockRejectedValue(new Error('db down'));
    await serverFire(input());
    expect(logEventMock).toHaveBeenCalledTimes(2);
    expect(logEventMock.mock.calls.map(([e]) => e.pageId)).toEqual([null, null]);
  });

  it('l’event_id reste dérivé du libellé : la déduplication Meta ne change pas', async () => {
    findPageMock.mockResolvedValue({ id: 'tp_kit' } as never);
    await serverFire(input());
    expect(logEventMock.mock.calls[0]![0].eventId).toBe(dispatchMock.mock.calls[0]![0].eventId);
  });
});

describe('serverFire', () => {
  it('fires and dispatches when all checks pass', async () => {
    const result = await serverFire(input());
    expect(result.status).toBe('fired');
    expect(result.dispatched).toEqual(['meta']);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards a deterministic event_id (32 hex chars)', async () => {
    await serverFire(input());
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.eventId).toMatch(/^[a-f0-9]{32}$/);
  });

  it('forwards fbp and fbc from cookies', async () => {
    await serverFire(input());
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.fbp).toBe('fb.1.1700000000000.123');
    expect(ctx.fbc).toBe('fb.1.1700000000000.abc');
  });

  it('uses fg_session_id as sessionId when present', async () => {
    await serverFire(input());
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.sessionId).toBe('sess_abc');
    expect(ctx.anonymousId).toBe('sess_abc');
  });

  it('falls back to _fbp as sessionId when fg_session_id is absent', async () => {
    await serverFire(
      input({
        cookies: makeCookies({
          fg_consent: grantedConsent,
          _fbp: 'fb.1.fallback.456',
        }),
      }),
    );
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.sessionId).toBe('fb.1.fallback.456');
  });

  it('anonymizes the IP from x-forwarded-for', async () => {
    await serverFire(input());
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.ipAnonymized).toBe('197.230.10.0');
  });

  it('hashes the user-agent (32 hex chars)', async () => {
    await serverFire(input());
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.uaHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('skips with reason=bot_ua when UA is a bot', async () => {
    const result = await serverFire(
      input({
        headers: makeHeaders({
          'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        }),
      }),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'bot_ua' });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('skips with reason=no_session when neither fg_session_id nor _fbp is set', async () => {
    const result = await serverFire(
      input({
        cookies: makeCookies({ fg_consent: grantedConsent }),
      }),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'no_session' });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('skips with reason=consent_denied when ad_storage is denied (RGPD)', async () => {
    const result = await serverFire(
      input({
        cookies: makeCookies({
          fg_consent: deniedConsent,
          _fbp: 'fb.1.x',
          fg_session_id: 'sess_x',
        }),
      }),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'consent_denied' });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('skips with reason=consent_denied when fg_consent cookie is malformed JSON', async () => {
    const result = await serverFire(
      input({
        cookies: makeCookies({
          fg_consent: '%7Bbroken-json',
          _fbp: 'fb.1.x',
          fg_session_id: 'sess_x',
        }),
      }),
    );
    // Fallback to DENIED_CONSENT → ad_storage denied → skip.
    expect(result).toEqual({ status: 'skipped', reason: 'consent_denied' });
  });

  it('does NOT throw if dispatchToProviders rejects (fire-and-forget)', async () => {
    dispatchMock.mockRejectedValue(new Error('graph.facebook.com unreachable'));
    const result = await serverFire(input());
    expect(result).toEqual({ status: 'skipped', reason: 'dispatch_threw' });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'tracking.server_fire.failed',
      expect.objectContaining({
        event_name: 'view_item',
        page_id: 'kit',
        error: 'graph.facebook.com unreachable',
      }),
    );
  });

  it('uses ecommerce category for view_item (auto-derived)', async () => {
    dispatchMock.mockRejectedValue(new Error('test'));
    await serverFire(input());
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'tracking.server_fire.failed',
      expect.objectContaining({ category: 'ecommerce' }),
    );
  });

  it('forwards params verbatim (no mutation)', async () => {
    const original = { currency: 'MAD', value: 320, items: [{ item_id: 'kit' }] };
    await serverFire(input({ params: original }));
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.params).toBe(original);
  });

  it('uses default locale fr-MA when accept-language missing', async () => {
    await serverFire(
      input({
        headers: makeHeaders({
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 Safari/605.1.15',
          'x-forwarded-for': '1.2.3.4',
        }),
      }),
    );
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.locale).toBe('fr-MA');
  });

  it('falls back IP to 0.0.0.0 when no x-forwarded-for / x-real-ip', async () => {
    await serverFire(
      input({
        headers: makeHeaders({
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 Safari/605.1.15',
        }),
      }),
    );
    const ctx = dispatchMock.mock.calls[0]![0];
    expect(ctx.ipAnonymized).toBe('0.0.0.0');
  });
});
