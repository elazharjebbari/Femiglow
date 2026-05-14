import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listPagesUsingVar } from '@/lib/legal/repository';
import { legalTemplateVarKeySchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/legal/template-vars/[key]/usage — liste les slugs des
 * pages PUBLIÉES qui référencent {{KEY}}.
 */
export async function GET(
  _req: Request,
  { params }: { params: { key: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const parsed = legalTemplateVarKeySchema.safeParse(params.key);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Var key invalide' } },
        { status: 400 },
      );
    }

    const slugs = await listPagesUsingVar(parsed.data);
    return NextResponse.json({ key: parsed.data, count: slugs.length, slugs });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
