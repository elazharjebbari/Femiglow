/**
 * RGPD article 17 — Forget côté admin / DPO.
 *
 * Pourquoi
 * ────────
 * `/api/chat/session/forget` est un self-service visiteur (vérifie le
 * cookie `fg_v`). Mais quand un visiteur écrit au DPO par email, il
 * n'a plus son cookie : il faut que le DPO puisse purger à sa place.
 *
 * Différence avec l'endpoint visiteur : *pas* de check cookie. Auth
 * admin uniquement. Idempotent (déjà purgé → ok).
 *
 * Body
 * ────
 *   { sessionId: 'cs_xxx' }       → purge UNE session
 *   { visitorId: 'visitor_xxx' }  → purge TOUTES les sessions de ce visitor
 *
 * Exactement un des deux.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { sessionRepo } from '@/lib/chat/repos/session';
import { sessionService } from '@/lib/chat/services/session-service';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const forgetSchema = z
  .object({
    sessionId: z
      .string()
      .regex(/^cs_[a-zA-Z0-9_-]+$/)
      .optional(),
    visitorId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{6,128}$/)
      .optional(),
  })
  .refine((v) => Boolean(v.sessionId) !== Boolean(v.visitorId), {
    message: 'Provide exactly one of sessionId | visitorId.',
  });

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const parsed = forgetSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.sessionId) {
    const session = await sessionRepo.getById(parsed.data.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
    }
    if (session.status === 'purged') {
      return NextResponse.json({ ok: true, alreadyPurged: true, purgedCount: 0 });
    }
    try {
      await sessionService.forget(session.id);
    } catch (err) {
      logger.error('chat.admin.gdpr_forget_failed', {
        sessionId: session.id,
        adminEmail: auth.email,
        error: (err as Error).message,
      });
      return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
    logger.info('chat.admin.gdpr_forget', {
      mode: 'session',
      sessionId: session.id,
      adminEmail: auth.email,
    });
    return NextResponse.json({ ok: true, alreadyPurged: false, purgedCount: 1 });
  }

  const sessions = await sessionRepo.listByVisitor(parsed.data.visitorId!, 500);
  const purgable = sessions.filter((s) => s.status !== 'purged');
  let purgedCount = 0;
  for (const s of purgable) {
    try {
      await sessionService.forget(s.id);
      purgedCount += 1;
    } catch (err) {
      logger.error('chat.admin.gdpr_forget_failed', {
        sessionId: s.id,
        visitorId: parsed.data.visitorId,
        adminEmail: auth.email,
        error: (err as Error).message,
      });
      return NextResponse.json(
        { error: 'internal', purgedCount },
        { status: 500 },
      );
    }
  }
  logger.info('chat.admin.gdpr_forget', {
    mode: 'visitor',
    visitorId: parsed.data.visitorId,
    adminEmail: auth.email,
    scanned: sessions.length,
    purgedCount,
  });
  return NextResponse.json({
    ok: true,
    alreadyPurged: purgedCount === 0,
    purgedCount,
    scanned: sessions.length,
  });
}
