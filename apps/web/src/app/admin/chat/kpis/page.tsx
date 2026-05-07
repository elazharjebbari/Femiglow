/**
 * CHA-108 — KPIs détaillés (toutes sections, sélecteur fenêtre).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries, type KpiWindow } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const WINDOWS: KpiWindow[] = ['today', 'yesterday', '7d', '30d', '90d', 'all'];

export default async function ChatKpisPage({
  searchParams,
}: {
  searchParams?: { w?: string };
}) {
  const session = await requireAdmin('/admin/chat/kpis');
  const enabled = isChatEnabled();
  const w = (WINDOWS.find((x) => x === searchParams?.w) ?? '30d') as KpiWindow;

  const kpis = enabled ? await adminQueries.overviewKpis(w).catch(() => null) : null;

  const conversionRate =
    kpis && kpis.sessions > 0 ? (kpis.conversions / kpis.sessions) * 100 : 0;
  const csat =
    kpis && kpis.feedbackPos + kpis.feedbackNeg > 0
      ? (kpis.feedbackPos / (kpis.feedbackPos + kpis.feedbackNeg)) * 100
      : 0;

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="kpis" />
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">KPIs détaillés</h1>
        <form method="get" className="flex gap-1 text-sm">
          {WINDOWS.map((window) => (
            <a
              key={window}
              href={`?w=${window}`}
              className={`rounded-md px-3 py-1 ${
                w === window ? 'bg-stone-900 text-white' : 'border border-stone-300'
              }`}
            >
              {window}
            </a>
          ))}
        </form>
      </header>

      {kpis ? (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card label="Conversions" value={`${kpis.conversions}`} sub={`${conversionRate.toFixed(1)} %`} />
            <Card label="CSAT" value={`${csat.toFixed(0)} %`} sub={`${kpis.feedbackPos} 👍 / ${kpis.feedbackNeg} 👎`} />
            <Card label="Coût" value={`${kpis.totalCostEur.toFixed(4)} €`} sub={`${kpis.messagesAgent} messages`} />
          </section>
          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card label="Latence P50" value={kpis.latencyP50 != null ? `${Math.round(kpis.latencyP50)} ms` : '—'} />
            <Card label="Latence P95" value={kpis.latencyP95 != null ? `${Math.round(kpis.latencyP95)} ms` : '—'} />
            <Card label="Sessions" value={`${kpis.sessions}`} />
          </section>
        </>
      ) : (
        <p className="text-sm text-stone-500">
          KPIs indisponibles {enabled ? '— vérifier la base.' : '— chat désactivé.'}
        </p>
      )}
    </AdminShell>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
