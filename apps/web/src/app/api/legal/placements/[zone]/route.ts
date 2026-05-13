import { NextResponse } from 'next/server';

import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listPlacementsForZone } from '@/lib/legal/repository';
import { legalZoneKeySchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 300;

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=900';

export async function GET(
  _req: Request,
  { params }: { params: { zone: string } },
): Promise<Response> {
  try {
    const parsed = legalZoneKeySchema.safeParse(params.zone);
    if (!parsed.success) throw new HttpError('invalid_input', 'Zone invalide');

    const rows = await listPlacementsForZone(parsed.data);
    const links = rows.map((r) => ({
      slug: r.pageSlug,
      label: r.labelOverride ?? r.title,
      href: `/legal/${r.pageSlug}`,
      display_order: r.displayOrder,
    }));

    return NextResponse.json(
      { zone: parsed.data, links },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
