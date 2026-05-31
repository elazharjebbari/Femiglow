/**
 * /api/admin/emails/audiences — list + create.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import {
  createAudience,
  listAudiencesWithSnapshotCount,
} from '@/lib/mail/audiences/queries';
import { CreateAudienceSchema } from '@/lib/mail/audiences/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await requireAdmin('/api/admin/emails/audiences');
  try {
    const audiences = await listAudiencesWithSnapshotCount();
    return NextResponse.json(audiences);
  } catch (err) {
    logger.error('admin.emails.audiences.list_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin('/api/admin/emails/audiences');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = CreateAudienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const created = await createAudience(parsed.data, session.email);
    logger.info('admin.emails.audience.created', {
      actor: session.email,
      audienceId: created.id,
      slug: created.slug,
    });
    return NextResponse.json(created);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Slug déjà utilisé' },
        { status: 409 },
      );
    }
    logger.error('admin.emails.audience.create_failed', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
