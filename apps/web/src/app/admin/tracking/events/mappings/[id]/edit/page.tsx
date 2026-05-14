import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingVersionEditor } from '@/components/admin/tracking/mappings/MappingVersionEditor';

export const dynamic = 'force-dynamic';

export default async function MappingVersionEditPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/tracking/events/mappings/${params.id}/edit`);
  const version = await mappingStore.get(decodeURIComponent(params.id));
  if (!version) notFound();

  return (
    <TrackingShell
      adminEmail={session.email}
      active="mappings"
      title={`Éditer — ${version.name}`}
      description="D-001 : sauvegarder créera une nouvelle version draft (l'originale reste intacte)."
    >
      <MappingVersionEditor initial={version} />
    </TrackingShell>
  );
}
