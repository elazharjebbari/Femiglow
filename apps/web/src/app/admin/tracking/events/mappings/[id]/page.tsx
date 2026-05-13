import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingMatrix } from '@/components/admin/tracking/mappings/MappingMatrix';
import { MappingExportButton } from '@/components/admin/tracking/mappings/MappingExportButton';
import { CloneAndEditButton } from '@/components/admin/tracking/mappings/CloneAndEditButton';

export const dynamic = 'force-dynamic';

/** Lecture seule d'une version + actions contextuelles. */
export default async function MappingVersionPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/tracking/events/mappings/${params.id}`);
  const version = await mappingStore.get(decodeURIComponent(params.id));
  if (!version) notFound();

  return (
    <TrackingShell
      adminEmail={session.email}
      active="mappings"
      title={version.name}
      description={
        (version.isActive ? 'ACTIVE • ' : version.isDefault ? 'DEFAULT • ' : `${version.status} • `) +
        `créée ${new Date(version.createdAt).toLocaleDateString('fr-FR')} par ${version.createdBy}` +
        (version.clonedFrom ? ` • clonée de ${version.clonedFrom}` : '')
      }
    >
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-end gap-2">
          {version.isDefault || version.isActive ? (
            <CloneAndEditButton
              sourceId={version.id}
              sourceName={version.name}
              label={version.isDefault ? '✏ Cloner le default et éditer' : '✏ Cloner l\'active et éditer'}
            />
          ) : null}
          {!version.isDefault && !version.isActive ? (
            <a
              href={`/admin/tracking/events/mappings/${version.id}/edit`}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700"
              data-testid="btn-edit-from-detail"
            >
              ✏ Éditer
            </a>
          ) : null}
          <a
            href={`/admin/tracking/events/mappings/${version.id}/audit`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            📋 Historique
          </a>
          <MappingExportButton versionId={version.id} versionName={version.name} />
          <a
            href="/admin/tracking/events/mappings"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ← Liste
          </a>
        </header>
        {version.notes ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
            <span className="font-medium">Notes : </span>
            {version.notes}
          </div>
        ) : null}
        <MappingMatrix mappings={version.mappings} readOnly />
      </div>
    </TrackingShell>
  );
}
