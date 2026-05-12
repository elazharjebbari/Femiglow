/**
 * GET /api/admin/seeders/jobs/[jobId]/stream
 * → flux SSE (`text/event-stream`) consommé par l'UI Seeders Runner.
 *
 * Replay : on envoie d'abord tous les events bufferisés (replay) avant de
 * brancher l'écoute live, afin qu'un client qui rejoint à mi-job voie
 * l'historique complet.
 *
 * Keep-alive : un commentaire SSE est envoyé toutes les 15s pour éviter
 * que les proxies (nginx, vercel) coupent la connexion. Si le job est
 * terminé (completed/failed/cancelled), on envoie un event `done` puis on
 * ferme proprement.
 */
import { getAdminSession } from '@/lib/auth/require-admin';
import { getJobStore } from '@/lib/seeders/job-store';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEEPALIVE_INTERVAL_MS = 15_000;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const store = getJobStore();
  const job = store.get(params.jobId);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let abortListener: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function safeEnqueue(chunk: string): void {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller may already be closed (client disconnect).
          closed = true;
        }
      }

      function cleanup(): void {
        if (closed) return;
        closed = true;
        if (unsubscribe) unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        if (abortListener) request.signal.removeEventListener('abort', abortListener);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      // 1. Replay : envoyer tous les events déjà bufferisés.
      const snap = store.snapshot(params.jobId);
      if (!snap) {
        safeEnqueue(`event: error\ndata: ${JSON.stringify({ message: 'Job disappeared' })}\n\n`);
        cleanup();
        return;
      }
      safeEnqueue(
        `event: status\ndata: ${JSON.stringify({ status: snap.status })}\n\n`,
      );
      for (const ev of snap.events) {
        safeEnqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      }

      // Si le job est déjà terminé, fermer après le replay.
      if (
        snap.status === 'completed' ||
        snap.status === 'failed' ||
        snap.status === 'cancelled'
      ) {
        safeEnqueue(`event: done\ndata: ${JSON.stringify({ status: snap.status })}\n\n`);
        cleanup();
        return;
      }

      // 2. Live subscribe.
      unsubscribe = store.subscribe(params.jobId, (ev) => {
        safeEnqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
        if (
          ev.type === 'job.complete' ||
          ev.type === 'job.cancelled'
        ) {
          safeEnqueue(`event: done\ndata: ${JSON.stringify({ type: ev.type })}\n\n`);
          cleanup();
        }
      });

      // 3. Keepalive (commentaire SSE).
      keepAlive = setInterval(() => {
        safeEnqueue(`: keep-alive ${Date.now()}\n\n`);
      }, KEEPALIVE_INTERVAL_MS);

      // 4. Cleanup à la déconnexion du client.
      abortListener = () => cleanup();
      request.signal.addEventListener('abort', abortListener);
    },
    cancel() {
      closed = true;
      if (unsubscribe) unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  logger.info('admin.seeders.stream.open', { jobId: params.jobId });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
