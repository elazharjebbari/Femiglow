import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { applyBulkAction, BulkLimitError } from '@/lib/rituals/bulk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BulkActionPayloadSchema = z.object({
  action: z.enum(['approve', 'reject', 'hide', 'restore', 'feature', 'unfeature']),
  ids: z.array(z.string().min(1)).min(1).max(1000),
  note: z.string().min(1).max(500).optional(),
  skipFlagged: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'JSON invalide' } },
      { status: 400 },
    );
  }

  const parsed = BulkActionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Payload invalide',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyBulkAction(parsed.data, { actorId: session.adminId });
    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof BulkLimitError) {
      return NextResponse.json(
        { error: { code: 'BULK_LIMIT_EXCEEDED', message: e.message } },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/Note requise/.test(msg)) {
      return NextResponse.json(
        { error: { code: 'NOTE_REQUIRED', message: msg } },
        { status: 400 },
      );
    }
    console.error('[admin/rituals/bulk-action] error', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL' } },
      { status: 500 },
    );
  }
}
