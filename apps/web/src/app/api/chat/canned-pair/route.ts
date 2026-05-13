/**
 * CHA-300 — Route POST /api/chat/canned-pair.
 *
 * Le widget appelle ce endpoint quand la visiteuse clique sur une
 * SuggestionPill page-aware. Le serveur sert la `scripted_reply_*` localisée
 * et persiste les deux messages (user + assistant) directement en DB —
 * pas de SSE car la réponse est instantanée.
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import {
  chatCannedPairTriggerInput,
  type ChatCannedPairTriggerResponse,
} from '@/lib/chat/contracts';
import {
  cannedPairService,
  CannedPairError,
} from '@/lib/chat/services/canned-pair-service';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const parsed = chatCannedPairTriggerInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await cannedPairService.trigger(parsed.data);
    const response: ChatCannedPairTriggerResponse = {
      ok: true,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      ctaLabel: result.ctaLabel,
      ctaUrl: result.ctaUrl,
      allowFollowupLlm: result.allowFollowupLlm,
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof CannedPairError) {
      const status =
        err.code === 'session-not-found' || err.code === 'pair-not-found'
          ? 404
          : 409;
      return NextResponse.json({ error: err.code }, { status });
    }
    logger.error('chat.canned-pair.failed', {
      sessionId: parsed.data.sessionId,
      key: parsed.data.key,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
