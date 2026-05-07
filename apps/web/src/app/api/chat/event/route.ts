/**
 * CHA-047 — Route POST /api/chat/event (analytics widget).
 */
import { NextResponse, type NextRequest } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { chatEventInput } from '@/lib/chat/contracts';
import { eventRepo } from '@/lib/chat/repos/event';

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
  const parsed = chatEventInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-input', issues: parsed.error.issues }, {
      status: 400,
    });
  }
  await eventRepo.append(parsed.data.sessionId, parsed.data.type, parsed.data.payload);
  return NextResponse.json({ ok: true });
}
