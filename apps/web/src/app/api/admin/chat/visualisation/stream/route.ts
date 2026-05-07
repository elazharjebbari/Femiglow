/**
 * CHA-135 — SSE `/api/admin/chat/visualisation/stream`.
 *
 * Émet en continu des « pulses » mappés sur les arêtes / nœuds du
 * `<PipelineGraph>` à partir des événements récents stockés dans
 * `chat_conversation_event`. Pas de pub/sub Redis : on poll la table en
 * cursor (occurredAt > lastSeen) toutes les 1.5 s, ce qui reste léger
 * pour un usage admin (1 connexion ~).
 *
 * Format SSE :
 *   data: {"edge":"visitor-sanitize","node":"sanitize","ts":"..."}\n\n
 *
 * Le client (`SystemDashboard`) parse et alimente la file de pulses du
 * graphe ; les `node` incrémentent les compteurs.
 */
import { and, asc, gt } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatConversationEvent, type ChatConversationEventRow } from '@/lib/chat/db/schema';
import { isChatEnabled } from '@/lib/chat/feature-flag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EventType = ChatConversationEventRow['type'];

interface Pulse {
  edge?: string;
  node?: string;
  type: EventType;
  ts: string;
  latencyMs?: number;
}

/**
 * Mapping événement → arête(s) + nœud(s) cible(s).
 *
 * Les IDs (edges + nodes) doivent rester synchronisés avec
 * `<PipelineGraph>` (`src/components/admin/chat/PipelineGraph.tsx`) ;
 * tout drift = pulses qui n'animent rien.
 *
 * MAJ CHA-230 — pipeline étendu :
 *
 *   visitor → sanitize → lang → intent → charter
 *                                          ↓
 *                                        rag → provider → stream → humanize → response → lead
 *
 * Mapping :
 *   - `message_sent_user` → propagation amont (sanitize → lang → intent →
 *     charter), 4 pulses successifs.
 *   - `message_sent_agent` → propagation aval (charter → rag → provider →
 *     stream → humanize → response), 5 pulses successifs.
 *   - `chat_lead_form_offered` / `chat_lead_form_submit` /
 *     `chat_lead_auto_created` / `lead_email_captured` → allument le nœud
 *     `lead` (post-décision lead-decision.ts).
 *   - `chat_provider_retry_or_fallback` (CHA-229) → ré-allume `provider`
 *     pour signaler visuellement un retry ou bascule de provider.
 *   - `feedback_*` / `conversion_attributed` → ciblent toujours `response`.
 */
function pulsesForEvent(row: ChatConversationEventRow): Pulse[] {
  const ts = row.occurredAt.toISOString();
  const payload = (row.payload ?? {}) as { latencyMs?: number };
  const latencyMs = typeof payload.latencyMs === 'number' ? payload.latencyMs : undefined;

  switch (row.type) {
    case 'session_open':
    case 'widget_open':
      return [{ type: row.type, node: 'visitor', ts }];
    case 'message_sent_user':
      return [
        { type: row.type, edge: 'visitor-sanitize', node: 'sanitize', ts },
        { type: row.type, edge: 'sanitize-lang', node: 'lang', ts },
        { type: row.type, edge: 'lang-intent', node: 'intent', ts },
        { type: row.type, edge: 'intent-charter', node: 'charter', ts },
      ];
    case 'message_sent_agent':
      return [
        { type: row.type, edge: 'charter-rag', node: 'rag', ts, latencyMs },
        { type: row.type, edge: 'rag-provider', node: 'provider', ts, latencyMs },
        { type: row.type, edge: 'provider-stream', node: 'stream', ts, latencyMs },
        { type: row.type, edge: 'stream-humanize', node: 'humanize', ts, latencyMs },
        { type: row.type, edge: 'humanize-response', node: 'response', ts, latencyMs },
      ];
    // CHA-229 — un retry ou un fallback s'est produit côté provider.
    // Re-allumer le nœud `provider` pour visualiser la résilience.
    case 'chat_provider_retry_or_fallback':
      return [{ type: row.type, node: 'provider', ts, latencyMs }];
    // CHA-208 / CHA-225 — décision et capture de lead post-réponse.
    case 'chat_lead_form_offered':
    case 'chat_lead_form_submit':
    case 'chat_lead_auto_created':
    case 'chat_lead_form_upgrade':
    case 'lead_email_captured':
      return [
        { type: row.type, edge: 'response-lead', node: 'lead', ts },
      ];
    case 'feedback_positive':
    case 'feedback_negative':
    case 'conversion_attributed':
      return [{ type: row.type, node: 'response', ts }];
    case 'rate_limit_hit':
    case 'error':
      return [{ type: row.type, edge: 'visitor-sanitize', node: 'sanitize', ts }];
    case 'language_switch':
      return [{ type: row.type, node: 'lang', ts }];
    case 'widget_close':
    case 'suggestion_clicked':
    case 'message_received_first_token':
    case 'message_complete':
    case 'chat_lead_form_view':
    case 'chat_lead_form_focus':
    case 'chat_lead_form_dismiss':
    case 'chat_lead_webhook_sent':
    case 'chat_lead_webhook_failed':
    default:
      return [];
  }
}

const POLL_MS = 1500;
const HEARTBEAT_MS = 15_000;
const PULSE_SPACING_MS = 120;

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!isChatEnabled()) {
    return new Response('chat-disabled', { status: 503 });
  }

  const db = requireChatDb();
  const encoder = new TextEncoder();

  // Cursor : on démarre depuis « maintenant - 5s » pour éviter de
  // rejouer un long historique au refresh, tout en attrapant ce qui
  // vient juste de se produire.
  let cursor = new Date(Date.now() - 5_000);
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // contrôleur fermé entre-temps
        }
      }

      // hello + heartbeat
      send({ type: 'hello', ts: new Date().toISOString() });
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // ignore
        }
      }, HEARTBEAT_MS);

      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      req.signal.addEventListener('abort', onAbort);

      // boucle de poll
      (async () => {
        while (!closed) {
          try {
            const rows = await db
              .select()
              .from(chatConversationEvent)
              .where(and(gt(chatConversationEvent.occurredAt, cursor)))
              .orderBy(asc(chatConversationEvent.occurredAt))
              .limit(50);

            for (const row of rows) {
              cursor = row.occurredAt;
              const pulses = pulsesForEvent(row);
              for (const p of pulses) {
                send(p);
                // petit espacement pour que les pulses successifs (ex.
                // sanitize→lang→charter) soient visibles à l'œil.
                await sleep(PULSE_SPACING_MS);
                if (closed) return;
              }
            }
          } catch (err) {
            send({
              type: 'error',
              message: (err as Error).message ?? 'unknown',
              ts: new Date().toISOString(),
            });
          }
          await sleep(POLL_MS);
        }
      })().catch(() => {
        // ignore
      });
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
