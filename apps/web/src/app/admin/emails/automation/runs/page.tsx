/**
 * /admin/emails/automation/runs — Index filtrable des runs d'automation.
 *
 * UX-AUT-007 : filtres pilotés par searchParams (status, automationId, email) +
 * pagination, lien drill-down depuis l'éditeur (?automationId=…), bouton
 * Relancer sur les runs en erreur. Compteur de runs en erreur mis en avant.
 *
 * Tout l'état vit dans l'URL → partageable / bookmarkable.
 */
import Link from 'next/link';
import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { StatusPill, runStatusLabel } from './run-status';
import { CancelRunButton, RetryRunButton } from '../AutomationRowActions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  'running',
  'waiting_for_event',
  'completed',
  'cancelled',
  'errored',
] as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

async function loadData(params: {
  status: string;
  automationId: string;
  email: string;
  page: number;
}) {
  const drizzle = getDb();
  if (!drizzle) {
    return { runs: [], total: 0, automationName: null as string | null, automations: [] };
  }

  const conds: SQL[] = [];
  if (params.status && (STATUS_OPTIONS as readonly string[]).includes(params.status)) {
    conds.push(eq(emailAutomationRun.status, params.status as (typeof STATUS_OPTIONS)[number]));
  }
  if (params.automationId) {
    conds.push(eq(emailAutomationRun.automationId, params.automationId));
  }
  if (params.email) {
    conds.push(ilike(emailAutomationRun.recipientEmail, `%${params.email}%`));
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [runs, totalRows, automations] = await Promise.all([
    drizzle
      .select()
      .from(emailAutomationRun)
      .where(where)
      .orderBy(desc(emailAutomationRun.triggeredAt))
      .limit(PAGE_SIZE)
      .offset(params.page * PAGE_SIZE),
    drizzle
      .select({ n: sql<number>`count(*)::int` })
      .from(emailAutomationRun)
      .where(where),
    drizzle
      .select({ id: emailAutomation.id, name: emailAutomation.name, slug: emailAutomation.slug })
      .from(emailAutomation)
      .orderBy(desc(emailAutomation.createdAt)),
  ]);

  const automationName = params.automationId
    ? automations.find((a) => a.id === params.automationId)?.name ?? null
    : null;

  return { runs, total: totalRows[0]?.n ?? 0, automationName, automations };
}

function buildHref(base: Record<string, string>, patch: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/admin/emails/automation/runs?${qs}` : '/admin/emails/automation/runs';
}

export default async function AutomationRunsPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const session = await requireAdmin('/admin/emails/automation/runs');
  const status = one(searchParams.status);
  const automationId = one(searchParams.automationId);
  const email = one(searchParams.email);
  const page = Math.max(0, Number.parseInt(one(searchParams.page) || '0', 10) || 0);

  const { runs, total, automationName, automations } = await loadData({
    status,
    automationId,
    email,
    page,
  });

  const baseParams = { status, automationId, email };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails/automation" className="text-sm text-stone-500 underline">
          ← Automations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Runs d&apos;automation
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {automationName ? (
            <>
              Filtré sur l&apos;automation <strong>{automationName}</strong>.{' '}
              <Link href={buildHref(baseParams, { automationId: '', page: '' })} className="underline">
                Retirer le filtre
              </Link>
            </>
          ) : (
            <>{total} run{total > 1 ? 's' : ''} au total.</>
          )}
        </p>
      </header>

      {/* Filtres (form GET → searchParams, partageables) */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4"
        aria-label="Filtres des runs"
      >
        <div>
          <label htmlFor="filter-status" className="block text-xs font-medium text-stone-600">
            Statut
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status}
            className="mt-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {runStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-automation" className="block text-xs font-medium text-stone-600">
            Automation
          </label>
          <select
            id="filter-automation"
            name="automationId"
            defaultValue={automationId}
            className="mt-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            <option value="">Toutes</option>
            {automations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-email" className="block text-xs font-medium text-stone-600">
            Destinataire
          </label>
          <input
            id="filter-email"
            name="email"
            type="text"
            defaultValue={email}
            placeholder="client@exemple.test"
            className="mt-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-900"
        >
          Filtrer
        </button>
        {(status || automationId || email) && (
          <Link
            href="/admin/emails/automation/runs"
            className="text-sm text-stone-500 underline"
          >
            Réinitialiser
          </Link>
        )}
      </form>

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
                  Aucun run ne correspond à ces filtres.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/60">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-600">
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

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-stone-500">
            Page {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 0 && (
              <Link
                href={buildHref(baseParams, { page: String(page - 1) })}
                className="rounded border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
              >
                ← Précédent
              </Link>
            )}
            {page + 1 < totalPages && (
              <Link
                href={buildHref(baseParams, { page: String(page + 1) })}
                className="rounded border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
              >
                Suivant →
              </Link>
            )}
          </div>
        </nav>
      )}
    </AdminShell>
  );
}
