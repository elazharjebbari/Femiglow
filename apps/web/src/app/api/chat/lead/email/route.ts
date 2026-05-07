/**
 * CHA-046 — Route POST /api/chat/lead/email.
 *
 * Capture optionnelle d'un email pour reprise de conversation. Le
 * visiteur a explicitement coché `consent` (RGPD). On stocke
 * l'attribution dans `chat_session.utm.leadEmail` (chiffré côté DB
 * applicatif n'est pas fait ici — l'email reste lisible pour l'admin
 * via la console). Trace KPI `lead_email_captured`.
 */
import { type NextRequest, NextResponse } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { chatLeadEmailInput } from '@/lib/chat/contracts';
import { eventRepo } from '@/lib/chat/repos/event';
import { sessionRepo } from '@/lib/chat/repos/session';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new NextResponse('Not Found', { status: 404 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const parsed = chatLeadEmailInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (!parsed.data.consent) {
    return NextResponse.json({ error: 'consent-required' }, { status: 400 });
  }

  const session = await sessionRepo.getById(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
  }

  const utm = { ...(session.utm ?? {}), leadEmail: parsed.data.email };
  await sessionRepo.update(session.id, { utm });
  await eventRepo.append(session.id, 'lead_email_captured', {
    email: parsed.data.email,
  });
  logger.info('chat.lead.captured', { sessionId: session.id });

  return NextResponse.json({ ok: true });
}
