import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { AppShell } from '@/components/admin/content-studio-v2/shell/AppShell';
import { EmptyState } from '@/components/admin/content-studio-v2/shell/EmptyState';
import { Calendar } from '@/components/admin/content-studio-v2/plan/Calendar';
import type {
  CalendarMediaEntry,
  PublishJobRow,
} from '@/components/admin/content-studio-v2/plan/types';
import {
  listDraftPrimaryAssets,
  listDrafts,
  listIdeas,
  listPostizDeliveriesOverview,
  listPosts,
} from '@/lib/content-studio/service';
import { getBrief } from '@/lib/content-studio/repository';
import { listPublishJobsForAdmin } from '@/lib/social-publishing/admin-service';
import type { ContentPillar } from '@/lib/content-studio/types';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const session = await requireAdmin('/admin/content-studio-v2/plan');
  const initials = session.email.split('@')[0]?.slice(0, 2) ?? 'EJ';
  const enabled = env.CONTENT_STUDIO_V2_ENABLED === 'true';

  if (!enabled) {
    return (
      <AppShell userEmail={session.email} userInitials={initials}>
        <EmptyState
          eyebrow="Planning"
          title="Module désactivé"
          description={
            <>
              Activez <code style={{ fontFamily: 'var(--cs-font-mono)' }}>CONTENT_STUDIO_V2_ENABLED=true</code>{' '}
              pour utiliser le planning v2.
            </>
          }
        />
      </AppShell>
    );
  }

  const [drafts, posts, draftAssets, deliveries, ideas, queuedJobs, publishingJobs, failedJobs] =
    await Promise.all([
      listDrafts(),
      listPosts(),
      listDraftPrimaryAssets(),
      listPostizDeliveriesOverview(),
      listIdeas({ limit: 500, offset: 0 }),
      listPublishJobsForAdmin({ status: 'queued' }),
      listPublishJobsForAdmin({ status: 'publishing' }),
      listPublishJobsForAdmin({ status: 'failed' }),
    ]);

  // Build mediaByDraftId for the calendar (subset of asset record).
  const mediaByDraftId: Record<string, CalendarMediaEntry | undefined> = {};
  for (const [draftId, entry] of Object.entries(draftAssets)) {
    if (!entry) continue;
    const media = entry.media;
    mediaByDraftId[draftId] = {
      mediaId: entry.mediaId,
      previewUrl: media
        ? (media.previewUrl ?? media.thumbUrl ?? media.originalUrl ?? null)
        : null,
      alt: media?.alt ?? '',
    };
  }

  // Build pillarByDraftId by joining drafts → briefs → ideas.
  // Each draft has briefId; brief has ideaId; idea has pillar.
  const ideaPillarById = new Map<string, ContentPillar>();
  for (const idea of ideas) ideaPillarById.set(idea.id, idea.pillar);

  const briefIds = Array.from(new Set(drafts.map((d) => d.briefId)));
  const briefIdeaById = new Map<string, string>();
  await Promise.all(
    briefIds.map(async (id) => {
      const brief = await getBrief(id);
      if (brief) briefIdeaById.set(brief.id, brief.ideaId);
    }),
  );
  const pillarByDraftId: Record<string, ContentPillar | undefined> = {};
  for (const draft of drafts) {
    const ideaId = briefIdeaById.get(draft.briefId);
    pillarByDraftId[draft.id] = ideaId ? ideaPillarById.get(ideaId) : undefined;
  }

  const allJobs = [...queuedJobs, ...publishingJobs, ...failedJobs];
  const initialJobs: PublishJobRow[] = allJobs.map((entry) => ({
    id: entry.job.id,
    postId: entry.job.postId,
    status: entry.job.status,
    scheduledAt: entry.job.scheduledAt ? entry.job.scheduledAt.toISOString() : null,
    attemptCount: entry.job.attemptCount,
    lastError: entry.job.lastError,
    platform: entry.job.platform,
    format: entry.job.format,
    provider: entry.job.provider,
    createdAt: entry.job.createdAt.toISOString(),
    updatedAt: entry.job.updatedAt.toISOString(),
  }));

  return (
    <AppShell userEmail={session.email} userInitials={initials}>
      <header style={{ marginBottom: 20 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            color: 'var(--cs-fg-secondary)',
          }}
        >
          Planning
        </p>
        <h1
          style={{
            margin: '4px 0 0',
            fontFamily: 'var(--cs-font-display)',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          Calendrier éditorial
        </h1>
      </header>
      <Calendar
        posts={posts}
        drafts={drafts}
        deliveries={deliveries}
        mediaByDraftId={mediaByDraftId}
        pillarByDraftId={pillarByDraftId}
        initialJobs={initialJobs}
      />
    </AppShell>
  );
}
