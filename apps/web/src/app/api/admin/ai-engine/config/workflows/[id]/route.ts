import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEngineWorkflowConfigs } from '@/lib/db/schema-ai-engine';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdminApi();

    const { id } = await params;

    const database = db();
    if (!database) {
      return NextResponse.json(
        { error: 'Database non disponible.' },
        { status: 503 },
      );
    }

    // Soft-delete: set is_active = false
    const [updated] = await database
      .update(aiEngineWorkflowConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(aiEngineWorkflowConfigs.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Workflow non trouve.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
