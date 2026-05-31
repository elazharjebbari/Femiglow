import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  listWebhookEndpoints,
  revealWebhookSecret,
} from '@/lib/db/queries/webhook-endpoints';
import { listOutboundLogs } from '@/lib/webhooks/outbound/log-queries';
import { WebhookSecretField } from '@/components/admin/webhooks/WebhookSecretField';

export const dynamic = 'force-dynamic';

export default async function AdminWebhooksPage() {
  const session = await requireAdmin('/admin/webhooks');
  const [endpoints, outboundLogs] = await Promise.all([
    listWebhookEndpoints(),
    listOutboundLogs({ limit: 50 }),
  ]);
  const endpointSecrets = new Map(
    await Promise.all(
      endpoints.map(async (endpoint) => [
        endpoint.id,
        await revealWebhookSecret(endpoint.id).catch(() => ''),
      ] as const),
    ),
  );

  return (
    <AdminShell adminEmail={session.email} active="webhooks">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Webhooks</h1>
          <p className="mt-1 text-sm text-stone-600">
            {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link
          href="/admin/webhooks/new"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nouvel endpoint
        </Link>
      </header>
      {endpoints.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun endpoint configuré.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {endpoints.map((e) => (
            <li key={e.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">{e.url}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {e.events.join(', ')} · {e.active ? 'actif' : 'inactif'}
                  </p>
                </div>
                <Link
                  href={`/admin/webhooks/${e.id}/deliveries`}
                  className="text-sm text-stone-700 underline-offset-2 hover:underline"
                >
                  Livraisons
                </Link>
              </div>
              <WebhookSecretField endpointId={e.id} initialSecret={endpointSecrets.get(e.id) ?? ''} />
            </li>
          ))}
        </ul>
      )}
      <section className="mt-8">
        <header className="mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Outbound plat
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Derniers envois journalisés dans outbound_webhook_log.
          </p>
        </header>
        {outboundLogs.length === 0 ? (
          <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
            Aucun envoi outbound enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Source</Th>
                  <Th>Événement</Th>
                  <Th>Statut</Th>
                  <Th>HTTP</Th>
                  <Th>Tentatives</Th>
                  <Th>Erreur</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {outboundLogs.map((log) => (
                  <tr key={log.id}>
                    <Td>{log.createdAt.toLocaleString('fr-FR')}</Td>
                    <Td>
                      <div className="space-y-1">
                        <p>{log.source}</p>
                        <p className="max-w-44 truncate font-mono text-xs text-stone-500" title={log.sourceId}>
                          {log.sourceId}
                        </p>
                      </div>
                    </Td>
                    <Td>{log.eventName}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${outboundStatusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </Td>
                    <Td>{log.responseStatus ?? '—'}</Td>
                    <Td>{log.attemptCount}</Td>
                    <Td>
                      {log.lastError ? (
                        <span className="block max-w-72 truncate text-xs text-stone-600" title={log.lastError}>
                          {log.lastError}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function outboundStatusClass(status: string): string {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800';
  if (status === 'failed') return 'bg-rose-100 text-rose-800';
  if (status === 'disabled' || status === 'skipped') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-700';
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
