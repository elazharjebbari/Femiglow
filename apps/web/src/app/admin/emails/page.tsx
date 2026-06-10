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
import { checkEmailingHealth, type HealthLevel } from '@/lib/admin/emails/health';
import { db as getDb } from '@/lib/db/client';
import {
  checkEmailingInfraHealth,
  type InfraChecks,
} from '@/app/api/admin/emails/health/checks';
import { HealthBadge } from '@/components/admin/emails/HealthBadge';
import { KpiCards, StatusBadge } from '@/components/admin/emails/KpiCards';
import { DashboardFreshness } from '@/components/admin/emails/DashboardFreshness';

export const dynamic = 'force-dynamic';

/** Pire des deux niveaux (cohérent avec la route /api/admin/emails/health). */
function worstLevel(a: HealthLevel, b: HealthLevel): HealthLevel {
  if (a === 'incident' || b === 'incident') return 'incident';
  if (a === 'degraded' || b === 'degraded') return 'degraded';
  return 'ok';
}

export default async function AdminEmailsPage() {
  const session = await requireAdmin('/admin/emails');
  const [kpi, recent, health] = await Promise.all([
    getOutboxKpi(),
    listRecentOutbox({ limit: 8 }),
    checkEmailingHealth(),
  ]);

  // Checks infra additionnels (webhook silencieux, cron outbox en retard,
  // sending bloqué) — même composition que la route /api/admin/emails/health.
  // Branchés ici pour que le BADGE du dashboard reflète aussi ces pannes P0.
  let infraChecks: InfraChecks | null = null;
  let level = health.level;
  const drizzle = getDb();
  if (drizzle && health.checks.db.ok) {
    try {
      const infra = await checkEmailingInfraHealth(drizzle);
      infraChecks = infra.checks;
      level = worstLevel(level, infra.level);
    } catch {
      level = worstLevel(level, 'degraded');
    }
  }

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Emails</h1>
          <p className="mt-1 text-sm text-stone-600">
            Transactionnels envoyés via Stalwart. KPIs 7 derniers jours.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <HealthBadge level={level} report={health} infra={infraChecks} />
          <DashboardFreshness generatedAt={health.timestamp} />
        </div>
      </header>

      <KpiCards kpi={kpi} />

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
        <Link
          href="/admin/emails/suppression"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Liste de suppression →
        </Link>
        <Link
          href="/admin/emails/events"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Events (debug) →
        </Link>
      </nav>
      <p className="mb-6 text-xs text-stone-600">
        Astuce :{' '}
        <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
          ⌘ K
        </kbd>{' '}
        /{' '}
        <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
          Ctrl K
        </kbd>{' '}
        pour naviguer entre sections sans souris.
      </p>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
            Derniers envois
          </h2>
          <Link
            href="/admin/emails/transactional"
            className="text-sm font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
          >
            Voir tous les envois →
          </Link>
        </div>
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
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                    <p>Aucun envoi sur la période.</p>
                    <Link
                      href="/admin/emails/transactional"
                      className="mt-2 inline-block text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
                    >
                      Ouvrir le cockpit transactionnel →
                    </Link>
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
