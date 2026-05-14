/**
 * /admin/emails — Dashboard transactional (M1.C).
 *
 * Minimal MVP : 6 KPI cards (7 derniers jours) + quick links vers les
 * sous-sections. Server component, lecture seule.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getOutboxKpi, listRecentOutbox } from '@/lib/admin/emails/queries';
import { checkEmailingHealth } from '@/lib/admin/emails/health';

export const dynamic = 'force-dynamic';

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return ((num / den) * 100).toFixed(1) + ' %';
}

export default async function AdminEmailsPage() {
  const session = await requireAdmin('/admin/emails');
  const [kpi, recent, health] = await Promise.all([
    getOutboxKpi(),
    listRecentOutbox({ limit: 8 }),
    checkEmailingHealth(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Emails</h1>
          <p className="mt-1 text-sm text-stone-600">
            Transactionnels envoyés via Stalwart. KPIs 7 derniers jours.
          </p>
        </div>
        <HealthBadge level={health.level} report={health} />
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Envoyés (7j)" value={fmt(kpi.sentLast7d)} sub={`sur ${fmt(kpi.totalLast7d)} tentatives`} />
        <Kpi label="Livrés" value={fmt(kpi.deliveredLast7d)} sub={pct(kpi.deliveredLast7d, kpi.sentLast7d) + ' des envoyés'} />
        <Kpi label="Échecs" value={fmt(kpi.failedLast7d)} sub={pct(kpi.failedLast7d, kpi.totalLast7d)} tone={kpi.failedLast7d > 0 ? 'amber' : 'neutral'} />
        <Kpi label="DLQ" value={fmt(kpi.dlqLast7d)} sub="abandonnés (max attempts)" tone={kpi.dlqLast7d > 0 ? 'rose' : 'neutral'} />
        <Kpi label="En attente" value={fmt(kpi.pendingNow)} sub="pickup cron 60s" tone={kpi.pendingNow > 50 ? 'amber' : 'neutral'} />
        <Kpi label="Total tentatives" value={fmt(kpi.totalLast7d)} sub="7 derniers jours" />
      </section>

      <nav className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/admin/emails/transactional"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Liste transactionnel →
        </Link>
        <Link
          href="/admin/emails/campaigns"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Campagnes →
        </Link>
        <Link
          href="/admin/emails/automation"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Automatisations →
        </Link>
        <Link
          href="/admin/emails/audiences"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Audiences →
        </Link>
        <Link
          href="/admin/emails/templates"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Templates HTML →
        </Link>
        <Link
          href="/admin/emails/listmonk"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Listmonk (admin natif) →
        </Link>
      </nav>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
          Derniers envois
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Template</th>
                <th className="px-3 py-2 text-left font-medium">Destinataire</th>
                <th className="px-3 py-2 text-left font-medium">Statut</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                    Aucun envoi sur la période.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60">
                    <td className="px-3 py-2 text-xs text-stone-600 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.template}</td>
                    <td className="px-3 py-2 text-stone-700">{r.toEmail}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/emails/transactional/${r.id}`} className="text-xs text-stone-600 underline">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'amber' | 'rose' | 'emerald';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : tone === 'emerald'
          ? 'text-emerald-700'
          : 'text-stone-900';
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
}

function HealthBadge({
  level,
  report,
}: {
  level: 'ok' | 'degraded' | 'incident';
  report: Awaited<ReturnType<typeof import('@/lib/admin/emails/health').checkEmailingHealth>>;
}) {
  const cls =
    level === 'ok'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : level === 'degraded'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  const dot = level === 'ok' ? '🟢' : level === 'degraded' ? '🟡' : '🔴';
  const label = level === 'ok' ? 'Système OK' : level === 'degraded' ? 'Dégradé' : 'Incident';
  const c = report.checks;
  const details: string[] = [];
  if (!c.smtpConfigured.ok) details.push(`SMTP non configuré (${c.smtpConfigured.missing?.join(', ')})`);
  if (!c.db.ok) details.push(`DB indispo${c.db.error ? ` (${c.db.error})` : ''}`);
  if (!c.outboxStuck.ok) details.push(`${c.outboxStuck.stuckCount} stuck en 'sending' > 5 min`);
  if (!c.dlq24h.ok) details.push(`${c.dlq24h.count} DLQ sur 24h`);
  if (c.pendingNow > 50) details.push(`${c.pendingNow} pending en attente`);
  return (
    <details className={`rounded-md border px-3 py-1.5 text-xs ${cls}`}>
      <summary className="cursor-pointer font-medium select-none">
        {dot} {label}
      </summary>
      <ul className="mt-2 space-y-1">
        <li>SMTP : {c.smtpConfigured.ok ? '✓ configuré' : '✗ ' + (c.smtpConfigured.missing?.join(', ') ?? '')}</li>
        <li>DB : {c.db.ok ? '✓ ok' : '✗ ' + (c.db.error ?? 'erreur')}</li>
        <li>Outbox stuck : {c.outboxStuck.stuckCount}</li>
        <li>DLQ 24h : {c.dlq24h.count}</li>
        <li>Pending : {c.pendingNow}</li>
        <li>Dernier livré : {c.lastDeliveredAt ? new Date(c.lastDeliveredAt).toLocaleString('fr-FR') : 'jamais'}</li>
      </ul>
      {details.length > 0 ? (
        <p className="mt-2 font-medium">{details.join(' · ')}</p>
      ) : null}
    </details>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
    sending: { label: 'Envoi…', cls: 'bg-amber-50 text-amber-700' },
    sent: { label: 'Envoyé', cls: 'bg-emerald-50 text-emerald-700' },
    delivered: { label: 'Livré', cls: 'bg-emerald-100 text-emerald-800' },
    opened: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
    clicked: { label: 'Cliqué', cls: 'bg-blue-100 text-blue-800' },
    failed: { label: 'Échec', cls: 'bg-rose-50 text-rose-700' },
    bounced_soft: { label: 'Bounce soft', cls: 'bg-amber-50 text-amber-700' },
    bounced_permanent: { label: 'Bounce perm.', cls: 'bg-rose-100 text-rose-800' },
    suppressed: { label: 'Supprimé', cls: 'bg-stone-100 text-stone-700' },
    dlq: { label: 'DLQ', cls: 'bg-rose-200 text-rose-900' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-stone-100 text-stone-700' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`} role="status">
      ⏺ {s.label}
    </span>
  );
}
