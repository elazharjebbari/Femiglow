import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listAdminSocialAccounts, syncSocialAccounts } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  provider: z.enum(['dry_run', 'meta_graph', 'postiz']).optional(),
  platform: z.enum(['instagram', 'facebook']).optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const accounts = (await listAdminSocialAccounts()).filter((account) =>
      (!query.provider || account.provider === query.provider) &&
      (!query.platform || account.platform === query.platform),
    );
    return NextResponse.json({ accounts });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const accounts = await syncSocialAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
