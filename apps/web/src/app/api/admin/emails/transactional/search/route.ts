/**
 * POST /api/admin/emails/transactional/search
 *
 * Recherche outbox filtrée + paginée. Body validé via Zod (cf. schemas.ts).
 * Retourne `{ rows, total, window }`.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { SearchInputSchema } from '@/lib/mail/transactional/schemas';
import { listOutboxFiltered } from '@/lib/mail/transactional/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await requireAdmin('/api/admin/emails/transactional/search');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = SearchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await listOutboxFiltered(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.transactional.search_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
