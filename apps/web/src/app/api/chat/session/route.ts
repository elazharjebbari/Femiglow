/**
 * CHA-042 / CHA-043 — Routes session.
 *
 * - GET  /api/chat/session         → snapshot (création paresseuse)
 * - POST /api/chat/session/refresh → mise à jour `page` / `language`
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import {
  chatLanguageSchema,
  chatSessionRefreshInput,
  type ChatSessionSnapshot,
} from '@/lib/chat/contracts';
import { sessionService } from '@/lib/chat/services/session-service';
import { sessionRepo } from '@/lib/chat/repos/session';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new Response('Not Found', { status: 404 });
    }
    throw err;
  }
  try {
    const url = new URL(req.url);
    const page = url.searchParams.get('page') ?? undefined;
    // Phase 9bis — la locale de la page (`?lang=ar`) pilote la langue de la
    // session : greeting, pills (questions prédéfinies) et réponses scriptées
    // sont servis dans cette langue. Validation stricte via le schéma Zod ;
    // toute valeur invalide est ignorée (repli FR côté getOrCreate).
    const langParsed = chatLanguageSchema.safeParse(url.searchParams.get('lang'));
    const language = langParsed.success ? langParsed.data : undefined;
    const session = await sessionService.getOrCreate({ page, language });
    const snapshot = await sessionService.snapshot(session.id);
    if (!snapshot) {
      return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
    }
    return NextResponse.json<ChatSessionSnapshot>(snapshot);
  } catch (err) {
    logger.error('chat.session.get_failed', { error: (err as Error).message });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

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
  const parsed = chatSessionRefreshInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-input', issues: parsed.error.issues }, {
      status: 400,
    });
  }
  const updates: {
    page?: string | null;
    language?: string;
    consent?: { essential: true; analytics: boolean; marketing: boolean } | null;
  } = {};
  if (parsed.data.page !== undefined) updates.page = parsed.data.page;
  if (parsed.data.language !== undefined) updates.language = parsed.data.language;
  if (parsed.data.consent !== undefined) updates.consent = parsed.data.consent;
  const updated = await sessionRepo.update(parsed.data.sessionId, updates);
  if (!updated) {
    return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
