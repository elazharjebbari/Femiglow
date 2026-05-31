/**
 * /admin/emails/transactional/[id] — Détail outbox + retry + preview iframe.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getOutboxRow, getOutboxTimeline } from '@/lib/admin/emails/queries';
import { retryOutboxAction } from '@/lib/admin/emails/actions';

export const dynamic = 'force-dynamic';

export default async function OutboxDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/emails/transactional/${params.id}`);
  const row = await getOutboxRow(params.id);
  if (!row) notFound();
  const timeline = await getOutboxTimeline(params.id);

  const canRetry = ['failed', 'dlq', 'bounced_soft'].includes(row.status);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/admin/emails/transactional" className="text-sm text-stone-500 underline">
            ← Transactionnel
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            Envoi <span className="font-mono text-base">{row.id.slice(0, 8)}…</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-stone-500">Statut</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{row.status}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Métadonnées */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">Métadonnées</h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <Field label="Date" value={new Date(row.createdAt).toLocaleString('fr-FR')} />
            <Field label="Template" value={<code className="text-xs">{row.template} v{row.templateVersion}</code>} />
            <Field label="Destinataire" value={row.toName ? `${row.toName} <${row.toEmail}>` : row.toEmail} />
            <Field label="From" value={row.fromEmail} />
            <Field label="Reply-To" value={row.replyTo ?? '—'} />
            <Field label="Sujet" value={row.subject} />
            <Field label="Idempotency" value={<code className="text-xs">{row.idempotencyKey}</code>} />
            <Field label="Tentatives" value={`${row.attempts} / ${row.maxAttempts}`} />
            <Field label="Source" value={<code className="text-xs">{row.source ?? '—'}</code>} />
            <Field label="SMTP Message-ID" value={<code className="text-xs">{row.smtpMessageId ?? '—'}</code>} />
            <Field label="SMTP Response" value={row.smtpResponse ?? '—'} />
            <Field label="Livré à" value={row.deliveredAt ? new Date(row.deliveredAt).toLocaleString('fr-FR') : '—'} />
          </dl>

          {row.lastError ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Dernière erreur</p>
              <p className="mt-1 font-mono text-xs text-rose-900">{row.lastError}</p>
            </div>
          ) : null}

          {canRetry ? (
            <form action={retryOutboxAction} className="mt-4">
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                ↻ Renvoyer
              </button>
            </form>
          ) : null}
        </section>

        {/* Preview HTML */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">Aperçu HTML</h2>
          {row.htmlSnapshot ? (
            <iframe
              title="Aperçu email"
              srcDoc={row.htmlSnapshot}
              sandbox=""
              className="h-[600px] w-full rounded border border-stone-200 bg-white"
            />
          ) : (
            <p className="text-sm text-stone-500">Aucun snapshot HTML disponible.</p>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun event enregistré.</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((evt) => (
              <li key={evt.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-stone-500 whitespace-nowrap">
                  {new Date(evt.ts).toLocaleString('fr-FR', { hour12: false })}
                </span>
                <span className="font-medium text-stone-900">{evt.type}</span>
                <span className="text-xs text-stone-500">via {evt.source}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Payload JSON */}
      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">Variables (payload)</h2>
        <pre className="overflow-auto rounded bg-stone-50 p-3 text-xs">
          {JSON.stringify(row.payloadJson, null, 2)}
        </pre>
      </section>
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="col-span-2 text-stone-800">{value}</dd>
    </>
  );
}
