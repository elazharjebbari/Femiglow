/**
 * MSW handlers + spy pour les webhooks outbound de capture lead.
 *
 * Le système envoie un POST sur l'URL configurée (`LEAD_WEBHOOK_URL`).
 * Pour les tests, on intercepte tous les POSTs sur des URLs sinks
 * locales pour vérifier le contrat de payload.
 */
import { http, HttpResponse } from 'msw';

interface LeadWebhookCall {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

let webhookCalls: LeadWebhookCall[] = [];
let nextResponseStatus = 200;

export const leadWebhookHandlers = [
  http.post('http://localhost:3001/test/lead-webhook-sink', async ({ request }) => {
    const body = await request.json().catch(() => null);
    webhookCalls.push({
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });
    if (nextResponseStatus !== 200) {
      return new HttpResponse(null, { status: nextResponseStatus });
    }
    return HttpResponse.json({ ok: true });
  }),

  // Catch-all pour URLs de prod overridées en env test
  http.post('https://example.com/webhook', async ({ request }) => {
    const body = await request.json().catch(() => null);
    webhookCalls.push({
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });
    return HttpResponse.json({ ok: true });
  }),
];

export function getLeadWebhookCalls(): readonly LeadWebhookCall[] {
  return [...webhookCalls];
}

export function resetLeadWebhookCalls(): void {
  webhookCalls = [];
  nextResponseStatus = 200;
}

export function makeNextLeadWebhookFail(status = 500): void {
  nextResponseStatus = status;
}
