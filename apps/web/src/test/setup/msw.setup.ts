/**
 * MSW lifecycle pour vitest.
 *
 * Référence : `docs/chat-test-strategy-2026-05/01-architecture-test/02-msw-handlers-catalog.md`
 *
 * - `onUnhandledRequest: 'error'` → fail le test si une requête réelle leak
 *   au lieu d'être interceptée (anti-flakiness).
 * - `resetHandlers` entre les tests → pas de pollution entre fichiers.
 */
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/test/msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
