/**
 * POST /api/admin/form-config/[key]/rollback → rollback à une version historique.
 *
 * Body: { targetVersion: number }
 * Header: If-Match: <currentVersion> (optimistic lock contre la version actuelle)
 *
 * - Crée une nouvelle version (=last+1) avec le contenu de targetVersion.
 * - Audit : `form-config.rollback`.
 * - Revalidate path public.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §4.1
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_KEYS = new Set(['wizard_kit', 'wizard_commander']);

const rollbackInputSchema = z
  .object({
    targetVersion: z.number().int().positive(),
  })
  .strict();

export async function POST(
  request: Request,
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

    const ifMatch = request.headers.get('If-Match');
    if (!ifMatch || Number.isNaN(Number(ifMatch))) {
      throw new HttpError(
        'invalid_input',
        'Header "If-Match" requis (version courante).',
      );
    }
    const expectedVersion = Number(ifMatch);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }

    const parsed = rollbackInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const current = await formConfigRepo.getByKey(key);
    if (!current) {
      throw new HttpError('not_found', `form_config "${key}" introuvable.`);
    }
    if (current.version !== expectedVersion) {
      return NextResponse.json(
        {
          error: {
            code: 'version_conflict',
            message: `Version stale : courante=${current.version}, fournie=${expectedVersion}`,
            details: { currentVersion: current.version },
          },
        },
        { status: 409 },
      );
    }

    const restored = await formConfigRepo.rollback({
      key,
      targetVersion: parsed.data.targetVersion,
      actorId: session.adminId,
    });

    if (!restored) {
      throw new HttpError(
        'not_found',
        `Version ${parsed.data.targetVersion} introuvable dans l'historique.`,
      );
    }

    revalidatePath(`/api/checkout/form-config/${key}`);

    await logAuditEvent({
      action: 'form-config.rollback',
      actorId: session.adminId,
      resourceType: 'form_config',
      resourceId: key,
      meta: {
        toVersion: restored.version,
        fromVersion: expectedVersion,
        rolledBackTo: parsed.data.targetVersion,
      },
    });

    return NextResponse.json({
      key: restored.key,
      version: restored.version,
      active: restored.active,
      description: restored.description,
      config: restored.config,
      updatedAt: restored.updatedAt.toISOString(),
      updatedBy: restored.updatedBy,
    });
  } catch (err) {
    logger.error('admin.form-config.rollback.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
