/**
 * GET /api/admin/reset/jobs/[jobId]/stream
 * → text/event-stream
 *
 * Replay buffered events, puis live subscribe, puis cleanup à la fin du job
 * ou sur disconnect client.
 */
import { getAdminSession } from '@/lib/auth/require-admin';
import { getResetJobStore } from '@/lib/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEEPALIVE_INTERVAL_MS = 15_000;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const store = getResetJobStore();
  const job = store.get(params.jobId);
  if (!job) return new Response('Job not found', { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let abortListener: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enq = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); }
        catch { closed = true; }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (unsubscribe) unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        if (abortListener) request.signal.removeEventListener('abort', abortListener);
        try { controller.close(); } catch { /* already closed */ }
      };

      const snap = store.snapshot(params.jobId);
      if (!snap) {
        enq(`event: error\ndata: ${JSON.stringify({ message: 'Job disappeared' })}\n\n`);
        cleanup();
        return;
      }
      enq(`event: status\ndata: ${JSON.stringify({ status: snap.status })}\n\n`);
      for (const ev of snap.events) {
        enq(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      }
      if (snap.status === 'completed' || snap.status === 'failed' || snap.status === 'cancelled') {
        enq(`event: done\ndata: ${JSON.stringify({ status: snap.status })}\n\n`);
        cleanup();
        return;
      }
      unsubscribe = store.subscribe(params.jobId, (ev) => {
        enq(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
        if (ev.type === 'job.complete' || ev.type === 'job.cancelled' || ev.type === 'job.failed') {
          enq(`event: done\ndata: ${JSON.stringify({ status: ev.type })}\n\n`);
          cleanup();
        }
      });
      keepAlive = setInterval(() => {
        enq(`event: keepalive\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
      }, KEEPALIVE_INTERVAL_MS);
      abortListener = () => cleanup();
      request.signal.addEventListener('abort', abortListener);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
