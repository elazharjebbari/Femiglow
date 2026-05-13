import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { ValidatePairInputSchema } from '@/lib/tracking/gtm/sentinel-schemas';
import { validatePair } from '@/lib/tracking/gtm/pair-validator';

/**
 * POST /api/admin/tracking/gtm/validate-pair
 * Couche A — Valide la cohérence d'une paire config/mapping avant import GTM.
 *
 * cf. docs/gtm-poka-yoke/30-backend/01-api-spec.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await requireAdmin('/admin/tracking/gtm/validate-pair');

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = ValidatePairInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
  }

  const result = validatePair({
    configJson: parsed.data.configJson,
    mappingJson: parsed.data.mappingJson,
  });

  logger.info?.('gtm.validate-pair.executed', {
    actor: session.email,
    verdict: result.ok ? 'ok' : 'error',
    errors: result.errors.length,
    warnings: result.warnings.length,
  });

  return NextResponse.json(result, {
    headers: { 'cache-control': 'no-store' },
  });
}
