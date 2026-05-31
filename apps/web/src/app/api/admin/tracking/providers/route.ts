import { NextResponse } from 'next/server';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { getAdminSession } from '@/lib/auth/require-admin';
import { HttpError, formatErrorResponse } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Non autorisé');

    const providers = await listTrackingProviders();
    const safe = providers.map((p) => ({
      kind: p.kind,
      status: p.status,
      pixelId: p.pixelId,
      hasCapiToken: p.capiToken != null && p.capiToken !== '',
      testEventCode: p.testEventCode,
      enabledEvents: p.enabledEvents ?? [],
      lastEventAt: p.lastEventAt?.toISOString() ?? null,
      errorCount24h: p.errorCount24h,
      lastError: p.lastError,
      updatedAt: p.updatedAt.toISOString(),
    }));

    return NextResponse.json({ providers: safe });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}