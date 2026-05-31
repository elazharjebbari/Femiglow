import { NextResponse } from 'next/server';
import type { TrackingProviderKind } from '@/lib/db/types';
import { findTrackingProviderByKind, decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import { getAdminSession } from '@/lib/auth/require-admin';
import { HttpError, formatErrorResponse } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS: TrackingProviderKind[] = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Non autorisé');

    const { kind } = await params;
    if (!VALID_KINDS.includes(kind as TrackingProviderKind)) {
      throw new HttpError('invalid_input', `Provider "${kind}" non reconnu`);
    }

    const provider = await findTrackingProviderByKind(kind as TrackingProviderKind);
    if (!provider) {
      return NextResponse.json({ capiToken: null });
    }

    const capiToken = decryptCapiToken(provider);
    return NextResponse.json({ capiToken });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}