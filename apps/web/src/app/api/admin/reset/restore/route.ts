/**
 * POST /api/admin/reset/restore
 * body { backupId, confirm: 'RESTORE' }
 * → 200 { ok, restored: { db, media } }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { restoreFromBackup, ResetError } from '@/lib/reset';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  backupId: z.string().regex(/^bkp_/),
  confirm: z.literal('RESTORE'),
});

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  let raw: unknown = {};
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'CONFIG_INVALID', issues: parsed.error.issues } },
      { status: 400 },
    );
  }

  try {
    const t0 = Date.now();
    const result = await restoreFromBackup(parsed.data.backupId);
    await logAuditEvent({
      action: 'reset.restore.complete',
      actorId: session.adminId,
      resourceType: 'reset',
      resourceId: parsed.data.backupId,
      meta: { durationMs: Date.now() - t0, restored: result },
    });
    return NextResponse.json({ ok: true, restored: result });
  } catch (err) {
    if (err instanceof ResetError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 500 });
    }
    throw err;
  }
}
