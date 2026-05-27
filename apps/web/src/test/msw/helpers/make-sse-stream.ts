/**
 * Helper pour construire un stream SSE au format `/api/chat/*` interne.
 *
 * Référence : `docs/chat-test-strategy-2026-05/02-functional-areas/F08-sse-streaming/`
 * Schéma : `ChatStreamEvent` dans `apps/web/src/lib/chat/contracts.ts`
 *
 * Format : `event: <name>\ndata: <json>\n\n`
 *
 * @example
 * ```ts
 * const stream = makeChatSseStream([
 *   { event: 'start',  data: { messageId: 'm1', latency: 100 } },
 *   { event: 'chunk',  data: { text: 'Bonjour' } },
 *   { event: 'chunk',  data: { text: ' visiteur' } },
 *   { event: 'end',    data: { messageId: 'm1', usage: { tokensIn: 5, tokensOut: 3 } } },
 * ]);
 * return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
 * ```
 */
export interface ChatSseEvent {
  event: 'start' | 'chunk' | 'source' | 'end' | 'error' | 'lead-form-offer';
  data: unknown;
}

export function makeChatSseStream(events: ChatSseEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(
          encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
        );
      }
      controller.close();
    },
  });
}

/**
 * Variante "slow stream" qui ajoute un délai entre les events.
 * Utile pour tester heartbeat, abort, et latency budgets.
 */
export function makeChatSseStreamSlow(
  events: ChatSseEvent[],
  delayMs: number = 50,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(
          encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
        );
      }
      controller.close();
    },
  });
}

/**
 * Stream qui fail en plein milieu — pour tester error recovery.
 */
export function makeChatSseStreamFailing(
  successEvents: ChatSseEvent[],
  errorAfter: number,
  errorMessage: string = 'Provider failed',
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let i = 0; i < successEvents.length; i++) {
        if (i >= errorAfter) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ code: 'provider_failed', message: errorMessage })}\n\n`,
            ),
          );
          break;
        }
        const e = successEvents[i];
        if (!e) continue; // noUncheckedIndexedAccess — i < length déjà garanti par la boucle
        controller.enqueue(
          encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
        );
      }
      controller.close();
    },
  });
}
