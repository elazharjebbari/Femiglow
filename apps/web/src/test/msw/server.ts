/**
 * Serveur MSW pour les tests d'intégration vitest.
 *
 * Le lifecycle (`listen`, `resetHandlers`, `close`) est géré **par fichier
 * de test** — chaque suite choisit sa propre politique `onUnhandledRequest`
 * (`'error'` / `'bypass'` / `'warn'`), incompatible avec un `listen` global
 * unique (cf. `src/test/setup/msw.setup.ts`, no-op volontaire) :
 * ```ts
 * import { server, http, HttpResponse } from '@/test/msw/server';
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * Pour usage par défaut chat, importer les handlers depuis
 * `@/test/msw/handlers/chat-internal` et les enregistrer dans le
 * `beforeEach` de ta suite component.
 *
 * Les scénarios par endpoint sont décrits dans
 * `docs/chat-test-strategy-2026-05/01-architecture-test/02-msw-handlers-catalog.md`.
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

// Re-exports de handlers chat — opt-in (ne sont PAS register par défaut
// pour ne pas casser les suites existantes qui utilisent leur propre stack).
export { chatInternalHandlers } from './handlers/chat-internal';
export {
  slackHandlers,
  getSlackCalls,
  resetSlackCalls,
  makeNextSlackCallFail,
} from './handlers/slack-webhook';
export {
  leadWebhookHandlers,
  getLeadWebhookCalls,
  resetLeadWebhookCalls,
  makeNextLeadWebhookFail,
} from './handlers/lead-webhook';
export {
  makeChatSseStream,
  makeChatSseStreamSlow,
  makeChatSseStreamFailing,
  type ChatSseEvent,
} from './helpers/make-sse-stream';
