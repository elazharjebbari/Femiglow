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
        / <span className="text-stone-700">{data.lead.email}</span>
      </nav>
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {data.lead.name ?? data.lead.email}
          </h1>
          <p className="mt-1 text-sm text-stone-600">{data.lead.email}</p>
          {data.lead.phone ? (
            <p className="text-sm text-stone-600">{data.lead.phone}</p>
          ) : null}
        </div>
        <LeadStatusMenu
          leadId={data.lead.id}
          current={data.lead.status}
          options={transitions}
        />
      </header>
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
