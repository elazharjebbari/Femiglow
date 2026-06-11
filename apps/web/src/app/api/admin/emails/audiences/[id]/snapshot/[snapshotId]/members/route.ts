/**
 * GET /api/admin/emails/audiences/[id]/snapshot/[snapshotId]/members
 *
 * Membres paginés d'un snapshot figé (UX-AUD-012). Permet d'auditer/exporter
 * la liste réellement ciblée (objectif AUD-S2 : envoi reproductible).
 *
 * Query : ?limit=&offset= (JSON paginé) ou ?format=csv (export complet, borné).
 * Contrat JSON : { members: Array<{ email, name }>, total, limit, offset }.
 *
 * Sécurité : auth admin ; le snapshot DOIT appartenir à l'audience [id]
 * (sinon 404 — pas de fuite cross-audience). Validation Zod des query params.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { db as getDb } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import { emailAudienceSnapshot } from '@/lib/db/schema-emails';
import {
  listSnapshotMembers,
  snapshotMembersToCsv,
} from '@/lib/mail/audiences/snapshot-members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

export async function GET(
  req: Request,
  ctx: { params: { id: string; snapshotId: string } },
) {
  await requireAdmin('/api/admin/emails/audiences/snapshot/members');

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    format: url.searchParams.get('format') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { limit, offset, format } = parsed.data;

  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ members: [], total: 0, limit, offset });

  // Le snapshot doit appartenir à l'audience [id] — anti-fuite cross-audience.
  const snap = await drizzle
    .select({ id: emailAudienceSnapshot.id, audienceId: emailAudienceSnapshot.audienceId })
    .from(emailAudienceSnapshot)
    .where(eq(emailAudienceSnapshot.id, ctx.params.snapshotId))
    .limit(1);
  if (!snap[0] || snap[0].audienceId !== ctx.params.id) {
    return NextResponse.json({ error: 'Snapshot introuvable' }, { status: 404 });
  }

  try {
    if (format === 'csv') {
      // Export borné : on lit jusqu'à 500 lignes (limite MAX du helper).
      const { members } = await listSnapshotMembers(ctx.params.snapshotId, {
        limit: 500,
        offset: 0,
      });
      const csv = snapshotMembersToCsv(members);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="snapshot-${ctx.params.snapshotId}-membres.csv"`,
        },
      });
    }

    const { members, total } = await listSnapshotMembers(ctx.params.snapshotId, {
      limit,
      offset,
    });
    return NextResponse.json({
      members: members.map((m) => ({
        email: m.email,
        name:
          m.payload && typeof m.payload === 'object' && 'name' in m.payload
            ? ((m.payload as { name?: unknown }).name ?? null)
            : null,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('admin.emails.audience.snapshot_members_failed', {
      error: String(err),
      snapshotId: ctx.params.snapshotId,
    });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
