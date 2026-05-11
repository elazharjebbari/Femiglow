import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getRitualSummary, refreshRitualAggregate } from '@/lib/db/queries/rituals';
import { listAdminRituals } from '@/lib/db/queries/rituals-admin';

export const dynamic = 'force-dynamic';

const PRODUCT_KEY = 'pack-femiglow';

export default async function AdminRitualsInsightsPage() {
  const session = await requireAdmin('/admin/rituals/insights');

  // Refresh à la volée pour avoir l'agrégat à jour
  await refreshRitualAggregate(PRODUCT_KEY);

  const [summary, allList] = await Promise.all([
    getRitualSummary(PRODUCT_KEY),
    listAdminRituals({ status: 'all', pageSize: 1 }),
  ]);

  const totalAll = allList.total;
  const ouiPct = summary.totalCount > 0 ? (summary.ouiCount / summary.totalCount) * 100 : 0;
  const photosPct =
    summary.totalCount > 0 ? (summary.withPhotosCount / summary.totalCount) * 100 : 0;

  const maxTagCount = Math.max(0, ...summary.topTags.map((t) => t.count));

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Insights — Rituels partagés
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Agrégat rafraîchi à chaque chargement de cette page.
        </p>
      </header>

      <section
        aria-labelledby="kpi-title"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="kpi-title" className="sr-only">
          KPI globaux
        </h2>
        <KpiTile label="Témoignages publiés" value={summary.totalCount} />
        <KpiTile label="En attente" value={allList.pendingCount} />
        <KpiTile label="Total tous statuts" value={totalAll} />
        <KpiTile label="Avec photos" value={summary.withPhotosCount} />
      </section>

      <section
        aria-labelledby="signal-title"
        className="mb-8 rounded border border-stone-200 bg-white p-6"
      >
        <h2 id="signal-title" className="mb-4 text-sm font-medium text-stone-700">
          Signal de retour
        </h2>
        <dl className="space-y-2 text-sm text-stone-700">
          <SignalRow
            label="Reviendraient"
            count={summary.ouiCount}
            total={summary.totalCount}
            color="bg-emerald-500"
          />
          <SignalRow
            label="Hésitent"
            count={summary.hesiteCount}
            total={summary.totalCount}
            color="bg-amber-500"
          />
          <SignalRow
            label="Pas pour elles"
            count={summary.nonCount}
            total={summary.totalCount}
            color="bg-rose-500"
          />
        </dl>
        <p className="mt-3 text-xs text-stone-500">
          {ouiPct.toFixed(0)} % reprendraient · {photosPct.toFixed(0)} % avec photos
        </p>
      </section>

      <section
        aria-labelledby="tags-title"
        className="rounded border border-stone-200 bg-white p-6"
      >
        <h2 id="tags-title" className="mb-4 text-sm font-medium text-stone-700">
          Tags les plus mentionnés
        </h2>
        {summary.topTags.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun tag mentionné.</p>
        ) : (
          <ul className="space-y-2">
            {summary.topTags.map((t) => {
              const widthPct = maxTagCount > 0 ? (t.count / maxTagCount) * 100 : 0;
              return (
                <li key={t.tag} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-stone-700">
                    {t.tag.replace(/-/g, ' ')}
                  </span>
                  <div className="flex h-3 flex-1 overflow-hidden bg-stone-100">
                    <div className="bg-emerald-500" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-stone-700">{t.count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function SignalRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const widthPct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <dt className="w-32 shrink-0">{label}</dt>
      <div className="flex h-3 flex-1 overflow-hidden bg-stone-100">
        <div className={color} style={{ width: `${widthPct}%` }} />
      </div>
      <dd className="w-12 shrink-0 text-right tabular-nums">
        {count} ({widthPct.toFixed(0)} %)
      </dd>
    </div>
  );
}
