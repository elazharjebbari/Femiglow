/**
 * GET /api/admin/emails/transactional/summary?window=1h|24h|7d|30d
 *
 * KPIs temps réel pour le header du cockpit transactional ET le dashboard
 * fenêtré (F03). Auth API : 401 JSON franc (pattern F02 nav-counters) — un
 * fetch client suivrait la redirection 307 vers le HTML de login et
 * échouerait en parse JSON au lieu d'identifier la session expirée.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { SummaryQuerySchema } from '@/lib/mail/transactional/schemas';
import { summarizeOutbox } from '@/lib/mail/transactional/summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = SummaryQuerySchema.safeParse({ window: url.searchParams.get('window') ?? '1h' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await summarizeOutbox(parsed.data.window);
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.transactional.summary_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
