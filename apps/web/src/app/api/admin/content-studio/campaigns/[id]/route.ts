import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getCampaign, updateCampaign, updateCampaignStatus } from '@/lib/content-studio/repository';
import { campaignUpdateSchema } from '@/lib/content-studio/schemas';
import { HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) {
      throw new HttpError('not_found', 'Campagne non trouvée.');
    }
    return NextResponse.json({ campaign });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { id } = await params;
    const existing = await getCampaign(id);
    if (!existing) {
      throw new HttpError('not_found', 'Campagne non trouvée.');
    }
    const body = await request.json();
    if (typeof body.status === 'string' && ['draft', 'active', 'archived'].includes(body.status)) {
      const campaign = await updateCampaignStatus(id, body.status as 'draft' | 'active' | 'archived');
      return NextResponse.json({ campaign });
    }
    const parsed = campaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation', message: JSON.stringify(parsed.error.flatten()) } },
        { status: 400 },
      );
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.objective !== undefined) patch.objective = parsed.data.objective;
    if (parsed.data.startsAt !== undefined) patch.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
    if (parsed.data.endsAt !== undefined) patch.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    const campaign = await updateCampaign(id, patch as Parameters<typeof updateCampaign>[1]);
    return NextResponse.json({ campaign });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}