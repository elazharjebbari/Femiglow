import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getRitualSummary, refreshRitualAggregate } from '@/lib/db/queries/rituals';
import { listAdminRituals } from '@/lib/db/queries/rituals-admin';
import { getExtendedInsights } from '@/lib/db/queries/rituals-insights';
import { db, memoryStore, schema } from '@/lib/db/client';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const PRODUCT_KEY = 'pack-femiglow';

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web',
  email_j45: 'E-mail J+45',
  manual: 'Manuel',
  import_csv: 'Import CSV',
  import_json: 'Import JSON',
  import_zip: 'Import ZIP',
};

export default async function AdminRitualsInsightsPage() {
  const session = await requireAdmin('/admin/rituals/insights');

  const [summary, allList, extended] = await Promise.all([
    getRitualSummary(PRODUCT_KEY),
    listAdminRituals({ status: 'all', pageSize: 1 }),
    getExtendedInsights(30),
  ]);

  // Lecture refreshedAt depuis la table aggregate (sans typer dans le schéma public).
  const refreshedAt = await readAggregateRefreshedAt(PRODUCT_KEY);
  const staleness = refreshedAt ? Date.now() - refreshedAt.getTime() : Infinity;
  // Refresh agrégat asynchrone (fire-and-forget) si > 5 min.
  // Pattern P4.6 : le rendu n'attend pas — le prochain hit verra la fraîcheur.
  if (staleness > 5 * 60 * 1000) {
    refreshRitualAggregate(PRODUCT_KEY).catch((e) =>
      console.error('[insights] refresh agg failed', e),
    );
  }
  const stalenessLabel = refreshedAt ? formatStaleness(staleness) : 'jamais';

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
          Agrégat rafraîchi {stalenessLabel}. Refresh asynchrone si &gt; 5 min.
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
        aria-labelledby="timeseries-title"
        className="mb-8 rounded border border-stone-200 bg-white p-6"
      >
        <h2 id="timeseries-title" className="mb-4 text-sm font-medium text-stone-700">
          Activité — 30 derniers jours
        </h2>
        <DailyChart data={extended.daily} />
      </section>

      <section
        aria-labelledby="vision-ml-title"
        className="mb-8 grid gap-4 sm:grid-cols-2"
      >
        <h2 id="vision-ml-title" className="sr-only">
          Monitoring vision ML
        </h2>
        <div className="rounded border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Photos analysées</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {extended.visionMl.totalPhotos}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-stone-600">
            <li>OK : {extended.visionMl.byStatus.OK}</li>
            <li>Relecture humaine : {extended.visionMl.byStatus.MANUAL_REVIEW}</li>
            <li>Rejetées (visage) : {extended.visionMl.byStatus.REJECTED_FACE}</li>
            <li>En attente : {extended.visionMl.byStatus.PENDING_CHECK}</li>
          </ul>
        </div>
        <div className="rounded border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Taux de rejet vision ML
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              extended.visionMl.rejectedFaceRate > 0.3
                ? 'text-rose-700'
                : 'text-stone-900'
            }`}
          >
            {(extended.visionMl.rejectedFaceRate * 100).toFixed(1)} %
          </p>
          {extended.visionMl.rejectedFaceRate > 0.3 && (
            <p className="mt-2 text-xs text-rose-700">
              Provider trop sévère ? Recalibration recommandée.
            </p>
          )}
        </div>
      </section>

      {extended.sources.length > 0 && (
        <section
          aria-labelledby="sources-title"
          className="mb-8 rounded border border-stone-200 bg-white p-6"
        >
          <h2 id="sources-title" className="mb-4 text-sm font-medium text-stone-700">
            Sources & taux d'approbation
          </h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="pb-2 text-left">Source</th>
                <th scope="col" className="pb-2 text-right">Total</th>
                <th scope="col" className="pb-2 text-right">Approuvés</th>
                <th scope="col" className="pb-2 text-right">Rejetés</th>
                <th scope="col" className="pb-2 text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {extended.sources.map((s) => (
                <tr key={s.source} className="border-t border-stone-100 text-stone-700">
                  <td className="py-2">{SOURCE_LABEL[s.source] ?? s.source}</td>
                  <td className="py-2 text-right tabular-nums">{s.total}</td>
                  <td className="py-2 text-right tabular-nums">{s.approved}</td>
                  <td className="py-2 text-right tabular-nums">{s.rejected}</td>
                  <td className="py-2 text-right tabular-nums">
                    {(s.approvalRate * 100).toFixed(0)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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

async function readAggregateRefreshedAt(productKey: string): Promise<Date | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select({ refreshedAt: schema.ritualAggregate.refreshedAt })
      .from(schema.ritualAggregate)
      .where(eq(schema.ritualAggregate.productKey, productKey))
      .limit(1)) as Array<{ refreshedAt: Date }>;
    return rows[0]?.refreshedAt ?? null;
  }
  return memoryStore().ritualAggregate.get(productKey)?.refreshedAt ?? null;
}

function formatStaleness(ms: number): string {
  if (ms === Infinity) return 'jamais';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "il y a moins d'une minute";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

function DailyChart({
  data,
}: {
  data: Array<{ date: string; submissions: number; approvals: number; rejections: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.submissions));
  const width = 600;
  const height = 120;
  const barWidth = Math.max(2, width / data.length - 2);
  return (
    <svg
      role="img"
      aria-label="Soumissions, approbations et rejets par jour sur 30 jours"
      viewBox={`0 0 ${width} ${height + 30}`}
      className="h-40 w-full"
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const x = i * (width / data.length);
        const subH = (d.submissions / max) * height;
        const apprH = (d.approvals / max) * height;
        return (
          <g key={d.date} transform={`translate(${x},0)`}>
            <rect
              x={0}
              y={height - subH}
              width={barWidth}
              height={subH}
              className="fill-stone-300"
            >
              <title>
                {d.date} · {d.submissions} soumis · {d.approvals} approuvés · {d.rejections} rejetés
              </title>
            </rect>
            <rect
              x={0}
              y={height - apprH}
              width={barWidth}
              height={apprH}
              className="fill-emerald-500"
            />
            {i % 5 === 0 && (
              <text
                x={barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                className="fill-stone-500 text-[8px]"
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <line x1="0" y1={height} x2={width} y2={height} className="stroke-stone-200" />
    </svg>
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
