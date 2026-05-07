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

export { http, HttpResponse };
