/**
 * /admin/emails/transactional — Cockpit transactional (M5.1).
 *
 * Refonte : KPI header live + Cmd-K palette + saved views + filtres
 * typés + bulk actions. La page RSC fait juste l'auth gate + le fetch
 * initial des saved views, puis délègue au composant client cockpit.
 *
 * Cf. docs/emailing/admin-evolution/04-ui-ux/02-mockups/transactional-inbox.txt
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';
import { listViewsForAdmin } from '@/lib/mail/transactional/views-queries';

export const dynamic = 'force-dynamic';

export default async function TransactionalCockpitPage() {
  const session = await requireAdmin('/admin/emails/transactional');

  // Fetch initial des saved views (system + owned). Le composant client
  // fait le re-fetch après chaque CRUD.
  const views = await listViewsForAdmin(session.email, 'transactional');
  const initialViews = views.map((v) => ({
    id: v.id,
    name: v.name,
    isSystem: v.isSystem,
  }));

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Transactionnel
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Cockpit temps réel — recherche, filtres, actions de masse.
          </p>
        </div>
        <Link href="/admin/emails" className="text-sm text-stone-500 underline">
          ← Dashboard
        </Link>
      </header>

      <TransactionalCockpit initialViews={initialViews} />
    </AdminShell>
  );
}
