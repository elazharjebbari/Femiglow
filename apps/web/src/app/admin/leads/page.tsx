import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ConversationQuickView } from '@/components/admin/chat/ConversationQuickView';
import { listLeads } from '@/lib/db/queries/leads';
import { leadFiltersSchema } from '@/lib/schemas/admin/lead-filters';

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/leads');
  const parsed = leadFiltersSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : leadFiltersSchema.parse({});
  const { rows, total, page, pageSize } = await listLeads(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell adminEmail={session.email} active="leads">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Leads</h1>
          <p className="mt-1 text-sm text-stone-600">
            {total} prospect{total === 1 ? '' : 's'} au total.
          </p>
        </div>
      </header>
      <form className="mb-6 grid gap-3 sm:grid-cols-3" role="search">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Recherche</span>
          <input
            type="search"
            name="search"
            defaultValue={filters.search ?? ''}
            placeholder="téléphone, prénom, email"
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Statut</span>
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Tous —</option>
            <option value="new">Nouveau</option>
            <option value="contacted">Contacté</option>
            <option value="qualified">Qualifié</option>
            <option value="converted">Converti</option>
            <option value="lost">Perdu</option>
            <option value="archived">Archivé</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600">Tri</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="created_desc">Plus récents d'abord</option>
            <option value="created_asc">Plus anciens d'abord</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 sm:col-span-3 sm:w-fit"
        >
          Appliquer
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun lead ne correspond aux filtres.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <Th>Identité</Th>
                <Th>Contact</Th>
                <Th>Parcours</Th>
                <Th>Webhook</Th>
                <Th>Statut</Th>
                <Th>Créé</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-stone-50">
                  <Td>{l.name ?? '—'}</Td>
                  <Td>{l.email ?? l.phone ?? '—'}</Td>
                  <Td>
                    <div className="space-y-1">
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                        {labelForJourney(l.journeyStage)}
                      </span>
                      {typeof l.dataPct === 'number' ? (
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${l.dataPct}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${webhookBadgeClass(l.webhookSummary)}`}>
                      {labelForWebhook(l.webhookSummary)}
                    </span>
                  </Td>
                  <Td>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {l.status}
                    </span>
                    {l.source?.startsWith('chat:') ? (
                      <span
                        title={l.source}
                        className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700"
                      >
                        chat
                      </span>
                    ) : null}
                  </Td>
                  <Td>{l.createdAt.toLocaleDateString('fr-FR')}</Td>
                  <Td>
                    <div className="inline-flex items-center gap-3">
                      {/* CHA-229 — Pour les leads chat, on offre l'accès
                          direct à la conversation. Les leads ecommerce
                          n'ont pas de session associée → pas de bouton. */}
                      {l.chatSessionId ? (
                        <ConversationQuickView
                          sessionId={l.chatSessionId}
                          triggerLabel="Conversation"
                          subtitle={l.name ?? l.phone ?? null}
                        />
                      ) : null}
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="text-stone-700 underline-offset-2 hover:underline"
                      >
                        Détail
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
        <p className="text-stone-500">
          Page {page} / {pageCount}
        </p>
      </nav>
    </AdminShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-stone-800">{children}</td>;
}

function labelForJourney(stage?: string | null): string {
  switch (stage) {
    case 'lead':
      return 'Lead';
    case 'address':
      return 'Adresse';
    case 'payment':
      return 'Paiement';
    case 'purchased':
      return 'Achat';
    case 'abandoned_step1':
      return 'Abandon step 1';
    default:
      return '—';
  }
}

function labelForWebhook(status?: string | null): string {
  switch (status) {
    case 'step2_sent':
      return 'step2 envoyé';
    case 'step1_abandoned_sent':
      return 'abandon envoyé';
    case 'sent':
      return 'envoyé';
    case 'failed':
      return 'échec';
    case 'disabled':
      return 'désactivé';
    case 'pending':
      return 'pending';
    default:
      return '—';
  }
}

function webhookBadgeClass(status?: string | null): string {
  if (status === 'failed') return 'bg-rose-100 text-rose-800';
  if (status === 'sent' || status === 'step2_sent' || status === 'step1_abandoned_sent') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (status === 'disabled') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-600';
}
