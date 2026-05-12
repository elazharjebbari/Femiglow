/**
 * GET /api/admin/seeders
 * → liste publique des descriptors (sans la fonction `run`).
 *
 * Permet à l'UI de cocher / décocher chaque feed avant de lancer un job.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { SEEDERS_REGISTRY } from '@/lib/seeders/registry';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const seeders = SEEDERS_REGISTRY.map((s) => ({
      id: s.id,
      group: s.group,
      label: s.label,
      description: s.description,
      estimatedDurationMs: s.estimatedDurationMs,
      idempotent: s.idempotent,
    }));

    return NextResponse.json({ seeders });
  } catch (err) {
    logger.error('admin.seeders.list.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
