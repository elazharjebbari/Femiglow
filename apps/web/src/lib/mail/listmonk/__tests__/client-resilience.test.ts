/**
 * LMK-MSW-* — Résilience du client Listmonk (R-014) via MSW (interception
 * réseau réelle, PAS de vi.mock(fetch)).
 *
 * On exerce le VRAI client contre une URL loopback mockée (127.0.0.1:99xx),
 * jamais la prod. Oracles : timeout déterministe (AbortSignal.timeout), retry
 * borné sur transitoire (5xx/réseau/timeout), respect de Retry-After (429),
 * PAS de retry sur 4xx (auth/validation), pagination complète anti-cap-50.
 *
 * Couvre : LMK-MSW-001/002/003, TIMEOUT, RETRY, NORETRY-4XX, 429, AUTH-KO,
 *          PAGE-FULL, PAGE-CAP, 5XX-EXHAUST, BLOCKLIST, CAMPAIGN-CREATE,
 *          CAMPAIGN-STATUS.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

const BASE = 'http://127.0.0.1:9911';

vi.mock('@/lib/env', async () => {
  // NB: factory hoistée → ne référence aucune variable du module (BASE inlined).
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      LISTMONK_INTERNAL_URL: 'http://127.0.0.1:9911',
      LISTMONK_API_USER: 'apiuser',
      LISTMONK_API_TOKEN: 'tok',
    },
  };
});

import {
  listmonk,
  ListmonkApiError,
  ListmonkConfigError,
  ListmonkTimeoutError,
  LISTMONK_TIMEOUT_MS,
  LISTMONK_MAX_RETRIES,
} from '@/lib/mail/listmonk/client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

// ─── Auth & nominal ─────────────────────────────────────────────────────────

describe('Listmonk client — auth & nominal', () => {
  it('LMK-MSW-001 : GET lists nominal -> parse data.results', async () => {
    server.use(
      http.get(`${BASE}/api/lists`, () =>
        HttpResponse.json({ data: { results: [{ id: 1, name: 'L1' }], total: 1 } }),
      ),
    );
    const res = await listmonk.lists.list();
    expect(res.data.total).toBe(1);
    expect(res.data.results[0]).toMatchObject({ id: 1, name: 'L1' });
  });

  it('LMK-MSW-002 : injecte Basic auth (apiuser:tok)', async () => {
    let seenAuth = '';
    server.use(
      http.get(`${BASE}/api/lists`, ({ request }) => {
        seenAuth = request.headers.get('authorization') ?? '';
        return HttpResponse.json({ data: { results: [], total: 0 } });
      }),
    );
    await listmonk.lists.list();
    const expected = `Basic ${Buffer.from('apiuser:tok').toString('base64')}`;
    expect(seenAuth).toBe(expected);
  });
});

// ─── Config manquante (LMK-MSW-003) ─────────────────────────────────────────
// vi.doMock pour ré-importer un client avec creds absents — l'erreur de config
// doit être levée AVANT toute requête réseau (donc onUnhandledRequest:'error'
// ne se déclenche pas).

describe('Listmonk client — config manquante', () => {
  it('LMK-MSW-003 : creds absents -> ListmonkConfigError avant tout fetch', async () => {
    vi.resetModules();
    vi.doMock('@/lib/env', async () => {
      const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
      return {
        ...actual,
        env: { ...actual.env, LISTMONK_INTERNAL_URL: BASE, LISTMONK_API_USER: undefined, LISTMONK_API_TOKEN: undefined },
      };
    });
    const mod = await import('@/lib/mail/listmonk/client');
    // Aucun handler enregistré : si un fetch partait, onUnhandledRequest:'error'
    // ferait échouer. L'oracle est donc DOUBLE : type d'erreur + zéro réseau.
    await expect(mod.listmonk.lists.list()).rejects.toBeInstanceOf(mod.ListmonkConfigError);
    await expect(mod.listmonk.lists.list()).rejects.toMatchObject({
      code: 'LISTMONK_NOT_CONFIGURED',
    });
    vi.doUnmock('@/lib/env');
    vi.resetModules();
  });

  it('expose ListmonkConfigError comme type public', () => {
    expect(ListmonkConfigError).toBeTypeOf('function');
  });
});

// ─── Timeout (CIBLE R-014) ──────────────────────────────────────────────────

describe('Listmonk client — timeout (R-014)', () => {
  it('LMK-MSW-TIMEOUT : requête qui hang -> abort déterministe en ListmonkTimeoutError', async () => {
    vi.useFakeTimers();
    server.use(
      http.get(`${BASE}/api/lists`, async () => {
        await delay('infinite'); // ne résout jamais : seul l'abort tranche
        return HttpResponse.json({ data: { results: [], total: 0 } });
      }),
    );

    const p = listmonk.lists.list();
    // Attache le catch AVANT d'avancer l'horloge pour éviter un unhandled reject.
    const settled = p.then(
      () => ({ ok: true as const }),
      (err: unknown) => ({ ok: false as const, err }),
    );

    // Avance au-delà du timeout + de tous les backoffs de retry. Chaque tentative
    // arme un AbortSignal.timeout(LISTMONK_TIMEOUT_MS) ; sur réseau qui hang,
    // chaque tentative abort puis backoff, donc on avance large.
    const budget = (LISTMONK_TIMEOUT_MS + 1_000) * (LISTMONK_MAX_RETRIES + 1) + 5_000;
    await vi.advanceTimersByTimeAsync(budget);

    const out = await settled;
    expect(out.ok, 'le client NE doit PAS résoudre sur un hang infini').toBe(false);
    if (!out.ok) {
      expect(out.err, 'erreur typée timeout, pas un hang').toBeInstanceOf(ListmonkTimeoutError);
      expect((out.err as ListmonkTimeoutError).code).toBe('LISTMONK_TIMEOUT');
    }
  });

  it('le timeout configuré est une borne finie exportée', () => {
    expect(LISTMONK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(LISTMONK_TIMEOUT_MS)).toBe(true);
  });
});

// ─── Retry / backoff (CIBLE R-014) ──────────────────────────────────────────

describe('Listmonk client — retry/backoff transitoire (R-014)', () => {
  it('LMK-MSW-RETRY : 503 puis 200 -> succès après retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ message: 'busy' }, { status: 503 });
        return HttpResponse.json({ data: { results: [{ id: 1 }], total: 1 } });
      }),
    );
    const res = await listmonk.lists.list();
    expect(res.data.total).toBe(1);
    expect(calls, 'le 503 transitoire doit être retenté').toBe(2);
  });

  it('LMK-MSW-RETRY (réseau) : erreur réseau puis 200 -> succès après retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error(); // panne réseau transitoire
        return HttpResponse.json({ data: { results: [], total: 0 } });
      }),
    );
    await listmonk.lists.list();
    expect(calls, 'une erreur réseau transitoire doit être retentée').toBe(2);
  });

  it('LMK-MSW-NORETRY-4XX : 422 -> une SEULE requête, pas de retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'invalid' }, { status: 422 });
      }),
    );
    await expect(listmonk.lists.list()).rejects.toMatchObject({ status: 422 });
    expect(calls, 'un 4xx déterministe ne se retente jamais').toBe(1);
  });

  it('LMK-MSW-AUTH-KO : 401 -> ListmonkApiError(401), pas de retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'unauthorized' }, { status: 401 });
      }),
    );
    const err = await listmonk.lists.list().catch((e) => e);
    expect(err).toBeInstanceOf(ListmonkApiError);
    expect(err).toMatchObject({ status: 401 });
    expect(calls, 'un 401 ne doit jamais être retenté').toBe(1);
  });

  it('LMK-MSW-5XX-EXHAUST : 503 persistant -> abandon propre après cap', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'down' }, { status: 503 });
      }),
    );
    await expect(listmonk.lists.list()).rejects.toMatchObject({ status: 503 });
    // 1 initiale + LISTMONK_MAX_RETRIES → borne stricte, pas de retry infini.
    expect(calls).toBe(LISTMONK_MAX_RETRIES + 1);
  });
});

// ─── 429 Retry-After (CIBLE R-014) ──────────────────────────────────────────

describe('Listmonk client — 429 Retry-After (R-014)', () => {
  it('LMK-MSW-429 : 429 Retry-After:1 -> attend ~1s puis retente avec succès', async () => {
    let calls = 0;
    const times: number[] = [];
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        times.push(Date.now());
        if (calls === 1) {
          return new HttpResponse(JSON.stringify({ message: 'rate' }), {
            status: 429,
            headers: { 'Retry-After': '1', 'content-type': 'application/json' },
          });
        }
        return HttpResponse.json({ data: { results: [], total: 0 } });
      }),
    );
    await listmonk.lists.list();
    expect(calls, 'le 429 doit déclencher une retry').toBe(2);
    // Oracle Retry-After honoré : ≥ ~900ms entre les deux tentatives.
    expect(times[1]! - times[0]!, 'a attendu le Retry-After').toBeGreaterThanOrEqual(900);
  }, 10_000);
});

// ─── Pagination complète (CIBLE L-PAGE) ─────────────────────────────────────

describe('Listmonk client — pagination complète (anti cap 50)', () => {
  function paginatedSubscribers(total: number) {
    return http.get(`${BASE}/api/subscribers`, ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const perPage = Number(url.searchParams.get('per_page') ?? '50');
      const start = (page - 1) * perPage;
      const results = Array.from(
        { length: Math.max(0, Math.min(perPage, total - start)) },
        (_, i) => ({ id: start + i + 1, email: `s${start + i + 1}@exemple.test` }),
      );
      return HttpResponse.json({ data: { results, total } });
    });
  }

  it('LMK-MSW-PAGE-FULL : 130 abonnés sur 3 pages -> tous récupérés', async () => {
    server.use(paginatedSubscribers(130));
    const all = await listmonk.subscribers.listAll({ list_id: 7, per_page: 50 });
    expect(all, 'tous les abonnés, pas un cap à 50').toHaveLength(130);
    // Unicité : aucun doublon de page (id 1..130 distincts).
    expect(new Set(all.map((s) => s.id)).size).toBe(130);
  });

  it('LMK-MSW-PAGE-CAP : list() brut tronque à per_page (régression documentée)', async () => {
    server.use(paginatedSubscribers(130));
    // list() ne ramène QUE la 1re page → 50. C'est le piège que listAll() corrige.
    const onePage = await listmonk.subscribers.list({ list_id: 7, per_page: 50 });
    expect(onePage.data.results, 'list() est volontairement borné à per_page').toHaveLength(50);
    expect(onePage.data.total, 'mais expose le total réel pour signaler la troncature').toBe(130);
  });
});

// ─── Actions ciblées ────────────────────────────────────────────────────────

describe('Listmonk client — actions ciblées', () => {
  it('LMK-MSW-BLOCKLIST : blocklist envoie PUT avec ids', async () => {
    let method = '';
    let body: unknown;
    server.use(
      http.put(`${BASE}/api/subscribers/blocklist`, async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({ data: { count: 1 } });
      }),
    );
    await listmonk.subscribers.blocklist(['mort@exemple.test']);
    expect(method).toBe('PUT');
    expect(body).toMatchObject({ ids: ['mort@exemple.test'] });
  });

  it('LMK-MSW-CAMPAIGN-CREATE : campaigns.create POST body complet', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/campaigns`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { id: 9, status: 'draft' } });
      }),
    );
    await listmonk.campaigns.create({
      name: 'Newsletter',
      subject: 'Sujet',
      lists: [3, 4],
      from_email: 'info@femiglow-maroc.com',
      body: '<p>Bonjour</p>',
    });
    expect(body).toMatchObject({
      name: 'Newsletter',
      from_email: 'info@femiglow-maroc.com',
      lists: [3, 4],
      body: '<p>Bonjour</p>',
    });
  });

  it('LMK-MSW-CAMPAIGN-STATUS : updateStatus PUT body status', async () => {
    let method = '';
    let body: unknown;
    let seenPath = '';
    server.use(
      http.put(`${BASE}/api/campaigns/:id/status`, async ({ request, params }) => {
        method = request.method;
        seenPath = String(params.id);
        body = await request.json();
        return HttpResponse.json({ data: { status: 'running' } });
      }),
    );
    await listmonk.campaigns.updateStatus(55, 'running');
    expect(method).toBe('PUT');
    expect(seenPath).toBe('55');
    expect(body).toMatchObject({ status: 'running' });
  });
});
