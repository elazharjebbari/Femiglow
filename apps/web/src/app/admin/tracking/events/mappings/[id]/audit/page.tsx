import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingAuditTimeline } from '@/components/admin/tracking/mappings/MappingAuditTimeline';

export const dynamic = 'force-dynamic';

export default async function MappingVersionAuditPage({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/tracking/events/mappings/${params.id}/audit`);
  const id = decodeURIComponent(params.id);
  const version = await mappingStore.get(id);
  if (!version) notFound();

  return (
    <main className="space-y-4 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Historique — {version.name}</h1>
          <p className="text-xs text-stone-500">
            Audit log de toutes les actions sur cette version (création, édition, activation,
            archivage, export GTM, test dispatch…).
          </p>
        </div>
        <a
          href={`/admin/tracking/events/mappings/${version.id}`}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          ← Retour
        </a>
      </header>
      <MappingAuditTimeline versionId={id} />
    </main>
  );
}
