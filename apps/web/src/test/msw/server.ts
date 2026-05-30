/**
 * Serveur MSW pour les tests d'intégration vitest.
 *
 * Usage :
 * ```ts
 * import { server, http, HttpResponse } from '@/test/msw/server';
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * Les scénarios par endpoint sont décrits dans
 * `docs/admin/specifications/08-tests/integration-msw/`.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const server = setupServer();

// ARC-004 — `listen`/`close` rendus IDEMPOTENTS. MSW v2 lève une InvariantError
// si `server.listen()` est appelé alors que le serveur écoute déjà (double-
// listen). En enrobant listen/close, un montage GLOBAL du serveur (vitest.setup)
// peut coexister avec les ~35 fichiers qui montent déjà le serveur dans leur
// propre `beforeAll`, sans throw et SANS toucher ces fichiers : le premier
// `listen` gagne (sa config onUnhandledRequest), les suivants sont des no-op.
// Comportement inchangé quand un seul `listen`/`close` est émis (cas actuel).
{
  const rawListen = server.listen.bind(server);
  const rawClose = server.close.bind(server);
  let started = false;
  server.listen = ((options?: Parameters<typeof rawListen>[0]) => {
    if (!started) {
      started = true;
      rawListen(options);
    }
  }) as typeof server.listen;
  server.close = (() => {
    if (started) {
      started = false;
      rawClose();
    }
  }) as typeof server.close;
}

export { http, HttpResponse };
