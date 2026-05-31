/**
 * CHA-LEAD-V2 — GET /api/admin/chat/audit-pollution
 *
 * Renvoie un rapport synthétique sur la pollution chat_session :
 *  - distribution de chat_session par kind
 *  - count chat_lead par source
 *  - cohérence kind ↔ source
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/02-backend/api-routes.md §3
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getAdminSession } from '@/lib/auth/require-admin';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatLead, chatSession } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = requireChatDb();

  const kindDist = await db
    .select({
      kind: chatSession.kind,
      n: sql<number>`COUNT(*)`,
    })
    .from(chatSession)
    .groupBy(chatSession.kind);

  const sourceDist = await db
    .select({
      source: chatLead.source,
      n: sql<number>`COUNT(*)`,
    })
    .from(chatLead)
    .groupBy(chatLead.source);

  const coherence = await db.execute<{ kind: string; source: string; n: number }>(sql`
    SELECT s.kind, l.source, COUNT(*) AS n
      FROM ${chatSession} s
      JOIN ${chatLead} l ON l.session_id = s.id
     GROUP BY 1, 2
     ORDER BY n DESC
  `);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    distributions: {
      session_kind: kindDist.map((r) => ({ kind: r.kind, n: Number(r.n) })),
      lead_source: sourceDist.map((r) => ({ source: r.source, n: Number(r.n) })),
    },
    coherence: (coherence as { rows?: unknown[] }).rows ?? [],
  });
}
