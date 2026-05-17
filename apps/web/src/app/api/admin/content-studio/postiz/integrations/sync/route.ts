import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { syncPostizIntegrations } from '@/lib/content-studio/service';
import { requireContentStudioEnabled } from '@/lib/content-studio/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdmin('/admin/content-studio/settings');
    return NextResponse.json(await syncPostizIntegrations());
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

