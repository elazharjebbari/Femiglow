/**
 * CHA-044 — Route POST /api/chat/message (Server-Sent Events).
 *
 * Reçoit un payload `chatMessageInput`, sélectionne la session,
 * lance l'orchestrator et stream les évènements SSE jusqu'à `end`.
 */
import { type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { chatMessageInput } from '@/lib/chat/contracts';
import { streamReply } from '@/lib/chat/services/orchestrator';
import { streamSSE } from '@/lib/chat/services/stream';
import { rateLimit } from '@/lib/chat/services/rate-limit';
import { sessionRepo } from '@/lib/chat/repos/session';
import { eventRepo } from '@/lib/chat/repos/event';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * `maxDuration` 30s pour le SSE chat — suffisant pour streaming complet
 * (LLM + RAG + tools) sans coupure Vercel.
 *
 * Référence : docs/live-systems-fix-2026-05/03-plan-action-phases.md § QW3.
 * Vercel default Hobby=10s, Pro=60s. On fixe à 30 explicitement pour
 * éviter qu'une bascule plan ne change le comportement silencieusement.
 */
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new Response('Not Found', { status: 404 });
    }
    throw err;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const parsed = chatMessageInput.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'invalid-input', issues: parsed.error.issues }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
  const session = await sessionRepo.getById(parsed.data.sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'session-not-found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Rate-limit (session + IP). On consomme dans l'ordre le plus
  // restrictif d'abord (session) afin que le visiteur frustré soit
  // ralenti avant de pénaliser l'IP partagée (NAT, café…).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  try {
    const sessionGate = await rateLimit.consume('session', session.id);
    if (!sessionGate.allowed) {
      await eventRepo.append(session.id, 'rate_limit_hit', { scope: 'session' });
      return new Response(JSON.stringify({ error: 'rate-limited', scope: 'session' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil((sessionGate.resetAt.getTime() - Date.now()) / 1000)),
        },
      });
    }
    const ipGate = await rateLimit.consume('ip', ip);
    if (!ipGate.allowed) {
      await eventRepo.append(session.id, 'rate_limit_hit', { scope: 'ip' });
      return new Response(JSON.stringify({ error: 'rate-limited', scope: 'ip' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil((ipGate.resetAt.getTime() - Date.now()) / 1000)),
        },
      });
    }
  } catch (err) {
    logger.warn('chat.message.rate_limit_skipped', { error: (err as Error).message });
  }

  const abort = new AbortController();
  // Si le client ferme la connexion, on annule le stream provider.
  req.signal.addEventListener('abort', () => abort.abort());

  return streamSSE(async (write) => {
    try {
      for await (const ev of streamReply({
        session,
        text: parsed.data.text,
        signal: abort.signal,
      })) {
        write(ev);
      }
    } catch (err) {
      logger.error('chat.message.stream_failed', {
        sessionId: session.id,
        error: (err as Error).message,
      });
      write({ event: 'error', data: { code: 'stream-failed' } });
    }
  });
}
