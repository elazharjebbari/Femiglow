/**
 * Serveur MSW pour les tests d'intégration vitest.
 *
 * Le lifecycle (`listen`, `resetHandlers`, `close`) est géré globalement
 * par `src/test/setup/msw.setup.ts`. Les tests n'ont qu'à importer ce
 * `server` et appeler `server.use(...)` pour overrider.
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
