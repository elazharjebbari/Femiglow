/**
 * CHA-231 (gap 1) — Route GET /api/chat/lead-status?sessionId=xxx.
 *
 * Filet de sécurité côté client : si le SSE drop avant que l'event
 * `lead-form-offer` ne soit reçu (réseau coupé, browser tabswitch
 * pendant le streaming, throttle Cloudflare…), l'utilisateur ne voit
 * jamais le formulaire alors que le serveur l'a bien décidé. Le client
 * pull cet endpoint après chaque message envoyé pour réconcilier l'état.
 *
 * Réponse :
 *   - `hasPendingOffer: false` si aucune offre, ou si déjà capturé.
 *   - `lastOffer: {...}` avec messageId / reason / copyKey / force /
 *     offeredAt si une offre a été émise. Le client compare avec
 *     `messageId` qu'il a déjà vu pour décider de re-déclencher.
 *   - `leadCaptured: true` si un lead a été soumis (terminal).
 *
 * Pas d'auth : la session est stateless (cookies httpOnly), le sessionId
 * est suffisant car non-devinable et signé par notre cookie.
 *
 * cf. CHA-231 plan d'action §1.5 (gap 1 SSE drop recovery).
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { eventRepo } from '@/lib/chat/repos/event';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LastOffer {
  messageId: string;
  reason: string;
  copyKey: string;
  force: boolean;
  offeredAt: string;
}

interface LeadStatusResponse {
  ok: true;
  hasPendingOffer: boolean;
  leadCaptured: boolean;
  lastOffer?: LastOffer;
}

/** Type guard light pour les payloads d'event. */
function isOfferPayload(p: unknown): p is {
  messageId: string;
  reason: string;
  copyKey: string;
  force?: boolean;
} {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Record<string, unknown>).messageId === 'string' &&
    typeof (p as Record<string, unknown>).reason === 'string' &&
    typeof (p as Record<string, unknown>).copyKey === 'string'
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new Response('Not Found', { status: 404 });
    }
    throw err;
  }
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId || sessionId.length > 64) {
    return NextResponse.json({ error: 'invalid-sessionId' }, { status: 400 });
  }
  try {
    const events = await eventRepo.listBySession(sessionId);
    // Recherche du dernier `chat_lead_form_offered` et du premier
    // `chat_lead_form_submit` (= capture). Si capture posé, on
    // considère qu'aucune offre n'est plus à montrer.
    let lastOffer: LastOffer | null = null;
    let captured = false;
    for (const ev of events) {
      if (ev.type === 'chat_lead_form_offered' && isOfferPayload(ev.payload)) {
        lastOffer = {
          messageId: ev.payload.messageId,
          reason: ev.payload.reason,
          copyKey: ev.payload.copyKey,
          force: ev.payload.force ?? false,
          offeredAt:
            ev.occurredAt instanceof Date
              ? ev.occurredAt.toISOString()
              : String(ev.occurredAt),
        };
      } else if (ev.type === 'chat_lead_form_submit') {
        captured = true;
      } else if (ev.type === 'chat_lead_auto_created') {
        // CHA-225 — Capture auto via détection inline phone : terminal.
        captured = true;
      }
    }
    const response: LeadStatusResponse = {
      ok: true,
      hasPendingOffer: lastOffer != null && !captured,
      leadCaptured: captured,
      ...(lastOffer ? { lastOffer } : {}),
    };
    return NextResponse.json(response);
  } catch (err) {
    logger.error('chat.lead_status.get_failed', {
      sessionId,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
