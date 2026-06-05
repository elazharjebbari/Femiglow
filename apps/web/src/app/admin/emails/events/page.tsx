/**
 * /admin/emails/events — Dashboard debug user_event (M5.2.7).
 *
 * Vue admin pour debug du pipeline user_event :
 *   - Compteur total 24h (cliquable → flux complet)
 *   - Top events par (event_name, source) (lignes cliquables → drill-down source)
 *   - 100 derniers events bruts (avec propriétés)
 *
 * Permet de vérifier que les bridges (web/email/server/admin/import) écrivent
 * bien dans user_event après un trigger de test.
 *
 * Server Component mince : auth + 3 lectures DB, puis délègue le rendu au
 * composant présentationnel `<EventsDashboardView>` (testé en isolation).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getEventCountsByName,
  getRecentEvents,
  getTotalEvents,
} from '@/lib/user-events/queries';
import {
  EventsDashboardView,
  EVENT_SOURCES,
  type EventSource,
} from '@/components/admin/emails/events/EventsDashboardView';

export const dynamic = 'force-dynamic';

export default async function EventsDebugPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const session = await requireAdmin('/admin/emails/events');
  const sourceFilter = (EVENT_SOURCES as readonly string[]).includes(
    searchParams.source ?? '',
  )
    ? (searchParams.source as EventSource)
    : undefined;

  const [counts, recent, total] = await Promise.all([
    getEventCountsByName(),
    getRecentEvents({ limit: 100, source: sourceFilter }),
    getTotalEvents(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Events utilisateur (debug)
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Pipeline <code className="font-mono text-xs">user_event</code> — vue de
            contrôle pour vérifier que les bridges (suivi web, webhooks email,
            server actions, actions admin) alimentent bien la table unifiée.
          </p>
        </div>
        <Link href="/admin/emails" className="text-sm text-stone-500 underline">
          ← Tableau de bord
        </Link>
      </header>

      <EventsDashboardView
        counts={counts}
        recent={recent}
        total={total}
        sourceFilter={sourceFilter}
      />
    </AdminShell>
  );
}
