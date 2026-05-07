import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import { listDeliveries } from '@/lib/db/queries/webhook-deliveries';

export const dynamic = 'force-dynamic';

export default async function AdminWebhookDeliveriesPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/webhooks/${params.id}/deliveries`);
  const endpoint = await getWebhookEndpoint(params.id);
  if (!endpoint) notFound();
  const { rows, total } = await listDeliveries({ endpointId: params.id, pageSize: 50 });

  const succeeded = rows.filter((d) => d.status === 'succeeded').length;
  const pending = rows.filter((d) => d.status === 'pending').length;
  const failed = rows.filter((d) => d.status === 'permanent' || d.status === 'failed').length;

  return (
    <AdminShell adminEmail={session.email} active="webhooks">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Livraisons</h1>
        <p className="mt-1 truncate text-sm text-stone-600">{endpoint.url}</p>
      </header>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total" value={total} />
        <Stat label="Réussies" value={succeeded} />
        <Stat label="En attente / échec" value={pending + failed} />
      </section>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucune livraison enregistrée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <Th>Date</Th>
                <Th>Événement</Th>
                <Th>Statut</Th>
                <Th>HTTP</Th>
                <Th>Tentatives</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((d) => (
                <tr key={d.id}>
                  <Td>{d.createdAt.toLocaleString('fr-FR')}</Td>
                  <Td>{d.event}</Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        d.status === 'succeeded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'permanent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {d.status}
                    </span>
                  </Td>
                  <Td>{d.responseStatus ?? '—'}</Td>
                  <Td>{d.attemptCount}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
    </div>
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
