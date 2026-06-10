/**
 * /admin/emails/transactional/[id] — Détail outbox + retry + preview iframe.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getOutboxRow, getOutboxTimeline } from '@/lib/admin/emails/queries';
import { StatusBadge } from '@/components/admin/emails/common/StatusBadge';
import { RetryButton } from '@/components/admin/emails/cockpit/RetryButton';
import { formatAbsolute } from '@/components/admin/emails/ui/format-datetime';

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
          <div className="mt-1 flex justify-end">
            <StatusBadge status={row.status} className="text-sm" />
          </div>
          {row.status === 'suppressed' ? (
            <Link
              href={`/admin/emails/suppression?email=${encodeURIComponent(row.toEmail)}`}
              data-testid="suppression-deeplink"
              className="mt-2 inline-block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700"
            >
              Voir / retirer dans la liste de suppression
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Métadonnées */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">Métadonnées</h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <Field label="Date" value={formatAbsolute(new Date(row.createdAt).toISOString())} />
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
            <Field label="Livré à" value={row.deliveredAt ? formatAbsolute(new Date(row.deliveredAt).toISOString()) : '—'} />
          </dl>

          {row.lastError ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Dernière erreur</p>
              <p className="mt-1 font-mono text-xs text-rose-900">{row.lastError}</p>
            </div>
          ) : null}

          {canRetry ? <RetryButton outboxId={row.id} /> : null}
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

      {/* Timeline pédagogique (CKP-F13) */}
      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">Timeline</h2>
          {/* Légende : l'opérateur distingue ce qui vient du MONDE (webhook)
              de ce que l'app a décidé elle-même. */}
          <p data-testid="timeline-legend" className="text-xs text-stone-500">
            <span aria-hidden="true">📡</span> webhook Stalwart · <span aria-hidden="true">⚙</span> app
          </p>
        </div>
        {row.status === 'sent' && !row.deliveredAt ? (
          <div
            data-testid="sent-stagnant-info"
            className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"
          >
            <span aria-hidden="true" className="mr-1">ⓘ</span>
            Cet envoi est resté à « Envoyé » sans confirmation de livraison : soit le
            destinataire est une boîte LOCALE (Stalwart n'émet pas d'event delivered),
            soit le webhook est muet — vérifie les events si le cas se répète.
          </div>
        ) : null}
        {timeline.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun event enregistré.</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((evt) => {
              // UX-COCKPIT-008 : event webhook (stalwart/listmonk) vs système (app).
              const isWebhook = evt.source === 'stalwart' || evt.source === 'listmonk';
              const hasPayload =
                evt.rawJson != null &&
                (typeof evt.rawJson !== 'object' || Object.keys(evt.rawJson).length > 0);
              return (
                <li key={evt.id} className="text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-stone-500 whitespace-nowrap">
                      <time dateTime={new Date(evt.ts).toISOString()}>
                        {formatAbsolute(new Date(evt.ts).toISOString())}
                      </time>
                    </span>
                    <span className="font-medium text-stone-900">{evt.type}</span>
                    <span
                      data-testid={`timeline-source-${evt.id}`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isWebhook ? 'bg-sky-100 text-sky-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <span aria-hidden="true">{isWebhook ? '📡' : '⚙'}</span> via {evt.source}
                    </span>
                  </div>
                  {hasPayload ? (
                    <details className="ml-1 mt-1" data-testid={`timeline-payload-${evt.id}`}>
                      <summary className="cursor-pointer text-xs text-stone-500 hover:text-stone-700">
                        Voir le payload
                      </summary>
                      <pre className="mt-1 overflow-auto rounded bg-stone-50 p-2 text-[11px] text-stone-700">
                        {JSON.stringify(evt.rawJson, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
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

      {/* Retour collant (CKPT-09) — toujours accessible en bas d'une longue page. */}
      <div className="sticky bottom-0 mt-6 -mx-1 border-t border-stone-200 bg-white/95 px-1 py-2 backdrop-blur">
        <Link
          href="/admin/emails/transactional"
          data-testid="sticky-back-link"
          className="text-sm font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
        >
          ← Transactionnel
        </Link>
      </div>
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
