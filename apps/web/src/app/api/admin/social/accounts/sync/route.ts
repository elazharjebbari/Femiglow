import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { syncDryRunSocialAccounts } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const accounts = await syncDryRunSocialAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
