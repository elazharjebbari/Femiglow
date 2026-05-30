import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listPublishJobsForAdmin } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['draft', 'approved', 'queued', 'publishing', 'published', 'failed', 'cancelled']).optional(),
  postId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Filtres invalides.', parsed.error.flatten());
    }
    const jobs = await listPublishJobsForAdmin(parsed.data);
    return NextResponse.json({ jobs });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
