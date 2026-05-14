/**
 * GET  /api/admin/tracking/plans          → liste filtrée (status, search)
 * POST /api/admin/tracking/plans          → création d'un plan (draft)
 *
 * cf. docs/gtm/unified-tracking/03-backend/api-design.md
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getTrackingPlanService,
  trackingPlanInputSchema,
  type PlanStatus,
} from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as PlanStatus | null;
    const search = url.searchParams.get('search') ?? undefined;

    const service = getTrackingPlanService();
    const plans = await service.list({ status: status ?? undefined, search });
    return NextResponse.json({ data: plans, total: plans.length });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }

    const parsed = trackingPlanInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('validation_failed', 'Données invalides', {
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
