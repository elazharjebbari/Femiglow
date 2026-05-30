import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listPostizIntegrations } from '@/lib/content-studio/postiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const integrations = await listPostizIntegrations();

    const formatted = integrations.map((integration) => ({
      id: integration.id,
      platform: integration.provider ?? integration.identifier ?? 'unknown',
      name: integration.name ?? integration.identifier ?? integration.id,
      disabled: Boolean(integration.disabled),
    }));

    return NextResponse.json({ integrations: formatted });
  } catch (err) {
    console.error('[ai-engine:integrations] Route error:', err);
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
