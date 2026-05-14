/**
 * /admin/emails/automation — Liste des automations + runs récents.
 *
 * MVP V1 :
 *  - Table des automations avec toggle active/inactive
 *  - 20 derniers runs (toutes automations confondues)
 *  - Pas d'éditeur visuel des steps (lecture seule via JSON)
 */
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import {
  toggleAutomationActive,
  cancelAutomationRun,
} from '@/lib/admin/emails/automation-actions';

export const dynamic = 'force-dynamic';

async function loadData() {
  const drizzle = getDb();
  if (!drizzle) return { automations: [], runs: [] };
  const [automations, runs] = await Promise.all([
    drizzle.select().from(emailAutomation).orderBy(desc(emailAutomation.createdAt)),
    drizzle.select().from(emailAutomationRun).orderBy(desc(emailAutomationRun.triggeredAt)).limit(20),
  ]);
  return { automations, runs };
}

export default async function AutomationPage() {
  const session = await requireAdmin('/admin/emails/automation');
  const { automations, runs } = await loadData();

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails" className="text-sm text-stone-500 underline">
          ← Dashboard emails
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Automatisations
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Workflows déclenchés par event (cart-abandoned, post-purchase, etc.).
          Les steps sont définis par migration ; cette UI permet de les
          activer/désactiver et de monitorer les runs.
        </p>
      </header>

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
                  <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                    Aucune automation. Seed via migration (cf. docs/emailing/scripts/).
                  </td>
                </tr>
              ) : (
                automations.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/60">
                    <td className="px-3 py-2 font-mono text-xs">{a.slug}</td>
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
                        {a.active ? 'active' : 'désactivée'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={toggleAutomationActive} className="inline">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="next" value={String(!a.active)} />
                        <button
                          type="submit"
                          className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          {a.active ? 'Désactiver' : 'Activer'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
          Runs récents ({runs.length})
        </h2>
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
                    <td className="px-3 py-2 text-stone-700">{r.recipientEmail}</td>
                    <td className="px-3 py-2 text-xs">{r.currentStep}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                        {r.status}
                      </span>
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
                        <form action={cancelAutomationRun} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs text-rose-600 underline"
                          >
                            Annuler
                          </button>
                        </form>
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
