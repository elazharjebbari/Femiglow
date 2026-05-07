import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listTrackingPages,
  upsertTrackingPage,
} from '@/lib/db/queries/tracking/pages';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const upsertSchema = z
  .object({
    route: z.string().min(1).max(255),
    title: z.string().min(1).max(255),
    category: z.string().min(1).max(64),
    enabled: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const pages = await listTrackingPages();
    return NextResponse.json({ pages });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const page = await upsertTrackingPage(parsed.data);
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_page',
      resourceId: page.id,
      actorId: session.adminId,
      meta: { route: page.route },
    });
    return NextResponse.json({ page });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
