/**
 * GET /api/admin/analytics/live/stream
 * Endpoint SSE (Server-Sent Events) primaire pour l'onglet Live.
 * cf. docs/analytics/05-onglets-specs.md §2.2
 *
 * Tick toutes les 5 s, push un `LiveSnapshot` JSON. Le serveur écoute le
 * signal d'abort de la requête (fermeture côté client OU timeout Vercel) et
 * cleanup proprement (clearInterval). Headers : `Cache-Control: no-store` +
 * `X-Accel-Buffering: no` pour empêcher les proxies de buffer.
 *
 * Si la variable d'env `ANALYTICS_LIVE_DISABLED=true` est positionnée, l'API
 * répond 503 → le client bascule en polling (fail-open).
 */
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { LIVE_WINDOWS, readLiveSnapshot } from '@/lib/analytics/queries/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  window: z.enum(LIVE_WINDOWS).default('1h'),
});

const TICK_MS = 5_000;
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request): Promise<Response> {
  if (process.env.ANALYTICS_LIVE_DISABLED === 'true') {
    return new Response(JSON.stringify({ error: 'live_disabled' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await getAdminSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    window: url.searchParams.get('window') ?? undefined,
  });
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const window = parsed.data.window;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const safeEnqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Le contrôleur peut être fermé entre deux ticks (race) — on noie.
        }
      };

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // controller déjà fermé, ignore
        }
      };

      // Hello + premier snapshot immédiat (le client n'attend pas 5 s)
      try {
        const initial = await readLiveSnapshot({ window });
        safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);
      } catch (err) {
        safeEnqueue(
          `event: error\ndata: ${JSON.stringify({ message: 'snapshot_failed' })}\n\n`,
        );
        // On ne ferme pas : le tick suivant peut succeed.
      }

      interval = setInterval(async () => {
        if (closed) return;
        try {
          const snap = await readLiveSnapshot({ window });
          safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
        } catch {
          safeEnqueue(
            `event: error\ndata: ${JSON.stringify({ message: 'snapshot_failed' })}\n\n`,
          );
        }
      }, TICK_MS);

      // Heartbeat pour empêcher les proxies de couper la connexion idle.
      heartbeat = setInterval(() => {
        if (closed) return;
        safeEnqueue(`: heartbeat\n\n`);
      }, HEARTBEAT_MS);

      // Abort handling — le client a fermé, ou Vercel timeout
      request.signal.addEventListener('abort', cleanup, { once: true });
    },
    cancel() {
      // Le consumer a annulé le stream — pas d'action additionnelle, le
      // listener `abort` ci-dessus a déjà nettoyé.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
