import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { gtmConfigCreateInputSchema } from '@/lib/tracking/gtm/config-schema';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const list = await gtmConfigStore.list();
    return NextResponse.json(list);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = await request.json();
    const parsed = gtmConfigCreateInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const created = await gtmConfigStore.create(parsed.data, { actorId: session.adminId });
    await auditTrackingChange({
      action: 'create',
      resource: 'tracking_gtm',
      resourceId: created.id,
      actorId: session.adminId,
      meta: { config: 'version', name: created.name },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
