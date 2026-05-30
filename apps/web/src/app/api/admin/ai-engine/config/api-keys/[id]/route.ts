import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { deleteApiKey } from '@/lib/ai-engine/services/api-key-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const result = await deleteApiKey(params.id);

    return NextResponse.json(
      { success: result.success, fallbackToEnv: result.fallbackToEnv },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'API key not found') {
      return NextResponse.json({ error: 'Clé API introuvable' }, { status: 404 });
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
