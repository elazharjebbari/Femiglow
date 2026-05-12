import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import {
  approveRitual,
  getAdminRitualById,
  hideRitual,
  rejectRitual,
  restoreRitual,
  setFeatured,
} from '@/lib/db/queries/rituals-admin';
import { RitualAdminActionSchema } from '@/lib/schemas/rituals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }
  const ritual = await getAdminRitualById(params.id);
  if (!ritual) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }
  return NextResponse.json({ data: ritual });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const parsed = RitualAdminActionSchema.safeParse(payload);
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

  const ctx = { actorId: session.adminId };
  try {
    switch (parsed.data.action) {
      case 'approve': {
        const updated = await approveRitual(params.id, ctx);
        return NextResponse.json({ data: updated });
      }
      case 'reject': {
        const updated = await rejectRitual(params.id, ctx, parsed.data.note);
        return NextResponse.json({ data: updated });
      }
      case 'hide': {
        const updated = await hideRitual(params.id, ctx, parsed.data.note);
        return NextResponse.json({ data: updated });
      }
      case 'restore': {
        const updated = await restoreRitual(params.id, ctx);
        return NextResponse.json({ data: updated });
      }
      case 'feature': {
        const result = await setFeatured(params.id, ctx, true);
        return NextResponse.json({ data: result });
      }
      case 'unfeature': {
        const result = await setFeatured(params.id, ctx, false);
        return NextResponse.json({ data: result });
      }
      case 'correct': {
        return NextResponse.json(
          { error: { code: 'NOT_IMPLEMENTED' } },
          { status: 501 },
        );
      }
      default:
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST' } },
          { status: 400 },
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'FEATURED_LIMIT_REACHED') {
      return NextResponse.json(
        { error: { code: 'FEATURED_LIMIT_REACHED', message: 'Max 3 featured' } },
        { status: 409 },
      );
    }
    if (msg === 'Not found') {
      return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    }
    console.error('[admin/rituals/PATCH] error', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL' } },
      { status: 500 },
    );
  }
}
