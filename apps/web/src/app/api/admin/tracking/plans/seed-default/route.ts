/**
 * POST /api/admin/tracking/plans/seed-default
 *
 * Crée un brouillon de plan à partir du catalogue d'événements applicatifs
 * (event-catalog.ts) — utile pour démarrer rapidement sans repartir d'un
 * draft vide. Le nom et l'option `includeServerOnly` sont configurables.
 *
 * Réponses :
 * - 201 plan créé (status: draft, version: 1)
 * - 401 session admin requise
 * - 422 validation Zod
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  buildCanonicalSeed,
  getTrackingPlanService,
  trackingPlanInputSchema,
} from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SeedBody {
  name?: string;
  includeServerOnly?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let body: SeedBody = {};
    try {
      const raw = await request.text();
      if (raw) body = JSON.parse(raw) as SeedBody;
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }

    const seed = buildCanonicalSeed({
      name: typeof body.name === 'string' && body.name.length > 0 ? body.name : undefined,
      includeServerOnly:
        typeof body.includeServerOnly === 'boolean' ? body.includeServerOnly : undefined,
    });

    const parsed = trackingPlanInputSchema.safeParse(seed);
    if (!parsed.success) {
      throw new HttpError('validation_failed', 'Seed canonique invalide.', {
        issues: parsed.error.issues,
      });
    }

    const service = getTrackingPlanService();
    const plan = await service.create(parsed.data, session.email);
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
