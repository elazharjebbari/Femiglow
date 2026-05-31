/**
 * GET /api/admin/form-config — liste les configs admin (wizard_kit + wizard_commander).
 *
 * Auth admin requise. Retourne aussi les rows inactives (côté public route
 * filtre par `active=true`, ici on veut tout pour l'UI admin).
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §4.1
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_KEYS = ['wizard_kit', 'wizard_commander'] as const;

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const rows = await Promise.all(
      KNOWN_KEYS.map(async (key) => {
        const row = await formConfigRepo.getByKey(key);
        if (!row) return null;
        return {
          key: row.key,
          version: row.version,
          active: row.active,
          description: row.description,
          updatedAt: row.updatedAt.toISOString(),
          updatedBy: row.updatedBy,
        };
      }),
    );

    return NextResponse.json({
      items: rows.filter((r): r is NonNullable<typeof r> => r !== null),
    });
  } catch (err) {
    logger.error('admin.form-config.list.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
