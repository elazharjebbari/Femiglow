import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLeadById, nextValidStatuses } from '@/lib/db/queries/leads';
import { listLeadEvents } from '@/lib/db/queries/lead-events';
import { LeadStatusMenu } from '@/components/admin/LeadStatusMenu';
import { LeadNoteForm } from '@/components/admin/LeadNoteForm';

export const dynamic = 'force-dynamic';

export default async function AdminLeadDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/leads/${params.id}`);
  const data = await getLeadById(params.id);
  if (!data) notFound();
  const events = await listLeadEvents(params.id);
  const transitions = nextValidStatuses(data.lead.status);

  return (
    <AdminShell adminEmail={session.email} active="leads">
      <nav aria-label="Fil d'Ariane" className="mb-4 text-xs text-stone-500">
        <a href="/admin/leads" className="underline-offset-2 hover:underline">
          Leads
        </a>{' '}
        / <span className="text-stone-700">{data.lead.email ?? data.lead.phone ?? data.lead.id}</span>
      </nav>
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {data.lead.name ?? data.lead.email ?? data.lead.phone ?? '—'}
          </h1>
          {data.lead.email ? (
            <p className="mt-1 text-sm text-stone-600">{data.lead.email}</p>
          ) : null}
          {data.lead.phone ? (
            <p className="text-sm text-stone-600">{data.lead.phone}</p>
          ) : null}
          {data.lead.source ? (
            <p className="mt-1 text-xs text-stone-500">
              Source : <span className="font-mono">{data.lead.source}</span>
            </p>
          ) : null}
        </div>
        {/* Pour une row chat_lead (chat ou wizard), le statut est dérivé
            de chat_lead.outcome ; on désactive le menu de transition
            jusqu'à la mise en place de la passerelle d'écriture admin. */}
        {data.lead.id.startsWith('cl_') ? (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            statut : {data.lead.status} ({labelForSource(data.lead.source)})
          </span>
        ) : (
          <LeadStatusMenu
            leadId={data.lead.id}
            current={data.lead.status}
            options={transitions}
          />
        )}
      </header>
      <section aria-label="Parcours lead" className="mb-8 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">Parcours</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Étape</p>
            <p className="mt-1 font-medium text-stone-900">{labelForJourney(data.lead.journeyStage)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Données</p>
            <p className="mt-1 font-medium text-stone-900">
              {typeof data.lead.dataPct === 'number' ? `${data.lead.dataPct}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Webhook</p>
            <p className="mt-1 font-medium text-stone-900">{labelForWebhook(data.lead.webhookSummary)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Ville</p>
            <p className="mt-1 font-medium text-stone-900">{data.lead.city ?? '—'}</p>
          </div>
        </div>
        {data.lead.addressLine1 || data.lead.addressLine2 ? (
          <div className="mt-4 border-t border-stone-100 pt-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-stone-500">Adresse</p>
            <p className="mt-1 text-stone-800">
              {[data.lead.addressLine1, data.lead.addressLine2, data.lead.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        ) : null}
      </section>
      <section aria-label="Commande" className="mb-8 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">Commande</h2>
        {data.order ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-stone-700">
              Total :{' '}
              <span className="font-medium tabular-nums">
                {(data.order.totalCents / 100).toFixed(2)} {data.order.currency}
              </span>
            </p>
            <ul className="divide-y divide-stone-100">
              {data.items.map((it) => (
                <li key={it.id} className="flex justify-between py-2">
                  <span>
                    {it.name} ×{it.quantity}
                  </span>
                  <span className="tabular-nums text-stone-600">
                    {((it.unitPriceCents * it.quantity) / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">Aucune commande liée.</p>
        )}
      </section>
      <section aria-label="Historique" className="mb-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">Historique</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Aucun événement enregistré.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-stone-800">{labelForEventType(ev.type)}</span>
                  <time className="text-xs text-stone-500" dateTime={ev.createdAt.toISOString()}>
                    {ev.createdAt.toLocaleString('fr-FR')}
                  </time>
                </div>
                {ev.payload && Object.keys(ev.payload).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-stone-50 px-3 py-2 text-xs text-stone-700">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-label="Ajouter une note">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Ajouter une note
        </h2>
        <LeadNoteForm leadId={data.lead.id} />
      </section>
    </AdminShell>
  );
}

function labelForSource(source?: string | null): string {
  if (!source) return 'source inconnue';
  if (source.startsWith('chat:')) return 'chat';
  if (source.startsWith('wizard')) return 'wizard checkout';
  return source;
}

function labelForJourney(stage?: string | null): string {
  switch (stage) {
    case 'lead':
      return 'Lead capturé';
    case 'address':
      return 'Adresse complétée';
    case 'payment':
      return 'Paiement sélectionné';
    case 'purchased':
      return 'Achat finalisé';
    case 'abandoned_step1':
      return 'Abandon step 1 envoyé';
    default:
      return '—';
  }
}

function labelForWebhook(status?: string | null): string {
  switch (status) {
    case 'step2_sent':
      return 'lead.step2_completed envoyé';
    case 'step1_abandoned_sent':
      return 'lead.step1_abandoned envoyé';
    case 'sent':
      return 'chat_lead.created envoyé';
    case 'failed':
      return 'Échec webhook';
    case 'disabled':
      return 'Webhook désactivé';
    case 'skipped':
      return 'Webhook ignoré';
    case 'pending':
      return 'En attente';
    default:
      return '—';
  }
}

function labelForEventType(type: string): string {
  switch (type) {
    case 'created':
      return 'Lead créé';
    case 'status_changed':
      return 'Statut modifié';
    case 'note_added':
      return 'Note ajoutée';
    case 'order_linked':
      return 'Commande liée';
    case 'webhook_dispatched':
      return 'Webhook envoyé';
    default:
      return type;
  }
}
