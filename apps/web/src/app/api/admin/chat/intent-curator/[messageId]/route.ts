/**
 * CHA-230 Phase 3 — Tag manuel d'un message comme golden-set.
 *
 *   POST /api/admin/chat/intent-curator/[messageId]
 *
 * Body JSON : { expectedIntent: string, notes?: string }
 *
 * Crée une ligne `chat_golden_intent_set` à partir du `chat_message`
 * référencé. Idempotent : si le message a déjà été tagué, on renvoie
 * 409 (l'admin doit DELETE puis re-POST pour modifier).
 *
 *   DELETE /api/admin/chat/intent-curator/[messageId]
 *
 * Supprime l'entrée golden associée à ce message (s'il y en a une).
 */
import { NextResponse } from 'next/server';

import { adminGoldenIntentInput } from '@/lib/chat/contracts';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { goldenIntentRepo } from '@/lib/chat/repos/golden-intent';
import { messageRepo } from '@/lib/chat/repos/message';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { messageId: string };
}

export async function POST(req: Request, ctx: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { messageId } = ctx.params;

  const message = await messageRepo.getById(messageId);
  if (!message) {
    return NextResponse.json({ error: 'message-not-found' }, { status: 404 });
  }
  if (message.role !== 'user') {
    return NextResponse.json(
      { error: 'message-not-user', message: 'Only user messages can be tagged' },
      { status: 400 },
    );
  }
  if (!message.contentSafe && !message.content) {
    return NextResponse.json(
      { error: 'message-empty', message: 'Cannot tag an empty message' },
      { status: 400 },
    );
  }

  const lang = message.language ?? 'fr';
  if (lang !== 'fr' && lang !== 'ar' && lang !== 'ar-MA') {
    return NextResponse.json(
      { error: 'message-language-unsupported', language: lang },
      { status: 400 },
    );
  }

  // Idempotence : on refuse un double-tag plutôt que de silently overwrite,
  // pour donner à l'admin un signal clair que l'entrée existe déjà.
  if (await goldenIntentRepo.existsForMessage(messageId)) {
    return NextResponse.json(
      { error: 'already-tagged', message: 'This message is already in the golden-set' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = adminGoldenIntentInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await goldenIntentRepo.add({
    text: message.contentSafe ?? message.content,
    language: lang,
    expectedIntent: parsed.data.expectedIntent,
    curatorEmail: auth.email,
    sourceMessageId: messageId,
    sourceSessionId: message.sessionId,
    notes: parsed.data.notes ?? null,
  });

  logger.info('chat.admin.golden_tagged', {
    goldenId: created.id,
    messageId,
    expectedIntent: parsed.data.expectedIntent,
    by: auth.email,
  });

  return NextResponse.json({ id: created.id, ok: true }, { status: 201 });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { messageId } = ctx.params;

  // On retrouve l'entrée golden via son `source_message_id` (la
  // route DELETE est exposée par messageId, pas par goldenId, pour
  // que le curator UI n'ait pas besoin de ré-fetch après un POST).
  const existing = await goldenIntentRepo.list({ limit: 500 });
  const target = existing.find((r) => r.sourceMessageId === messageId);
  if (!target) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  await goldenIntentRepo.delete(target.id);
  logger.info('chat.admin.golden_deleted', {
    goldenId: target.id,
    messageId,
    by: auth.email,
  });
  return NextResponse.json({ ok: true });
}
