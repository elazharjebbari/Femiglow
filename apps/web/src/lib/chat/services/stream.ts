/**
 * CHA-040 — Helper Server-Sent Events.
 *
 * Encode des évènements `event: <name>\ndata: <json>\n\n` au format
 * standard SSE. Ferme automatiquement la connexion après le factory,
 * ou propage les erreurs (qui sont écrites comme un évènement `error`).
 *
 * cf. docs/chat-assistant/03-backend.md §3.4
 */
import { logger } from '@/lib/logging/logger';

import type { ChatStreamEvent } from '../contracts';

export type SseWriter = (e: ChatStreamEvent | { event: string; data: unknown }) => void;

export function streamSSE(
  factory: (write: SseWriter) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write: SseWriter = (e) => {
        try {
          const payload = `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          logger.error('chat.sse.write_failed', { error: (err as Error).message });
        }
      };
      try {
        await factory(write);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        const code =
          (err as { code?: string }).code ?? 'unknown';
        write({ event: 'error', data: { code, message } });
        logger.error('chat.sse.factory_failed', { code, message });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
