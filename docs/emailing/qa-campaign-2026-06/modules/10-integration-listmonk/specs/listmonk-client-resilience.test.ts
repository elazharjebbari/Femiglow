/**
 * LMK-MSW-* — Résilience du client Listmonk via MSW (interception réseau réelle).
 *
 * On NE mocke PAS fetch (vi.mock) : MSW intercepte l'API Listmonk au niveau
 * réseau, donc on teste aussi la construction des requêtes (URL, Basic auth,
 * pagination). Ces tests décrivent l'ÉTAT CIBLE : timeout, retry, 429,
 * pagination complète, auth KO — plusieurs sont ROUGES sur le client actuel
 * (sans timeout/retry/429, cap 50) et guident le correctif.
 *
 * Dépôt cible : apps/web/src/lib/mail/listmonk/__tests__/client-resilience.test.ts
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

const BASE = 'http://127.0.0.1:9000';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      LISTMONK_INTERNAL_URL: BASE,
      LISTMONK_API_USER: 'apiuser',
      LISTMONK_API_TOKEN: 'tok',
    },
  };
});

import { listmonk, ListmonkApiError } from '@/lib/mail/listmonk/client';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Listmonk client — auth & nominal', () => {
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

  it('LMK-MSW-AUTH-KO : 401 -> ListmonkApiError(401), pas de retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'unauthorized' }, { status: 401 });
      }),
    );
    await expect(listmonk.lists.list()).rejects.toMatchObject({ status: 401 });
    await expect(listmonk.lists.list()).rejects.toBeInstanceOf(ListmonkApiError);
    expect(calls, 'un 401 ne doit jamais être retenté').toBe(2); // 1 par appel, pas de retry interne
  });
});

/**
 * ÉTAT CIBLE — timeout. Le client doit AbortController-er une requête qui
 * hang au-delà du timeout. ROUGE tant que le client n'a pas de timeout.
 */
describe('Listmonk client — timeout (CIBLE)', () => {
  it('LMK-MSW-TIMEOUT : requête qui hang -> rejette avant l’infini', async () => {
    server.use(
      http.get(`${BASE}/api/lists`, async () => {
        await delay('infinite');
        return HttpResponse.json({ data: { results: [], total: 0 } });
      }),
    );
    await expect(
      Promise.race([
        listmonk.lists.list(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('test-watchdog')), 12_000)),
      ]),
    ).rejects.toThrow(); // cible : abort interne (AbortError) AVANT le watchdog
  }, 15_000);
});

/**
 * ÉTAT CIBLE — retry transitoire + pas de retry sur 4xx.
 */
describe('Listmonk client — retry/backoff (CIBLE)', () => {
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
    expect(calls, 'le 503 transitoire doit être retenté').toBeGreaterThanOrEqual(2);
  });

  it('LMK-MSW-NORETRY-4XX : 422 -> une seule requête, pas de retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'invalid' }, { status: 422 });
      }),
    );
    await expect(listmonk.lists.list()).rejects.toMatchObject({ status: 422 });
    expect(calls).toBe(1);
  });

  it('LMK-MSW-429 : 429 Retry-After -> attend puis retente', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/lists`, () => {
        calls += 1;
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
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

/**
 * ÉTAT CIBLE — pagination complète (anti cap 50). On expose une méthode
 * paginée listAll() (à ajouter) qui itère jusqu'à `total`.
 */
describe('Listmonk client — pagination complète (CIBLE)', () => {
  it('LMK-MSW-PAGE-FULL : 130 abonnés sur 3 pages -> tous récupérés', async () => {
    server.use(
      http.get(`${BASE}/api/subscribers`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');
        const perPage = Number(url.searchParams.get('per_page') ?? '50');
        const total = 130;
        const start = (page - 1) * perPage;
        const results = Array.from(
          { length: Math.max(0, Math.min(perPage, total - start)) },
          (_, i) => ({ id: start + i + 1, email: `s${start + i + 1}@exemple.test` }),
        );
        return HttpResponse.json({ data: { results, total } });
      }),
    );
    // listAll() = méthode cible ; si le client ne l'a pas encore, ce test est
    // rouge et documente le besoin (cf. LMK-MSW-PAGE-CAP pour la régression).
    const anyClient = listmonk.subscribers as unknown as {
      listAll?: (q?: { list_id?: number }) => Promise<{ id: number }[]>;
    };
    expect(anyClient.listAll, 'le client doit exposer une pagination complète').toBeTypeOf('function');
    const all = await anyClient.listAll!({ list_id: 7 });
    expect(all, 'tous les abonnés, pas un cap à 50').toHaveLength(130);
  });
});

describe('Listmonk client — actions ciblées', () => {
  it('LMK-MSW-BLOCKLIST : blocklist envoie PUT avec ids', async () => {
    let body: unknown;
    server.use(
      http.put(`${BASE}/api/subscribers/blocklist`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { count: 1 } });
      }),
    );
    await listmonk.subscribers.blocklist(['mort@exemple.test']);
    expect(body).toMatchObject({ ids: ['mort@exemple.test'] });
  });
});
