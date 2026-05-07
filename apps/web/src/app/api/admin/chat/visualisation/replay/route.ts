/**
 * CHA-136 — Replay d'une conversation à travers le pipeline graphique.
 *
 * GET /api/admin/chat/visualisation/replay?sessionId=cs_xxx
 *
 * Lit tous les événements de la session, les rejoue chronologiquement
 * sous forme SSE (avec un espacement constant entre événements pour
 * que la visualisation reste lisible). Mode lecture-seule : ne modifie
 * rien et n'appelle aucun provider.
 */
import { asc, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatConversationEvent, type ChatConversationEventRow } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STEP_MS = 350;

type EventType = ChatConversationEventRow['type'];

interface Pulse {
  edge?: string;
  node?: string;
  type: EventType | 'replay-start' | 'replay-end';
  ts: string;
  index?: number;
  total?: number;
}

// CHA-230 — synchronisé avec stream/route.ts ET PipelineGraph.tsx.
// Tout drift = pulses replay qui ne propagent plus les bons edges.
const EDGE_BY_TYPE: Partial<Record<EventType, Array<{ edge?: string; node?: string }>>> = {
  session_open: [{ node: 'visitor' }],
  widget_open: [{ node: 'visitor' }],
  message_sent_user: [
    { edge: 'visitor-sanitize', node: 'sanitize' },
    { edge: 'sanitize-lang', node: 'lang' },
    { edge: 'lang-intent', node: 'intent' },
    { edge: 'intent-charter', node: 'charter' },
  ],
  message_sent_agent: [
    { edge: 'charter-rag', node: 'rag' },
    { edge: 'rag-provider', node: 'provider' },
    { edge: 'provider-stream', node: 'stream' },
    { edge: 'stream-humanize', node: 'humanize' },
    { edge: 'humanize-response', node: 'response' },
  ],
  chat_provider_retry_or_fallback: [{ node: 'provider' }],
  chat_lead_form_offered: [{ edge: 'response-lead', node: 'lead' }],
  chat_lead_form_submit: [{ edge: 'response-lead', node: 'lead' }],
  chat_lead_auto_created: [{ edge: 'response-lead', node: 'lead' }],
  chat_lead_form_upgrade: [{ edge: 'response-lead', node: 'lead' }],
  lead_email_captured: [{ edge: 'response-lead', node: 'lead' }],
  feedback_positive: [{ node: 'response' }],
  feedback_negative: [{ node: 'response' }],
  conversion_attributed: [{ node: 'response' }],
  language_switch: [{ node: 'lang' }],
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return new Response('missing sessionId', { status: 400 });
  }

  const db = requireChatDb();
  const events = await db
    .select()
    .from(chatConversationEvent)
    .where(eq(chatConversationEvent.sessionId, sessionId))
    .orderBy(asc(chatConversationEvent.occurredAt));

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(p: Pulse) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
        } catch {
          /* ignore */
        }
      }

      const onAbort = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      req.signal.addEventListener('abort', onAbort);

      send({
        type: 'replay-start',
        ts: new Date().toISOString(),
        total: events.length,
      });

      for (let i = 0; i < events.length; i++) {
        if (closed) break;
        const ev = events[i]!;
        const ts = ev.occurredAt.toISOString();
        const steps = EDGE_BY_TYPE[ev.type] ?? [];
        for (const step of steps) {
          if (closed) break;
          send({ type: ev.type, ts, index: i, ...step });
          await sleep(STEP_MS);
        }
      }

      send({ type: 'replay-end', ts: new Date().toISOString(), total: events.length });
      try {
        controller.close();
      } catch {
        /* ignore */
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
