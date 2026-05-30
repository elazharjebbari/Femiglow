import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { db } from '@/lib/db/client';
import { env } from '@/lib/env';
import { formatErrorResponse } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();
    return NextResponse.json({
      mode: db() ? 'drizzle' : 'memory',
      enabled: env.CONTENT_STUDIO_ENABLED === 'true',
      version: 'P3',
      mockMode: env.CONTENT_STUDIO_V2_MOCK_MODE === 'true',
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}