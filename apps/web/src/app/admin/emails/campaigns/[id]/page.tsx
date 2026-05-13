/**
 * /admin/emails/campaigns/[id] — Détail d'une campagne (envoyée/planifiée).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getCampaignDraft } from '@/lib/admin/emails/campaigns-queries';
import { discardCampaign } from '@/lib/admin/emails/wizard-actions';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/campaigns/${params.id}`);
  const c = await getCampaignDraft(params.id);
  if (!c) notFound();

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/admin/emails/campaigns" className="text-sm text-stone-500 underline">
            ← Campagnes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            {c.name}
          </h1>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-700">
          {c.status}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
            Métadonnées
          </h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <Field label="Sujet" value={c.subject || '—'} />
            <Field label="Preheader" value={c.preheader ?? '—'} />
            <Field label="Listmonk campaign ID" value={c.listmonkCampaignId ? `#${c.listmonkCampaignId}` : '—'} />
            <Field label="Listes" value={Array.isArray(c.audienceLinkIds) ? `${c.audienceLinkIds.length}` : '—'} />
            <Field
              label="Planifié pour"
              value={c.scheduledFor ? new Date(c.scheduledFor).toLocaleString('fr-FR') : 'envoi immédiat'}
            />
            <Field
              label="Démarrée"
              value={c.startedAt ? new Date(c.startedAt).toLocaleString('fr-FR') : '—'}
            />
            <Field label="Créée le" value={new Date(c.createdAt).toLocaleString('fr-FR')} />
            <Field label="Créée par" value={c.createdByUserId ?? '—'} />
          </dl>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
            Métriques
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Envoyés" value={c.sentCount} />
            <Metric label="Livrés" value={c.deliveredCount} />
            <Metric label="Ouvertures" value={c.openCount} />
            <Metric label="Clics" value={c.clickCount} />
            <Metric label="Bounces" value={c.bounceCount} />
            <Metric label="Désabos" value={c.unsubscribeCount} />
          </dl>
          <p className="mt-3 text-xs text-stone-500">
            Métriques mises à jour par le webhook Listmonk (M3.5 — wiring à venir).
          </p>
        </section>
      </div>

      {c.status === 'draft' ? (
        <form action={discardCampaign} className="mt-6">
          <input type="hidden" name="id" value={c.id} />
          <button
            type="submit"
            className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Supprimer ce brouillon
          </button>
        </form>
      ) : null}
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="col-span-2 text-stone-800">{value}</dd>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
    </div>
  );
}
