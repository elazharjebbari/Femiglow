import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { scheduleContentPost } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  accountId: z.string().min(1).optional(),
  scheduledAt: z.string().datetime(),
  idempotencyKey: z.string().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload programmation invalide.', parsed.error.flatten());
    const result = await scheduleContentPost({
      postId: params.id,
      accountId: parsed.data.accountId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      idempotencyKey: parsed.data.idempotencyKey ?? request.headers.get('Idempotency-Key'),
      actorId: session.adminId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
