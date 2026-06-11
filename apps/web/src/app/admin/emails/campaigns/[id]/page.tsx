/**
 * /admin/emails/campaigns/[id] — Détail d'une campagne (envoyée/planifiée).
 *
 * UX-CAMP-002 — actions pause/reprise/annulation selon le statut.
 * UX-CAMP-003 — duplication depuis le header.
 * UX-CAMP-005 — deep-links audience / Listmonk / snapshot.
 * UX-CAMP-006 — bouton « Rafraîchir », libellé corrigé, Livrés/Désabos « n/d ».
 * UX-CAMP-015 — suppression de brouillon confirmée.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getCampaignDraft, getAudienceLabel } from '@/lib/admin/emails/campaigns-queries';
import { duplicateCampaign } from '@/lib/admin/emails/wizard-actions';
import {
  isLegalTransition,
  type FemiGlowCampaignStatus,
} from '@/lib/mail/campaigns/listmonk-status-sync';
import { env } from '@/lib/env';
import { CampaignActions } from './CampaignActions';
import { CampaignStatusBadge } from '../CampaignsListClient';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/campaigns/${params.id}`);
  const c = await getCampaignDraft(params.id);
  if (!c) notFound();

  const status = c.status as FemiGlowCampaignStatus;
  const caps = {
    // Pause/reprise/annulation : on n'affiche que les transitions LÉGALES, et
    // jamais le no-op idempotent (pause d'une campagne déjà en pause).
    canPause: status !== 'paused' && isLegalTransition(status, 'paused'),
    canResume: status === 'paused' && isLegalTransition(status, 'sending'),
    canCancel: status !== 'cancelled' && status !== 'draft' && isLegalTransition(status, 'cancelled'),
    canDiscard: status === 'draft',
  };

  const audience = await getAudienceLabel((c.audienceId as string | null) ?? null);
  const listmonkAdminUrl =
    c.listmonkCampaignId != null && env.LISTMONK_PUBLIC_URL
      ? `${env.LISTMONK_PUBLIC_URL.replace(/\/$/, '')}/admin/campaigns/${c.listmonkCampaignId}`
      : null;

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
        <div className="flex items-center gap-3">
          <form action={duplicateCampaign}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              aria-label={`Dupliquer la campagne ${c.name}`}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              ⧉ Dupliquer
            </button>
          </form>
          <CampaignStatusBadge status={c.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-600">
            Métadonnées
          </h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <Field label="Sujet" value={c.subject || '—'} />
            <Field label="Preheader" value={c.preheader ?? '—'} />
            <FieldNode label="Campagne Listmonk">
              {c.listmonkCampaignId != null ? (
                listmonkAdminUrl ? (
                  <a
                    href={listmonkAdminUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-800 underline"
                  >
                    #{c.listmonkCampaignId} ↗
                  </a>
                ) : (
                  <span className="text-stone-800">#{c.listmonkCampaignId}</span>
                )
              ) : (
                <span className="text-stone-500">—</span>
              )}
            </FieldNode>
            <FieldNode label="Audience">
              {audience ? (
                <Link
                  href={`/admin/emails/audiences/${audience.id}`}
                  className="text-stone-800 underline"
                >
                  🎯 {audience.name}
                </Link>
              ) : Array.isArray(c.audienceLinkIds) ? (
                <span className="text-stone-800">
                  {c.audienceLinkIds.length} liste{c.audienceLinkIds.length > 1 ? 's' : ''} Listmonk
                </span>
              ) : (
                <span className="text-stone-500">—</span>
              )}
            </FieldNode>
            <FieldNode label="Snapshot">
              {c.snapshotId && audience ? (
                // Le snapshot vit sous la page de son audience (pas de route
                // dédiée). On y renvoie via l'ancre snapshot.
                <Link
                  href={`/admin/emails/audiences/${audience.id}#snapshot-${c.snapshotId}`}
                  className="text-stone-800 underline"
                >
                  {String(c.snapshotId).slice(0, 8)}… ↗
                </Link>
              ) : c.snapshotId ? (
                <span className="font-mono text-stone-700">{String(c.snapshotId).slice(0, 8)}…</span>
              ) : (
                <span className="text-stone-500">—</span>
              )}
            </FieldNode>
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
            {/* UX-CAMP-006 — Livrés/Désabos ne sont pas alimentés par le sync
                actuel : on les marque « n/d » plutôt que d'afficher 0 (donnée
                morte présentée comme vivante). */}
            <MetricNd label="Livrés" />
            <Metric label="Ouvertures" value={c.openCount} />
            <Metric label="Clics" value={c.clickCount} />
            <Metric label="Bounces" value={c.bounceCount} />
            <MetricNd label="Désabos" />
          </dl>
          <p className="mt-3 text-xs text-stone-500">
            Métriques rafraîchies par poll Listmonk (cron + bouton ci-dessous).{' '}
            Dernière synchro :{' '}
            {c.finishedAt
              ? new Date(c.finishedAt).toLocaleString('fr-FR')
              : new Date(c.updatedAt).toLocaleString('fr-FR')}
            .
          </p>
        </section>
      </div>

      <CampaignActions id={c.id} name={c.name} caps={caps} />
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

function FieldNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="col-span-2 text-stone-800">{children}</dd>
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

function MetricNd({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-400" title="Non alimenté par le sync actuel">
        n/d
      </p>
    </div>
  );
}
