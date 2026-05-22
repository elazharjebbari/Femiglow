/**
 * Legacy Content Studio (v1) — fallback while the v2 refonte stabilises.
 *
 * Always accessible regardless of CONTENT_STUDIO_V2_DEFAULT. Identical to
 * the original `/admin/content-studio` page; only the URL differs so v2
 * can claim the canonical path.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ContentStudioClient } from '@/components/admin/content-studio/ContentStudioClient';
import { env } from '@/lib/env';
import {
  listContentPerformanceSnapshotsOverview,
  listDraftPrimaryAssets,
  listDrafts,
  listIdeas,
  listPostizDeliveriesOverview,
  listPosts,
} from '@/lib/content-studio/service';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Content Studio · Legacy',
};

export default async function AdminContentStudioLegacyPage() {
  const session = await requireAdmin('/admin/content-studio-legacy');
  const enabled = env.CONTENT_STUDIO_ENABLED === 'true';
  const legacyPostizDisabled = env.CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED === 'true';
  const [ideas, drafts, posts, draftAssets, deliveries, snapshots] = enabled
    ? await Promise.all([
        listIdeas({ limit: 50, offset: 0 }),
        listDrafts(),
        listPosts(),
        listDraftPrimaryAssets(),
        listPostizDeliveriesOverview(),
        listContentPerformanceSnapshotsOverview(),
      ])
    : [[], [], [], {}, [], []];

  return (
    <AdminShell adminEmail={session.email} active="content-studio">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          AI Content Studio · ancienne interface
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Studio contenu — Legacy
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Interface historique conservée le temps que la refonte v2 soit stabilisée.
          La nouvelle interface se trouve sur{' '}
          <a href="/admin/content-studio" className="text-stone-900 underline">/admin/content-studio</a>.
        </p>
      </header>
      <ContentStudioClient
        initialIdeas={ideas}
        initialDrafts={drafts}
        initialPosts={posts}
        initialDraftAssets={draftAssets}
        initialDeliveries={deliveries}
        initialSnapshots={snapshots}
        enabled={enabled}
        legacyPostizDisabled={legacyPostizDisabled}
      />
    </AdminShell>
  );
}
