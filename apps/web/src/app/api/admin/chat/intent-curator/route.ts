/**
 * CHA-230 Phase 3 — Routes admin: intent curator (GET = list golden,
 * pour exposer le golden-set actuel via API à des outils internes /
 * scripts).
 *
 * Le tagging d'un message individuel passe par :
 *   POST /api/admin/chat/intent-curator/[messageId]
 *
 * La page Server Component `/admin/chat/intent-curator` fait sa
 * propre query côté serveur (`adminQueries.listMessagesForCurator`)
 * et n'a donc pas besoin d'un GET ici.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { goldenIntentRepo } from '@/lib/chat/repos/golden-intent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const intent = url.searchParams.get('intent') ?? undefined;
  const lang = url.searchParams.get('language');
  const language =
    lang === 'fr' || lang === 'ar' || lang === 'ar-MA' ? lang : undefined;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.min(500, Math.max(1, Number(limitRaw))) : 200;

  const rows = await goldenIntentRepo.list({ intent, language, limit });
  return NextResponse.json({ rows, count: rows.length });
}
