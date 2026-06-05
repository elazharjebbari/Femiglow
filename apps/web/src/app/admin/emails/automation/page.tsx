/**
 * /admin/emails/automation — Liste des automations + runs récents.
 *
 * MVP V1 :
 *  - Table des automations avec toggle active/inactive
 *  - 20 derniers runs (toutes automations confondues)
 *  - Pas d'éditeur visuel des steps (lecture seule via JSON)
 */
import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { StatusPill } from './runs/run-status';
import {
  ToggleAutomationButton,
  CancelRunButton,
  RetryRunButton,
} from './AutomationRowActions';

export const dynamic = 'force-dynamic';

async function loadData() {
  const drizzle = getDb();
  if (!drizzle) return { automations: [], runs: [], erroredCount: 0 };
  const [automations, runs, erroredRows] = await Promise.all([
    drizzle.select().from(emailAutomation).orderBy(desc(emailAutomation.createdAt)),
    drizzle.select().from(emailAutomationRun).orderBy(desc(emailAutomationRun.triggeredAt)).limit(20),
    drizzle
      .select({ n: sql<number>`count(*)::int` })
      .from(emailAutomationRun)
      .where(eq(emailAutomationRun.status, 'errored')),
  ]);
  return { automations, runs, erroredCount: erroredRows[0]?.n ?? 0 };
}

export default async function AutomationPage() {
  const session = await requireAdmin('/admin/emails/automation');
  const { automations, runs, erroredCount } = await loadData();

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/emails" className="text-sm text-stone-500 underline">
            ← Dashboard emails
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Automatisations
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Workflows déclenchés par events utilisateur (lead.created, cart.abandoned,
            order.placed, …). Le wizard permet d'éditer les steps, les conditions et
            les contrôles de fréquence.
          </p>
        </div>
        <Link
          href="/admin/emails/automation/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          + Nouvelle automation
        </Link>
      </header>

      {erroredCount > 0 && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span>
            {erroredCount} run{erroredCount > 1 ? 's' : ''} en erreur. Filtrez-les pour les relancer.
          </span>
          <Link
            href="/admin/emails/automation/runs?status=errored"
            className="font-medium underline"
          >
            Voir les runs en erreur →
          </Link>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
          Automations ({automations.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Slug</th>
                <th className="px-3 py-2 text-left font-medium">Nom</th>
                <th className="px-3 py-2 text-left font-medium">Trigger</th>
                <th className="px-3 py-2 text-left font-medium">Steps</th>
                <th className="px-3 py-2 text-left font-medium">État</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {automations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center">
                    <p className="text-sm text-stone-600">
                      Aucune automation. Créez votre premier workflow.
                    </p>
                    <Link
                      href="/admin/emails/automation/new"
                      className="mt-3 inline-block rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
                    >
                      + Créer une automation
                    </Link>
                  </td>
                </tr>
              ) : (
                automations.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/60">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/admin/emails/automation/${a.id}/edit`}
                        className="hover:underline"
                      >
                        {a.slug}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium text-stone-900">{a.name}</td>
                    <td className="px-3 py-2 text-xs">{a.triggerType}</td>
                    <td className="px-3 py-2 text-xs text-stone-600">
                      {Array.isArray(a.steps) ? `${a.steps.length} steps` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {a.active ? 'Active' : 'Désactivée'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/emails/automation/runs?automationId=${a.id}`}
                          className="text-xs text-stone-600 underline"
                        >
                          Runs
                        </Link>
                        <Link
                          href={`/admin/emails/automation/${a.id}/edit`}
                          className="text-xs text-stone-600 underline"
                        >
                          Éditer
                        </Link>
                        <ToggleAutomationButton id={a.id} active={a.active} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
            Runs récents ({runs.length})
          </h2>
          <Link
            href="/admin/emails/automation/runs"
            className="text-xs text-stone-600 underline"
          >
            Tous les runs (filtres) →
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Déclenché</th>
                <th className="px-3 py-2 text-left font-medium">Destinataire</th>
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-3 py-2 text-left font-medium">Statut</th>
                <th className="px-3 py-2 text-left font-medium">Prochaine action</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                    Aucun run récent.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60">
                    <td className="px-3 py-2 text-xs text-stone-600 whitespace-nowrap">
                      {new Date(r.triggeredAt).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-3 py-2 text-stone-700">
                      <Link
                        href={`/admin/emails/automation/runs/${r.id}`}
                        className="hover:underline"
                      >
                        {r.recipientEmail}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.currentStep}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-500">
                      {r.nextActionAt
                        ? new Date(r.nextActionAt).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status === 'running' ? (
                        <CancelRunButton id={r.id} />
                      ) : r.status === 'errored' ? (
                        <RetryRunButton id={r.id} />
                      ) : null}
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
