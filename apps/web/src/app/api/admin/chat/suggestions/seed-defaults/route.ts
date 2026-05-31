/**
 * Seed admin : reseed les suggestions (canned-pairs / pastilles de chat)
 * depuis le CSV par défaut (`docs/dossier-chat-v2/02-data/canned-pairs-seed.csv`).
 *
 * Idempotent par `key` : UPSERT (insert si absent, update + nouvelle version
 * si `body_hash` diffère). Audit trail via `chat_canned_pair_version`.
 *
 * Form-encoded ou JSON. Redirige vers `/admin/chat/suggestions` après succès
 * (303). Renvoie JSON pour les clients API.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { redirectToPublic } from '@/lib/http/redirect-public';
import { runChatCannedPairsSeed } from '../../../../../../../scripts/seed-chat-canned-pairs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let report: Awaited<ReturnType<typeof runChatCannedPairsSeed>>;
  try {
    report = await runChatCannedPairsSeed({ actorId: auth.email });
  } catch (err) {
    logger.error('chat.admin.seed_suggestions_failed', {
      error: (err as Error).message,
      by: auth.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  revalidateTag('chat-config');
  logger.info('chat.admin.seed_suggestions', { by: auth.email, report });

  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true, report });
  }

  return redirectToPublic(req, '/admin/chat/suggestions?ok=seeded');
}
