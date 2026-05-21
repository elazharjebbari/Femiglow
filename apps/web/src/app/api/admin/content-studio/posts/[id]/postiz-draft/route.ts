import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { postizDraftSchema } from '@/lib/content-studio/schemas';
import { createDraftInPostiz } from '@/lib/content-studio/service';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// S2.3 phase c — deprecation telemetry. The legacy `content_postiz_delivery`
// pipeline is being replaced by `social_publish_job`. We tag responses with
// RFC 8594 Deprecation/Sunset headers and emit an audit event on each call
// so we can confirm zero residual traffic before deleting the legacy in
// phase d (target 2026-08-01).
const SUNSET_DATE = 'Wed, 01 Aug 2026 00:00:00 GMT';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const deprecationHeaders = {
    Deprecation: 'true',
    Sunset: SUNSET_DATE,
    Link: '</api/admin/content-studio/posts/[id]/publish-now>; rel="successor-version"',
  };
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    await logAuditEvent({
      action: 'social.legacy_route_used',
      actorId: session.adminId,
      resourceType: 'content_post',
      resourceId: params.id,
      meta: { route: 'postiz-draft', sunset: SUNSET_DATE },
    });
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = postizDraftSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload Postiz invalide.', parsed.error.flatten());
    }
    const result = await createDraftInPostiz({
      postId: params.id,
      integrationId: parsed.data.integrationId,
      actorId: session.adminId,
      scheduledAt: parsed.data.scheduledAt,
      tags: parsed.data.tags,
    });
    return NextResponse.json(result, { headers: deprecationHeaders });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status, headers: deprecationHeaders });
  }
}
