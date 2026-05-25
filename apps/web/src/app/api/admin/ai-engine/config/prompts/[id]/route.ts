import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEnginePromptTemplates } from '@/lib/db/schema-ai-engine';
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

    // Soft-delete: set is_active = false (keep version history)
    const [updated] = await database
      .update(aiEnginePromptTemplates)
      .set({ isActive: false })
      .where(eq(aiEnginePromptTemplates.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Prompt non trouve.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
