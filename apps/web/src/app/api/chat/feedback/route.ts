/**
 * CHA-045 — Route POST /api/chat/feedback.
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { chatFeedbackInput } from '@/lib/chat/contracts';
import { messageRepo } from '@/lib/chat/repos/message';
import { eventRepo } from '@/lib/chat/repos/event';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatFeedback } from '@/lib/chat/db/schema';
import { createId } from '@/lib/ids';

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
  const parsed = chatFeedbackInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-input', issues: parsed.error.issues }, {
      status: 400,
    });
  }
  const message = await messageRepo.getById(parsed.data.messageId);
  if (!message) {
    return NextResponse.json({ error: 'message-not-found' }, { status: 404 });
  }
  const db = requireChatDb();
  await db
    .insert(chatFeedback)
    .values({
      id: createId('cf'),
      messageId: parsed.data.messageId,
      sessionId: message.sessionId,
      value: parsed.data.value,
      note: parsed.data.note ?? null,
    })
    .onConflictDoNothing();
  await eventRepo.append(
    message.sessionId,
    parsed.data.value > 0 ? 'feedback_positive' : 'feedback_negative',
    { messageId: parsed.data.messageId },
  );
  return NextResponse.json({ ok: true });
}
