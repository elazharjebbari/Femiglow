import Link from 'next/link';

import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listLeads } from '@/lib/db/queries/leads';
import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';
import { listDeliveries } from '@/lib/db/queries/webhook-deliveries';
import { legalListStats, pagesWithMissingPlacements } from '@/lib/legal/repository';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await requireAdmin('/admin');

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    { rows: recentLeads, total: totalLeads },
    endpoints,
    deliveries,
    legalStats,
    legalOrphans,
  ] = await Promise.all([
    listLeads({ from: last24h, pageSize: 5 }),
    listWebhookEndpoints(),
    listDeliveries({ pageSize: 200 }),
    legalListStats().catch(() => ({
      total: 0, draft: 0, review: 0, published: 0, archived: 0,
    })),
    pagesWithMissingPlacements().catch(() => [] as string[]),
  ]);

  const pending = deliveries.rows.filter((d) => d.status === 'pending').length;
  const succeeded24h = deliveries.rows.filter(
    (d) => d.status === 'succeeded' && d.updatedAt >= last24h,
  ).length;

  return (
    <AdminShell adminEmail={session.email} active="dashboard">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Vue synthétique des dernières 24 heures.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicateurs clés">
        <Kpi label="Leads (24h)" value={totalLeads} />
        <Kpi label="Webhooks en attente" value={pending} />
        <Kpi label="Livraisons réussies (24h)" value={succeeded24h} />
      </section>
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Derniers leads
        </h2>
        {recentLeads.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Aucun lead sur les dernières 24 heures.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
            {recentLeads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {lead.name ?? lead.email ?? lead.phone ?? '—'}
                  </p>
                  <p className="text-xs text-stone-500">{lead.email ?? lead.phone ?? '—'}</p>
                </div>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs uppercase tracking-wide text-stone-600">
                  {lead.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10" aria-labelledby="legal-card-title">
        <div className="flex items-center justify-between">
          <h2
            id="legal-card-title"
            className="text-sm font-medium uppercase tracking-wide text-stone-500"
          >
            Pages légales
          </h2>
          <Link
            href="/admin/legal"
            className="text-xs text-stone-600 hover:text-stone-900 hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Kpi label="Total" value={legalStats.total} />
          <Kpi
            label="Publiées"
            value={legalStats.published}
            tone={legalStats.published > 0 ? 'ok' : 'warn'}
          />
          <Kpi
            label="En revue"
            value={legalStats.review}
            tone={legalStats.review > 0 ? 'warn' : 'neutral'}
          />
          <Kpi
            label="Brouillons"
            value={legalStats.draft}
            tone={legalStats.draft > 0 ? 'warn' : 'neutral'}
          />
        </div>
        {legalOrphans.length > 0 ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ⚠ {legalOrphans.length} page(s) publiée(s) sans placement visible :{' '}
            <code>{legalOrphans.slice(0, 3).join(', ')}</code>
            {legalOrphans.length > 3 ? '…' : ''}.{' '}
            <Link
              href="/admin/legal/placements"
              className="underline underline-offset-2 hover:text-amber-700"
            >
              Configurer les placements
            </Link>
          </p>
        ) : null}
      </section>

      <p className="mt-10 text-xs text-stone-400">
        Endpoints webhooks actifs : {endpoints.filter((e) => e.active).length} /{' '}
        {endpoints.length}.
      </p>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-stone-900';
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
