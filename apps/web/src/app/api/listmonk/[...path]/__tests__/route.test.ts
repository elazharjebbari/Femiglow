/**
 * LMK-INT-PROXY-* — Reverse-proxy admin → Listmonk loopback.
 *
 * Oracles : sans session admin -> 401 et AUCUN appel upstream (créds jamais
 * exposés) ; créds Listmonk absents -> 503 ; avec session -> Basic auth injecté
 * CÔTÉ SERVEUR (jamais renvoyé au navigateur) ; les en-têtes de framing
 * (X-Frame-Options / CSP) de Listmonk sont strippés de la réponse (le parent
 * ré-applique sa propre CSP) tandis que les en-têtes utiles passent.
 *
 * On exerce le VRAI handler ; l'upstream Listmonk est mocké par MSW sur une URL
 * loopback (127.0.0.1:99xx), jamais la prod.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextRequest } from 'next/server';

const BASE = 'http://127.0.0.1:9915';

// requireAdmin : par défaut authentifié ; bascule via `authed`.
let authed = true;
const adminSession = { email: 'op@femiglow.local' };
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => {
    if (!authed) throw new Error('redirect to login');
    return adminSession;
  }),
}));

// env : créds présents par défaut ; bascule via `hasCreds`.
let hasCreds = true;
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    get env() {
      return {
        ...actual.env,
        LISTMONK_INTERNAL_URL: 'http://127.0.0.1:9915',
        LISTMONK_API_USER: hasCreds ? 'apiuser' : undefined,
        LISTMONK_API_TOKEN: hasCreds ? 'tok' : undefined,
      };
    },
  };
});

import { GET, POST } from '../route';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  authed = true;
  hasCreds = true;
});

function makeReq(path: string, init?: { method?: string; search?: string; body?: string }): NextRequest {
  const url = `http://localhost/api/listmonk/${path}${init?.search ?? ''}`;
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    body: init?.body,
  });
}

const ctx = (path: string[]) => ({ params: { path } });

it('LMK-INT-PROXY-AUTH : sans session admin -> 401 et AUCUN appel upstream', async () => {
  authed = false;
  // Aucun handler upstream : si un fetch partait, onUnhandledRequest:'error'
  // ferait échouer le test → preuve que rien n'est proxyfié sans auth.
  const res = await GET(makeReq('api/lists'), ctx(['api', 'lists']));
  expect(res.status).toBe(401);
});

it('LMK-INT-PROXY-NOCREDS : créds Listmonk absents -> 503', async () => {
  hasCreds = false;
  const res = await GET(makeReq('api/lists'), ctx(['api', 'lists']));
  expect(res.status).toBe(503);
});

it('LMK-INT-PROXY-INJECT : Basic auth injecté côté serveur, jamais exposé au navigateur', async () => {
  let seenAuth = '';
  let seenPath = '';
  server.use(
    http.get(`${BASE}/api/lists`, ({ request }) => {
      seenAuth = request.headers.get('authorization') ?? '';
      seenPath = new URL(request.url).pathname;
      return HttpResponse.json({ data: [] });
    }),
  );
  const res = await GET(makeReq('api/lists'), ctx(['api', 'lists']));
  expect(res.status).toBe(200);
  // L'upstream a reçu le Basic auth construit côté serveur.
  expect(seenAuth).toBe(`Basic ${Buffer.from('apiuser:tok').toString('base64')}`);
  expect(seenPath).toBe('/api/lists');
  // La réponse renvoyée au navigateur ne ré-expose PAS l'Authorization.
  expect(res.headers.get('authorization'), 'créds jamais renvoyés au browser').toBeNull();
});

it('LMK-INT-PROXY-INJECT : la query string est transmise à l’upstream', async () => {
  let seenQuery = '';
  server.use(
    http.get(`${BASE}/api/subscribers`, ({ request }) => {
      seenQuery = new URL(request.url).search;
      return HttpResponse.json({ data: { results: [] } });
    }),
  );
  await GET(
    makeReq('api/subscribers', { search: '?per_page=50&page=2' }),
    ctx(['api', 'subscribers']),
  );
  expect(seenQuery).toContain('per_page=50');
  expect(seenQuery).toContain('page=2');
});

it('LMK-INT-PROXY-STRIP : X-Frame-Options et CSP de Listmonk sont strippés, les utiles passent', async () => {
  server.use(
    http.get(`${BASE}/admin`, () =>
      new HttpResponse('<html>listmonk</html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'x-frame-options': 'DENY',
          'content-security-policy': "frame-ancestors 'none'",
          'x-listmonk-version': '3.0.0',
        },
      }),
    ),
  );
  const res = await GET(makeReq('admin'), ctx(['admin']));
  expect(res.status).toBe(200);
  // Framing blockers strippés → l'iframe parent n'est pas bloquée.
  expect(res.headers.get('x-frame-options')).toBeNull();
  expect(res.headers.get('content-security-policy')).toBeNull();
  // Un en-tête non-framing utile reste transmis.
  expect(res.headers.get('x-listmonk-version')).toBe('3.0.0');
  expect(res.headers.get('content-type')).toContain('text/html');
});

it('LMK-INT-PROXY : forward le corps sur POST', async () => {
  let seenBody = '';
  server.use(
    http.post(`${BASE}/api/lists`, async ({ request }) => {
      seenBody = await request.text();
      return HttpResponse.json({ data: { id: 1 } });
    }),
  );
  const res = await POST(
    makeReq('api/lists', { method: 'POST', body: JSON.stringify({ name: 'L' }) }),
    ctx(['api', 'lists']),
  );
  expect(res.status).toBe(200);
  expect(seenBody).toContain('"name":"L"');
});

it('LMK-INT-PROXY : upstream injoignable -> 502 (cron/UI ne crashe pas)', async () => {
  server.use(http.get(`${BASE}/api/lists`, () => HttpResponse.error()));
  const res = await GET(makeReq('api/lists'), ctx(['api', 'lists']));
  expect(res.status).toBe(502);
});
