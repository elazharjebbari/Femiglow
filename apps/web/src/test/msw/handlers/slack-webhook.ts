/**
 * MSW handlers + spy pour les webhooks Slack.
 *
 * Permet à un test de :
 *  - vérifier qu'un Slack notify a été déclenché
 *  - inspecter le payload
 *  - simuler un échec Slack
 */
import { http, HttpResponse } from 'msw';

interface SlackCallRecord {
  url: string;
  body: unknown;
  timestamp: number;
}

let slackCalls: SlackCallRecord[] = [];
let nextResponseStatus = 200;

export const slackHandlers = [
  // Hook officiel Slack
  http.post(/.*hooks\.slack\.com.*/, async ({ request }) => {
    const body = await request.json().catch(() => null);
    slackCalls.push({
      url: request.url,
      body,
      timestamp: Date.now(),
    });
    if (nextResponseStatus !== 200) {
      return new HttpResponse('error', { status: nextResponseStatus });
    }
    return new HttpResponse('ok', { status: 200 });
  }),

  // Sink local pour tests internes
  http.post('http://localhost:3001/test/slack-sink', async ({ request }) => {
    const body = await request.json().catch(() => null);
    slackCalls.push({
      url: request.url,
      body,
      timestamp: Date.now(),
    });
    return HttpResponse.json({ ok: true });
  }),
];

/** Récupère toutes les calls Slack interceptées. */
export function getSlackCalls(): readonly SlackCallRecord[] {
  return [...slackCalls];
}

/** Reset entre tests (à appeler dans `beforeEach`). */
export function resetSlackCalls(): void {
  slackCalls = [];
  nextResponseStatus = 200;
}

/** Simule un échec Slack pour le prochain call. */
export function makeNextSlackCallFail(status = 500): void {
  nextResponseStatus = status;
}
