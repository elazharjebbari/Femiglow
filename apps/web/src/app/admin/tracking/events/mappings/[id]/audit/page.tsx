import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingAuditTimeline } from '@/components/admin/tracking/mappings/MappingAuditTimeline';

export const dynamic = 'force-dynamic';

export default async function MappingVersionAuditPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/tracking/events/mappings/${params.id}/audit`);
  const id = decodeURIComponent(params.id);
  const version = await mappingStore.get(id);
  if (!version) notFound();

  return (
    <TrackingShell
      adminEmail={session.email}
      active="mappings"
      title={`Historique — ${version.name}`}
      description="Audit log de toutes les actions sur cette version (création, édition, activation, archivage, export GTM, test dispatch…)."
    >
      <div className="space-y-3">
        <header className="flex justify-end">
          <a
            href={`/admin/tracking/events/mappings/${version.id}`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ← Retour à la version
          </a>
        </header>
        <MappingAuditTimeline versionId={id} />
      </div>
    </TrackingShell>
  );
}
