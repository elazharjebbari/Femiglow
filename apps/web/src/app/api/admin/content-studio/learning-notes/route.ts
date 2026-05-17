import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { learningNoteSchema } from '@/lib/content-studio/schemas';
import { addLearningNote, listLearningNotes, listLearningNotesForPost } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const notes = postId
      ? await listLearningNotesForPost(postId)
      : await listLearningNotes();
    return NextResponse.json({ notes });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = learningNoteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Note invalide.', details: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const note = await addLearningNote(parsed.data);
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}