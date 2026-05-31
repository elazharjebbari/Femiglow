import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import { listDeliveries } from '@/lib/db/queries/webhook-deliveries';
import { CopyButton } from '@/components/admin/products/CopyButton';
import { RetryDeliveryButton } from '@/components/admin/webhooks/RetryDeliveryButton';
import type { WebhookDelivery } from '@/lib/db/types';

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
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((d) => (
                <Fragment key={d.id}>
                  <tr>
                    <Td>
                      <div className="space-y-1">
                        <p>{d.createdAt.toLocaleString('fr-FR')}</p>
                        <p className="max-w-44 truncate font-mono text-xs text-stone-500" title={d.id}>
                          {d.id}
                        </p>
                      </div>
                    </Td>
                    <Td>{d.event}</Td>
                    <Td>
                      <StatusBadge status={d.status} />
                    </Td>
                    <Td>{d.responseStatus ?? '—'}</Td>
                    <Td>{d.attemptCount}</Td>
                    <Td>
                      <RetryDeliveryButton deliveryId={d.id} disabled={d.status === 'in_progress'} />
                    </Td>
                  </tr>
                  {shouldShowDiagnostics(d) ? (
                    <tr className="bg-stone-50/70">
                      <td colSpan={6} className="px-4 py-3">
                        <DeliveryDiagnostics delivery={d} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'succeeded'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'permanent' || status === 'failed'
        ? 'bg-red-100 text-red-800'
        : status === 'pending'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-stone-100 text-stone-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function shouldShowDiagnostics(delivery: WebhookDelivery): boolean {
  return (
    delivery.status !== 'succeeded' ||
    Boolean(delivery.responseStatus && (delivery.responseStatus < 200 || delivery.responseStatus >= 300)) ||
    Boolean(delivery.errorCode) ||
    Boolean(delivery.responseBody)
  );
}

function DeliveryDiagnostics({ delivery }: { delivery: WebhookDelivery }) {
  const problem = formatDeliveryProblem(delivery);
  const payloadJson = JSON.stringify(delivery.payload, null, 2);
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Diagnostic de livraison
          </p>
          <p className="mt-1 text-sm font-medium text-stone-900">{problem.title}</p>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">{problem.description}</p>
        </div>
        <CopyButton text={payloadJson} label="Copier payload" />
      </div>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
        <DiagnosticItem label="HTTP" value={delivery.responseStatus?.toString() ?? '—'} />
        <DiagnosticItem label="Erreur" value={delivery.errorCode ?? '—'} />
        <DiagnosticItem label="Prochaine tentative" value={formatDate(delivery.nextAttemptAt)} />
        <DiagnosticItem label="Idempotence" value={delivery.idempotencyKey} mono />
      </dl>
      {delivery.responseBody ? (
        <pre className="mt-3 max-h-44 overflow-auto rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-900">
          {delivery.responseBody}
        </pre>
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-stone-700 underline-offset-2 hover:underline">
          Voir le payload envoyé
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-stone-200 bg-stone-950 px-3 py-2 text-xs leading-relaxed text-stone-50">
          {payloadJson}
        </pre>
      </details>
    </div>
  );
}

function DiagnosticItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd
        className={`mt-1 truncate text-stone-800 ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString('fr-FR') : '—';
}

function formatDeliveryProblem(delivery: WebhookDelivery): {
  title: string;
  description: string;
} {
  if (delivery.responseStatus === 401 || delivery.responseStatus === 403) {
    return {
      title: `Authentification refusée par le receveur (${delivery.responseStatus})`,
      description:
        'Le POST est parti, mais la cible a rejeté la signature ou le secret. FemiGlow envoie le payload plat signé dans X-Webhook-Signature ; vérifier que le secret enregistré correspond au secret Baiti.',
    };
  }
  if (delivery.responseStatus && delivery.responseStatus >= 500) {
    return {
      title: `Erreur serveur côté receveur (${delivery.responseStatus})`,
      description:
        'La cible a reçu la requête mais a répondu en erreur. La livraison peut être relancée après correction côté receveur.',
    };
  }
  if (delivery.errorCode === 'timeout') {
    return {
      title: 'Timeout pendant l’appel webhook',
      description:
        'La cible n’a pas répondu dans le délai attendu. Vérifier sa disponibilité avant de relancer.',
    };
  }
  if (delivery.errorCode === 'network_error') {
    return {
      title: 'Erreur réseau pendant l’appel webhook',
      description:
        'La requête n’a pas pu aboutir. Vérifier DNS, TLS, firewall ou disponibilité de la cible.',
    };
  }
  return {
    title: 'Livraison à surveiller',
    description:
      'La livraison n’est pas encore confirmée en succès. Les détails ci-dessous permettent de diagnostiquer puis de relancer manuellement.',
  };
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
