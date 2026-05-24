/**
 * /admin/content-studio/health — dashboard santé publishing.
 *
 * Référence : `docs/live-systems-fix-2026-05/07-system-publishing.md` § S5
 *
 * Affiche en temps quasi-réel (polling client ou refresh manuel) :
 *   - KPIs : in-flight jobs, dead letters 24h, success rate, latency P95
 *   - Tableau des 20 derniers jobs avec status
 *   - Alertes dead letters (si > 0)
 *
 * Server Component — query directe via Drizzle (pas d'API intermédiaire),
 * cohérent avec les autres pages admin/.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getPublishingHealthStats,
  listRecentPublishingJobs,
  listDeadLetters,
} from '@/lib/social-publishing/health-queries';

export const dynamic = 'force-dynamic';
// Pas de cache — on veut le snapshot temps réel à chaque visite.
export const revalidate = 0;

const TZ = 'Europe/Paris';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: TZ,
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export default async function PublishingHealthPage() {
  const session = await requireAdmin('/admin/content-studio/health');

  const [stats, recent, deadLetters] = await Promise.all([
    getPublishingHealthStats(24),
    listRecentPublishingJobs(20),
    listDeadLetters(24),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="content-studio">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-900">
            Santé Publishing
          </h1>
          <p className="text-sm text-stone-500">
            Snapshot {new Date(stats.asOf).toLocaleString('fr-FR', { timeZone: TZ })}
            {' · '}
            Fenêtre 24h
          </p>
        </header>

        {/* KPIs */}
        <section
          aria-label="KPIs publishing"
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <Kpi
            label="Jobs en cours"
            value={stats.inFlight}
            hint="processing + scheduled"
            variant={stats.inFlight > 50 ? 'warning' : 'neutral'}
          />
          <Kpi
            label="Dead letters (24h)"
            value={stats.deadLetters}
            hint="status='dead' après 5 tentatives"
            variant={stats.deadLetters > 0 ? 'critical' : 'success'}
          />
          <Kpi
            label="Taux de succès"
            value={`${stats.successRatePct}%`}
            hint={`Sur ${stats.totalJobs} jobs`}
            variant={
              stats.successRatePct < 90
                ? 'warning'
                : stats.successRatePct >= 95
                  ? 'success'
                  : 'neutral'
            }
          />
          <Kpi
            label="Latence P95"
            value={stats.latencyP95Ms ? `${(stats.latencyP95Ms / 1000).toFixed(1)}s` : '—'}
            hint="createdAt → publishedAt"
            variant="neutral"
          />
        </section>

        {/* Alertes dead letters */}
        {deadLetters.length > 0 ? (
          <section
            aria-label="Alertes dead letters"
            className="rounded-md border-l-4 border-red-500 bg-red-50 p-4"
          >
            <header className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-900">
                ⚠️ {deadLetters.length} dead letter(s) actif(s)
              </h2>
              <span className="text-xs text-red-700">
                Action requise — investigation manuelle
              </span>
            </header>
            <table className="w-full text-sm">
              <thead className="text-stone-700">
                <tr>
                  <th className="text-left">Job ID</th>
                  <th className="text-left">Créé</th>
                  <th className="text-left">Programmé</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {deadLetters.slice(0, 10).map((j) => (
                  <tr key={j.id} className="border-t border-red-200">
                    <td className="py-1.5">{j.id}</td>
                    <td className="py-1.5">{fmtDate(j.createdAt)}</td>
                    <td className="py-1.5">
                      {j.scheduledAt ? fmtDate(j.scheduledAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* By status */}
        <section aria-label="Répartition par statut">
          <h2 className="mb-3 text-lg font-medium text-stone-900">
            Répartition par statut (24h)
          </h2>
          {stats.byStatus.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun job sur la fenêtre.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {stats.byStatus.map((s) => (
                <div
                  key={s.status}
                  className="rounded border border-stone-200 bg-white px-4 py-3"
                >
                  <p className="text-2xl font-semibold tabular-nums">{s.count}</p>
                  <p className="text-xs uppercase tracking-wide text-stone-500">
                    {s.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent jobs */}
        <section aria-label="Jobs récents">
          <h2 className="mb-3 text-lg font-medium text-stone-900">
            Jobs récents (20 derniers)
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun job récent.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Job ID</th>
                    <th className="px-4 py-2 text-left font-medium">Créé</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Programmé pour
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Publié</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {recent.map((j) => (
                    <tr key={j.id} className="border-t border-stone-100">
                      <td className="px-4 py-2">
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-stone-600">
                        {j.id}
                      </td>
                      <td className="px-4 py-2 text-xs">{fmtDate(j.createdAt)}</td>
                      <td className="px-4 py-2 text-xs">
                        {j.scheduledAt ? fmtDate(j.scheduledAt) : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {j.publishedAt ? fmtDate(j.publishedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="border-t border-stone-200 pt-4 text-xs text-stone-500">
          <p>
            Cette page se rafraîchit à chaque visite. Pour une vue cross-système,
            voir{' '}
            <a
              href="/admin/live-health"
              className="text-stone-700 underline hover:text-stone-900"
            >
              /admin/live-health
            </a>
            .
          </p>
        </footer>
      </div>
    </AdminShell>
  );
}

interface KpiProps {
  label: string;
  value: string | number;
  hint?: string;
  variant: 'neutral' | 'success' | 'warning' | 'critical';
}

function Kpi({ label, value, hint, variant }: KpiProps) {
  const variantClasses: Record<KpiProps['variant'], string> = {
    neutral: 'border-stone-200 bg-white',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-red-200 bg-red-50',
  };
  const valueClasses: Record<KpiProps['variant'], string> = {
    neutral: 'text-stone-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    critical: 'text-red-700',
  };
  return (
    <div className={`rounded border px-4 py-3 ${variantClasses[variant]}`}>
      <p className={`text-3xl font-semibold tabular-nums ${valueClasses[variant]}`}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-stone-900">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    scheduled: 'bg-blue-100 text-blue-800',
    processing: 'bg-amber-100 text-amber-800',
    draft: 'bg-stone-100 text-stone-700',
    failed: 'bg-red-100 text-red-800',
    dead: 'bg-red-200 text-red-900 font-bold',
    cancelled: 'bg-stone-200 text-stone-600',
  };
  const cls = styles[status] ?? 'bg-stone-100 text-stone-700';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
