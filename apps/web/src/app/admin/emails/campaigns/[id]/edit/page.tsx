/**
 * /admin/emails/campaigns/[id]/edit — Wizard d'édition d'un brouillon.
 *
 * RSC : charge les lists et templates Listmonk, puis rend le wizard client.
 */
import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getCampaignDraft,
  fetchListmonkLists,
  fetchListmonkTemplates,
} from '@/lib/admin/emails/campaigns-queries';
import { listAudiencesWithSnapshotCount } from '@/lib/mail/audiences/queries';
import { readPayloadTemplateId } from '@/lib/admin/emails/campaigns-shared';
import { CampaignWizard } from '@/components/admin/emails/wizard/CampaignWizard';

export const dynamic = 'force-dynamic';

export default async function CampaignEditPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/campaigns/${params.id}/edit`);
  const draft = await getCampaignDraft(params.id);
  if (!draft) notFound();
  if (draft.status !== 'draft') {
    redirect(`/admin/emails/campaigns/${params.id}`);
  }

  const [listsRes, tplRes, audiencesAll] = await Promise.all([
    fetchListmonkLists(),
    fetchListmonkTemplates(),
    listAudiencesWithSnapshotCount(),
  ]);
  const lists = listsRes.ok ? listsRes.lists : [];
  const templates = tplRes.ok ? tplRes.templates : [];
  const audiences = audiencesAll.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    snapshotCount: a.snapshotCount,
  }));
  const listmonkError = !listsRes.ok ? listsRes.error : !tplRes.ok ? tplRes.error : null;

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {draft.name}
        </h1>
        <p className="mt-1 text-sm text-stone-600">Brouillon · {draft.id.slice(0, 8)}…</p>
      </header>

      <CampaignWizard
        draftId={draft.id}
        initial={{
          name: draft.name,
          subject: draft.subject ?? '',
          preheader: draft.preheader,
          audienceLinkIds: Array.isArray(draft.audienceLinkIds) ? (draft.audienceLinkIds as number[]) : [],
          audienceId: (draft.audienceId as string | null) ?? null,
          // UX-CAMP-004 — réhydrate le template Listmonk persisté dans le payload
          // (auparavant codé en dur à null → le choix d'étape 3 était perdu).
          listmonkTemplateId: readPayloadTemplateId(draft.payloadJson),
          scheduledFor: draft.scheduledFor ? draft.scheduledFor.toISOString() : null,
          payloadJson: (draft.payloadJson as Record<string, unknown>) ?? {},
        }}
        lists={lists}
        templates={templates}
        audiences={audiences}
        listmonkError={listmonkError}
        adminEmail={session.email}
      />
    </AdminShell>
  );
}
