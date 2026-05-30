import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getDraft, getPostForDraft } from '@/lib/content-studio/repository';
import { approveContentDraft } from '@/lib/content-studio/service';
import {
  publishContentPostNow,
  scheduleContentPost,
  syncSocialAccounts,
} from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  draftId: z.string().min(1),
  mode: z.enum(['now', 'schedule']),
  scheduledAt: z.string().datetime().optional(),
  integrationIds: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminApi();

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload de publication invalide.', parsed.error.flatten());
    }

    const { draftId, mode, scheduledAt } = parsed.data;

    if (mode === 'schedule' && !scheduledAt) {
      throw new HttpError('invalid_input', 'La date de programmation est requise en mode planifié.');
    }

    // 1. Ensure the draft exists
    const draft = await getDraft(draftId);
    if (!draft) {
      throw new HttpError('not_found', 'Brouillon AI Engine introuvable.');
    }

    // 2. Get or create the content_post via the approval flow
    let post = await getPostForDraft(draftId);
    if (!post) {
      // Approve the draft to create the content_post
      post = await approveContentDraft({ draftId, actorId: session.adminId });
    }

    // 3. Ensure social accounts are synced (creates dry_run + Postiz accounts)
    await syncSocialAccounts();

    // 4. Publish or schedule through the social publishing system
    if (mode === 'now') {
      const result = await publishContentPostNow({
        postId: post.id,
        actorId: session.adminId,
      });

      return NextResponse.json(
        {
          status: 'published',
          postId: post.id,
          draftId,
          job: { id: result.job.id, status: result.job.status },
          result: result.result,
        },
        { status: 201 },
      );
    }

    // mode === 'schedule'
    const result = await scheduleContentPost({
      postId: post.id,
      scheduledAt: new Date(scheduledAt!),
      actorId: session.adminId,
    });

    return NextResponse.json(
      {
        status: 'scheduled',
        postId: post.id,
        draftId,
        scheduledAt,
        job: { id: result.job.id, status: result.job.status },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[ai-engine:publish] Route error:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
