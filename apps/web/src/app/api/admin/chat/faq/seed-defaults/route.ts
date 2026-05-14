/**
 * Seed admin : reseed la FAQ chat depuis le CSV par défaut
 * (`docs/dossier-chat-v2/02-data/faq-entries-seed.csv`).
 *
 * Idempotent par `(key, language)` : UPSERT via `faqRepo.upsertEntry`.
 * Recalcule les embeddings OpenAI à chaque appel — skip gracieux si pas
 * de provider d'embedding configuré (rapporte `skipped` sans toucher la DB).
 *
 * Form-encoded ou JSON. Redirige vers `/admin/chat/faq` après succès (303).
 * Renvoie JSON pour les clients API.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { runChatFaqSeed } from '../../../../../../../scripts/seed-chat-faq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let report: Awaited<ReturnType<typeof runChatFaqSeed>>;
  try {
    report = await runChatFaqSeed();
  } catch (err) {
    logger.error('chat.admin.seed_faq_failed', {
      error: (err as Error).message,
      by: auth.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  revalidateTag('chat-config');
  logger.info('chat.admin.seed_faq', { by: auth.email, report });

  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true, report });
  }

  const flashCode = report.embeddingModel === null ? 'seed-skipped' : 'seeded';
  return NextResponse.redirect(
    new URL(`/admin/chat/faq?ok=${flashCode}`, req.url),
    303,
  );
}
