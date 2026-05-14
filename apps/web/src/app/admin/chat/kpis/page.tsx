/**
 * CHA-108 — KPIs détaillés (toutes sections, sélecteur fenêtre).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries, windowStart, type KpiWindow } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { summarizeWeeklyLeads } from '@/lib/chat/services/weekly-digest';
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

  // CHAT-067 — KPI Care : médiane / p90 du temps de prise en charge des
  // leads (handledAt - createdAt). Branchée sur la même fenêtre que les
  // autres KPI ; cap à 500 leads pour rester sous le seuil RSC.
  const leadHandling = enabled
    ? await adminQueries
        .listChatLeads({ fromDate: windowStart(w), limit: 500 })
        .then((rows) => summarizeWeeklyLeads(rows))
        .catch(() => null)
    : null;

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
          {leadHandling && leadHandling.total > 0 && (
            <section
              className="mb-6 grid gap-3 sm:grid-cols-3"
              aria-label="KPIs Care — prise en charge leads"
            >
              <Card
                label="Leads pris en charge"
                value={`${leadHandling.handledCount} / ${leadHandling.total}`}
                sub={`${leadHandling.hotPending} hot pending`}
              />
              <Card
                label="Médiane prise en charge"
                value={formatMinutes(leadHandling.medianHandlingMinutes)}
                sub="(createdAt → handledAt)"
              />
              <Card
                label="p90 prise en charge"
                value={formatMinutes(leadHandling.p90HandlingMinutes)}
                sub="(pire-cas 1-sur-10)"
              />
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-stone-500">
          KPIs indisponibles {enabled ? '— vérifier la base.' : '— chat désactivé.'}
        </p>
      )}
    </AdminShell>
  );
}

function formatMinutes(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
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
