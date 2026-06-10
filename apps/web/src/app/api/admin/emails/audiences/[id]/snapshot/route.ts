/**
 * POST /api/admin/emails/audiences/[id]/snapshot
 *
 * Déclenche une matérialisation. Body { snapshotKey?, source?, campaignId? }.
 * Returns { snapshotId, size, status, durationMs? }.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { snapshotAudience } from '@/lib/mail/audiences/snapshot';
import { SnapshotTriggerSchema } from '@/lib/mail/audiences/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = SnapshotTriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await snapshotAudience(ctx.params.id, parsed.data);
    logger.info('admin.emails.audience.snapshot_triggered', {
      actor: session.email,
      audienceId: ctx.params.id,
      snapshotId: result.snapshotId,
      status: result.status,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('not found') || msg.includes('deleted')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    logger.error('admin.emails.audience.snapshot_failed', {
      error: msg,
      audienceId: ctx.params.id,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
