import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingMatrix } from '@/components/admin/tracking/mappings/MappingMatrix';
import { MappingExportButton } from '@/components/admin/tracking/mappings/MappingExportButton';

export const dynamic = 'force-dynamic';

/** Lecture seule d'une version. */
export default async function MappingVersionPage({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/tracking/events/mappings/${params.id}`);
  const version = await mappingStore.get(decodeURIComponent(params.id));
  if (!version) notFound();

  return (
    <main className="space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">{version.name}</h1>
          <p className="text-xs text-stone-500">
            {version.isActive ? 'ACTIVE • ' : version.isDefault ? 'DEFAULT • ' : `${version.status} • `}
            créée {new Date(version.createdAt).toLocaleDateString('fr-FR')} par {version.createdBy}
            {version.clonedFrom ? ` • clonée de ${version.clonedFrom}` : ''}
          </p>
          {version.notes ? <p className="mt-1 text-xs text-stone-600">{version.notes}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {!version.isDefault ? (
            <a href={`/admin/tracking/events/mappings/${version.id}/edit`} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Éditer</a>
          ) : null}
          <MappingExportButton versionId={version.id} versionName={version.name} />
          <a href="/admin/tracking/events/mappings" className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">← Retour</a>
        </div>
      </header>
      <MappingMatrix mappings={version.mappings} readOnly />
    </main>
  );
}
