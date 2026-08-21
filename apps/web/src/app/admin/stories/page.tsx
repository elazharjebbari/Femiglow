import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  StoriesManager,
  type AdminStory,
} from '@/components/admin/stories/StoriesManager';
import { listStories, type StoryWithSegments } from '@/lib/db/queries/stories';

export const dynamic = 'force-dynamic';

type I18n = Record<string, string>;

function serialize(story: StoryWithSegments): AdminStory {
  return {
    id: story.id,
    slug: story.slug,
    pageGroup: story.pageGroup,
    titleI18n: (story.titleI18n ?? {}) as I18n,
    bubblePosterUrl: story.bubblePosterUrl,
    accent: story.accent,
    displayOrder: story.displayOrder,
    isActive: story.isActive,
    segments: story.segments.map((seg) => ({
      id: seg.id,
      storyId: seg.storyId,
      videoUrl: seg.videoUrl,
      webmUrl: seg.webmUrl,
      posterUrl: seg.posterUrl,
      durationMs: seg.durationMs,
      width: seg.width,
      height: seg.height,
      captionI18n: (seg.captionI18n ?? {}) as I18n,
      ctaLabelI18n: (seg.ctaLabelI18n ?? {}) as I18n,
      ctaTarget: seg.ctaTarget,
      displayOrder: seg.displayOrder,
      isActive: seg.isActive,
    })),
  };
}

export default async function AdminStoriesPage() {
  const session = await requireAdmin('/admin/stories');
  const stories = await listStories();
  return (
    <AdminShell adminEmail={session.email} active="stories">
      <StoriesManager initialStories={stories.map(serialize)} />
    </AdminShell>
  );
}
