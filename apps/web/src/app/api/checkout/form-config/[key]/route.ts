/**
 * CHA-230 — GET /api/checkout/form-config/[key]
 *
 * Lecture publique de la config wizard (steps, copy, validation).
 * Pas d'auth — la config est volontairement publique.
 *
 * Cache : `s-maxage=60, stale-while-revalidate=300`.
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { errorResponse, mapError } from '@/lib/checkout/api/response';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(
  _req: Request,
  context: { params: { key: string } },
): Promise<Response> {
  const key = context.params.key;
  if (!key || key.length < 3) {
    return errorResponse('invalid_input', 'key invalide.');
  }

  try {
    const row = await formConfigRepo.getByKey(key);
    if (!row) return errorResponse('not_found', 'form_config introuvable.');
    if (!row.active) {
      return errorResponse('invalid_state', 'form_config inactif.');
    }
    const payload = {
      key: row.key,
      version: row.version,
      config: row.config,
      updatedAt: row.updatedAt.toISOString(),
    };
    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    return res;
  } catch (err) {
    logger.error('checkout.form-config.get.failed', { key, error: String(err) });
    return mapError(err);
  }
}
