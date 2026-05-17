import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse } from '@/lib/errors/http-error';
import { syncPostizIntegrations } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    return NextResponse.json(await syncPostizIntegrations());
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

