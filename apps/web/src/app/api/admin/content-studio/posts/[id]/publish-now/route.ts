import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { publishContentPostNow } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  accountId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
}).default({});

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload publication invalide.', parsed.error.flatten());
    const result = await publishContentPostNow({
      postId: params.id,
      accountId: parsed.data.accountId,
      idempotencyKey: parsed.data.idempotencyKey ?? request.headers.get('Idempotency-Key'),
      actorId: session.adminId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
