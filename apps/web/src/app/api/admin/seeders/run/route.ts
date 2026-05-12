/**
 * POST /api/admin/seeders/run
 * body  : `{ ids?: string[] }` — si omis ou vide, on lance tous les seeders.
 * → 202 `{ jobId, total, etaMs }`
 *
 * Crée un job dans le store et lance l'orchestrateur en fire-and-forget. Le
 * client doit ensuite ouvrir le flux SSE `/api/admin/seeders/jobs/<jobId>/stream`
 * pour observer la progression.
 *
 * Audit : un event `seeders.run` est créé par seeder réussi côté
 * orchestrateur — pas besoin d'auditer le POST lui-même.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { getJobStore } from '@/lib/seeders/job-store';
import { runJob } from '@/lib/seeders/orchestrator';
import {
  SEEDERS_REGISTRY,
  getSeedersByIds,
  getTotalEstimatedDurationMs,
} from '@/lib/seeders/registry';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      // body vide ⇒ tous les seeders
    }
    const parsed = bodySchema.safeParse(raw);
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

    const requestedIds =
      parsed.data.ids && parsed.data.ids.length > 0
        ? parsed.data.ids
        : SEEDERS_REGISTRY.map((s) => s.id);

    const selected = getSeedersByIds(requestedIds);
    if (selected.length === 0) {
      throw new HttpError(
        'invalid_input',
        'Aucun seeder valide dans la sélection.',
      );
    }

    const unknown = requestedIds.filter(
      (id) => !selected.some((s) => s.id === id),
    );
    if (unknown.length > 0) {
      logger.warn('admin.seeders.run.unknown_ids', { unknown });
    }

    const store = getJobStore();
    const job = store.create(
      selected.map((s) => s.id),
      session.adminId,
    );

    // Fire-and-forget : on ne `await` pas pour rendre la réponse rapidement.
    void runJob({
      jobId: job.id,
      selected: [...selected],
      actorId: session.adminId,
    }).catch((err) => {
      logger.error('admin.seeders.run.orchestrator_failed', {
        jobId: job.id,
        error: String(err),
      });
    });

    return NextResponse.json(
      {
        jobId: job.id,
        total: selected.length,
        etaMs: getTotalEstimatedDurationMs(selected.map((s) => s.id)),
        selected: selected.map((s) => s.id),
        unknown,
      },
      { status: 202 },
    );
  } catch (err) {
    logger.error('admin.seeders.run.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
