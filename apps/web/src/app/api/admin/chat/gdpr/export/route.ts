/**
 * RGPD article 15 — Export des données d'une session chat (admin / DPO).
 *
 * Pourquoi
 * ────────
 * Un visiteur écrit au DPO pour demander une copie de ses données. Plutôt
 * que d'aller chercher manuellement dans la DB, le DPO appelle cet
 * endpoint avec le `sessionId` (ou le `visitorId`) et reçoit un JSON
 * complet : session + messages + leads associés.
 *
 * Querystring
 * ───────────
 *  - sessionId = cs_xxx  → exporte la session précise
 *  - visitorId = visitor_xxx → liste toutes les sessions du visiteur
 *
 * Exactement l'un des deux est requis. 400 sinon.
 *
 * Sécurité
 * ────────
 * `requireAdminApi`. La réponse contient des PII (phone, prénom, IP-like
 * identifiers) → header `Cache-Control: no-store` + extraction loggée.
 *
 * cf. docs/dossier-chat-v2/03-backend/api-contracts.yaml
 *     `/api/admin/chat/gdpr/export`
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { leadRepo } from '@/lib/chat/repos/lead';
import { messageRepo } from '@/lib/chat/repos/message';
import { sessionRepo } from '@/lib/chat/repos/session';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_ID_REGEX = /^cs_[a-zA-Z0-9_-]+$/;
const VISITOR_ID_REGEX = /^[a-zA-Z0-9_-]{6,128}$/;

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const sessionId = sp.get('sessionId');
  const visitorId = sp.get('visitorId');

  if ((sessionId && visitorId) || (!sessionId && !visitorId)) {
    return NextResponse.json(
      { error: 'bad-request', message: 'Provide exactly one of sessionId | visitorId.' },
      { status: 400 },
    );
  }

  if (sessionId) {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      return NextResponse.json({ error: 'invalid-session-id' }, { status: 400 });
    }
    const session = await sessionRepo.getById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
    }
    const [messages, leads] = await Promise.all([
      messageRepo.listBySession(session.id, 1000),
      leadRepo.listBySession(session.id),
    ]);
    logger.info('chat.admin.gdpr_export', {
      mode: 'session',
      sessionId: session.id,
      adminEmail: auth.email,
      messagesCount: messages.length,
      leadsCount: leads.length,
    });
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        mode: 'session',
        session,
        messages,
        leads,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="chat-gdpr-${session.id}.json"`,
        },
      },
    );
  }

  if (!VISITOR_ID_REGEX.test(visitorId!)) {
    return NextResponse.json({ error: 'invalid-visitor-id' }, { status: 400 });
  }
  const sessions = await sessionRepo.listByVisitor(visitorId!, 500);
  const expanded = await Promise.all(
    sessions.map(async (s) => {
      const [messages, leads] = await Promise.all([
        messageRepo.listBySession(s.id, 1000),
        leadRepo.listBySession(s.id),
      ]);
      return { session: s, messages, leads };
    }),
  );
  logger.info('chat.admin.gdpr_export', {
    mode: 'visitor',
    visitorId,
    adminEmail: auth.email,
    sessionsCount: sessions.length,
  });
  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      mode: 'visitor',
      visitorId,
      sessionsCount: sessions.length,
      sessions: expanded,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="chat-gdpr-visitor-${visitorId}.json"`,
      },
    },
  );
}
