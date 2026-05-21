import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { buildDashboardSnapshot, type AccountHealth } from '@/lib/content-studio/dashboard';

export const dynamic = 'force-dynamic';
// Server-rendered snapshot. 5 min revalidation prevents accidental hammering
// from a refresh loop while keeping the data fresh enough for ops triage.
export const revalidate = 300;

export default async function AdminContentStudioDashboardPage() {
  const session = await requireAdmin('/admin/content-studio/dashboard');
  const enabled = env.CONTENT_STUDIO_ENABLED === 'true';
  const snapshot = enabled ? await buildDashboardSnapshot() : null;

  return (
    <AdminShell adminEmail={session.email} active="content-studio">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            AI Content Studio
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Tableau de bord
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            Vue santé du module : publications hebdo, taux de succès des jobs,
            coût IA cumulé et dernière publication par compte social.
          </p>
        </div>
        <Link
          href="/admin/content-studio"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          ← Studio
        </Link>
      </header>

      {!enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Content Studio est désactivé. Activez <code>CONTENT_STUDIO_ENABLED=true</code> pour
          peupler le dashboard.
        </div>
      ) : snapshot ? (
        <DashboardWidgets snapshot={snapshot} />
      ) : null}
    </AdminShell>
  );
}

function DashboardWidgets({ snapshot }: { snapshot: Awaited<ReturnType<typeof buildDashboardSnapshot>> }) {
  const { postsThisWeek, jobSuccessRate, monthlyAiCost, accountHealth } = snapshot;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Posts publiés cette semaine"
          value={postsThisWeek.total.toString()}
          subline="Sur 7 jours glissants"
          tone="violet"
        />
        <MetricCard
          label="Taux de succès jobs"
          value={`${jobSuccessRate.rate}%`}
          subline={`${jobSuccessRate.published} publiés / ${jobSuccessRate.failed} échecs`}
          tone={successTone(jobSuccessRate.rate, jobSuccessRate.total)}
        />
        <MetricCard
          label={`Coût IA — ${monthlyAiCost.monthLabel}`}
          value={`${(monthlyAiCost.cents / 100).toFixed(2)} €`}
          subline={`${monthlyAiCost.runs} runs ce mois-ci`}
          tone="amber"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Publications quotidiennes (7j)
        </h2>
        <DailyBars dailyCounts={postsThisWeek.dailyCounts} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Comptes sociaux
        </h2>
        {accountHealth.length === 0 ? (
          <p className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Aucun compte social synchronisé.
          </p>
        ) : (
          <AccountTable rows={accountHealth} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Top performers
        </h2>
        <p className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-500">
          Données indisponibles — l&apos;ingestion <code>content_performance_snapshot</code> sera
          activée en S3.1 (worker cron Postiz <code>getInsights</code>).
        </p>
      </section>

      <p className="text-xs text-stone-400">
        Snapshot généré à {snapshot.generatedAt.toISOString()} · rafraîchi toutes les 5 minutes.
      </p>
    </div>
  );
}

function successTone(rate: number, total: number): MetricTone {
  if (total === 0) return 'stone';
  if (rate >= 90) return 'emerald';
  if (rate >= 70) return 'amber';
  return 'rose';
}

type MetricTone = 'violet' | 'amber' | 'emerald' | 'rose' | 'stone';

function MetricCard({
  label,
  value,
  subline,
  tone,
}: {
  label: string;
  value: string;
  subline?: string;
  tone: MetricTone;
}) {
  const cls: Record<MetricTone, string> = {
    violet: 'border-violet-100 bg-violet-50 text-violet-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    rose: 'border-rose-100 bg-rose-50 text-rose-950',
    stone: 'border-stone-200 bg-white text-stone-700',
  };
  return (
    <div className={`rounded-md border px-4 py-3 ${cls[tone]}`}>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-75">{label}</p>
      {subline ? <p className="mt-2 text-[11px] opacity-60">{subline}</p> : null}
    </div>
  );
}

function DailyBars({ dailyCounts }: { dailyCounts: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...dailyCounts.map((d) => d.count));
  return (
    <div className="grid grid-cols-7 gap-2 rounded-md border border-stone-200 bg-white p-4">
      {dailyCounts.map((day) => {
        const ratio = day.count / max;
        const height = Math.max(6, Math.round(ratio * 64));
        return (
          <div key={day.date} className="flex flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded bg-violet-500"
                style={{ height: `${height}px` }}
                title={`${day.count} publication(s)`}
              />
            </div>
            <p className="text-[10px] tabular-nums text-stone-500">{day.date.slice(5)}</p>
            <p className="text-xs font-medium text-stone-700">{day.count}</p>
          </div>
        );
      })}
    </div>
  );
}

function AccountTable({ rows }: { rows: AccountHealth[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-2">Compte</th>
            <th className="px-4 py-2">Plateforme</th>
            <th className="px-4 py-2">Statut</th>
            <th className="px-4 py-2">Dernier succès</th>
            <th className="px-4 py-2">Dernier échec</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => (
            <tr key={row.account.id}>
              <td className="px-4 py-2 font-medium text-stone-900">{row.account.name}</td>
              <td className="px-4 py-2 text-stone-600">
                {row.account.provider} · {row.account.platform}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.account.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {row.account.status}
                </span>
              </td>
              <td className="px-4 py-2 text-stone-600 tabular-nums">
                {row.lastSuccessAt ? row.lastSuccessAt.toISOString().slice(0, 16).replace('T', ' ') : '—'}
              </td>
              <td className="px-4 py-2 text-stone-600 tabular-nums">
                {row.lastFailureAt ? (
                  <span title={row.lastFailureCode ?? ''}>
                    {row.lastFailureAt.toISOString().slice(0, 16).replace('T', ' ')}
                    {row.lastFailureCode ? (
                      <span className="ml-1 text-[11px] text-rose-700">({row.lastFailureCode})</span>
                    ) : null}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
