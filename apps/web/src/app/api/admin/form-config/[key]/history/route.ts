/**
 * GET /api/admin/form-config/[key]/history → liste les versions historiques.
 *
 * Auth admin. Retourne max 50 lignes (limite repo).
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §4.1
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_KEYS = new Set(['wizard_kit', 'wizard_commander']);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string }> | { key: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const key = params.key;
    if (!KNOWN_KEYS.has(key)) {
      throw new HttpError('not_found', `form_config "${key}" inconnu.`);
    }

    const history = await formConfigRepo.listHistory(key, 50);
    return NextResponse.json({
      items: history
        .map((row) => ({
          id: row.id,
          version: row.version,
          action: row.action,
          description: row.description,
          actorId: row.actorId,
          createdAt: row.createdAt.toISOString(),
          config: row.config,
        }))
        // Tri DESC par version pour afficher le plus récent en haut.
        .sort((a, b) => b.version - a.version),
    });
  } catch (err) {
    logger.error('admin.form-config.history.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
