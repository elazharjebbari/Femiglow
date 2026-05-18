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

export default async function AdminContentStudioPage() {
  const session = await requireAdmin('/admin/content-studio');
  const enabled = env.CONTENT_STUDIO_ENABLED === 'true';
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
          AI Content Studio
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Studio contenu
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Générer des idées, revoir les brouillons, préserver la voix FemiGlow et créer
          uniquement des brouillons Postiz validés.
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
      />
    </AdminShell>
  );
}
