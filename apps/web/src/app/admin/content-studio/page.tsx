import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ContentStudioClient } from '@/components/admin/content-studio/ContentStudioClient';
import { logAuditEvent } from '@/lib/audit/log-event';
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

  // Substitution v2 : quand CONTENT_STUDIO_V2_DEFAULT=true ET v2 ENABLED,
  // /admin/content-studio devient l'entrée par défaut de la refonte. L'ancien
  // module reste accessible sur /admin/content-studio-legacy pour rollback
  // sans deploy.
  if (
    env.CONTENT_STUDIO_V2_DEFAULT === 'true' &&
    env.CONTENT_STUDIO_V2_ENABLED === 'true'
  ) {
    // Telemetry: count substitution redirects. The actual v2 page logs
    // its own visit event so the funnel is observable both ways.
    void logAuditEvent({
      action: 'content_studio.v1.redirected_to_v2',
      actorId: session.adminId,
      resourceType: 'content_studio',
      resourceId: null,
      meta: { source: 'page_visit' },
    }).catch(() => undefined);
    redirect('/admin/content-studio-v2/home');
  }

  // Telemetry: this admin actively used v1 with the substitution flag off
  // (or v2 disabled). Useful to confirm the migration path.
  void logAuditEvent({
    action: 'content_studio.v1.visited',
    actorId: session.adminId,
    resourceType: 'content_studio',
    resourceId: null,
    meta: {
      v2Enabled: env.CONTENT_STUDIO_V2_ENABLED,
      v2Default: env.CONTENT_STUDIO_V2_DEFAULT,
    },
  }).catch(() => undefined);

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
        legacyPostizDisabled={legacyPostizDisabled}
      />
    </AdminShell>
  );
}
