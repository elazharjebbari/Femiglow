/**
 * Seed admin : reseed les intents + centroïdes depuis le CSV par défaut
 * (`docs/dossier-chat-v2/02-data/intent-dataset-sample.csv`).
 *
 * Recalcule les embeddings OpenAI à chaque appel — skip gracieux si pas
 * de provider d'embedding configuré.
 *
 * Form-encoded ou JSON. Renvoie JSON par défaut (pas de page admin
 * dédiée actuellement).
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { runChatIntentsSeed } from '../../../../../../../scripts/seed-chat-intents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let report: Awaited<ReturnType<typeof runChatIntentsSeed>>;
  try {
    report = await runChatIntentsSeed({ actorId: auth.email });
  } catch (err) {
    logger.error('chat.admin.seed_intents_failed', {
      error: (err as Error).message,
      by: auth.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  revalidateTag('chat-config');
  logger.info('chat.admin.seed_intents', { by: auth.email, report });

  return NextResponse.json({ ok: true, report });
}
