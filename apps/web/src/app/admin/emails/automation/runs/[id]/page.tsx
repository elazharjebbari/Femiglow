/**
 * /admin/emails/automation/runs/[id] — Run detail (state + outbox links).
 */
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import {
  emailAutomation,
  emailAutomationRun,
  emailOutbox,
} from '@/lib/db/schema-emails';
import { inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function load(id: string) {
  const drizzle = getDb();
  if (!drizzle) return null;
  const [run] = await drizzle
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  if (!run) return null;
  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, run.automationId))
    .limit(1);
  const outboxIds = Array.isArray(run.outboxIds) ? (run.outboxIds as string[]) : [];
  const outboxes =
    outboxIds.length > 0
      ? await drizzle.select().from(emailOutbox).where(inArray(emailOutbox.id, outboxIds))
      : [];
  return { run, auto, outboxes };
}

export default async function AutomationRunPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/automation/runs/${params.id}`);
  const data = await load(params.id);
  if (!data) notFound();
  const { run, auto, outboxes } = data;

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails/automation" className="text-sm text-stone-500 underline">
          ← Automations
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-stone-800">
          Run {run.id.slice(0, 12)}…
        </h1>
        <p className="text-sm text-stone-500">
          Automation : {auto ? <Link href={`/admin/emails/automation/${auto.id}/edit`} className="underline">{auto.name}</Link> : '—'}
        </p>
      </header>

      <section className="space-y-3 rounded border border-stone-200 bg-white p-5">
        <dl className="space-y-2 text-sm">
          <Row label="Status" value={<StatusPill status={run.status} />} />
          <Row label="Destinataire" value={<code className="font-mono text-xs">{run.recipientEmail}</code>} />
          <Row label="Déclenché" value={new Date(run.triggeredAt).toISOString()} />
          <Row label="Étape courante" value={String(run.currentStep)} />
          {run.nextActionAt && (
            <Row label="Prochaine action" value={new Date(run.nextActionAt).toISOString()} />
          )}
          {run.awaitingEventName && (
            <Row label="En attente" value={`${run.awaitingEventName} (until ${run.awaitingUntil?.toISOString()})`} />
          )}
          {run.finishedAt && (
            <Row label="Terminé" value={new Date(run.finishedAt).toISOString()} />
          )}
          {run.erroredReason && (
            <Row
              label="Erreur"
              value={<span className="text-red-700">{run.erroredReason}</span>}
            />
          )}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-stone-700">Emails envoyés ({outboxes.length})</h2>
        {outboxes.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun email envoyé pour ce run.</p>
        ) : (
          <ul className="space-y-2">
            {outboxes.map((o) => (
              <li key={o.id} className="rounded border border-stone-200 bg-white p-3">
                <Link
                  href={`/admin/emails/outbox/${o.id}`}
                  className="font-mono text-xs text-stone-700 hover:underline"
                >
                  {o.id}
                </Link>
                <span className="ml-3 text-xs text-stone-500">{o.status}</span>
                <span className="ml-3 text-xs text-stone-500">→ {o.toEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded border border-stone-200 bg-stone-50 p-5">
        <h2 className="mb-2 text-sm font-medium text-stone-700">Contexte JSON</h2>
        <pre className="overflow-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
          {JSON.stringify(run.contextJson, null, 2)}
        </pre>
      </section>
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-stone-500">{label}</dt>
      <dd className="text-stone-800">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-stone-100 text-stone-600',
    errored: 'bg-red-100 text-red-800',
    waiting_for_event: 'bg-sky-100 text-sky-800',
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        colors[status] ?? 'bg-stone-100 text-stone-600'
      }`}
    >
      {status}
    </span>
  );
}
