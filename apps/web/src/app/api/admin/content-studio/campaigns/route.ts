import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listCampaigns, createCampaign } from '@/lib/content-studio/repository';
import { campaignCreateSchema, campaignQuerySchema } from '@/lib/content-studio/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const parsed = campaignQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation', message: JSON.stringify(parsed.error.flatten()) } },
        { status: 400 },
      );
    }
    const campaigns = await listCampaigns(parsed.data.status ? { status: parsed.data.status } : undefined);
    return NextResponse.json({ campaigns });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const body = await request.json();
    const parsed = campaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation', message: JSON.stringify(parsed.error.flatten()) } },
        { status: 400 },
      );
    }
    const campaign = await createCampaign({
      name: parsed.data.name,
      objective: parsed.data.objective,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      createdBy: session.adminId,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}