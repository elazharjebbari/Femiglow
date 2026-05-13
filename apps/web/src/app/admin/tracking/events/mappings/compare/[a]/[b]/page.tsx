import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingDiffViewer } from '@/components/admin/tracking/mappings/MappingDiffViewer';

export const dynamic = 'force-dynamic';

export default async function MappingCompareePage({ params }: { params: { a: string; b: string } }) {
  const session = await requireAdmin('/admin/tracking/events/mappings/compare');
  const a = decodeURIComponent(params.a);
  const b = decodeURIComponent(params.b);
  const [vA, vB] = await Promise.all([mappingStore.get(a), mappingStore.get(b)]);
  if (!vA || !vB) notFound();

  return (
    <TrackingShell
      adminEmail={session.email}
      active="mappings"
      title="Comparaison de versions"
      description="Visualise les différences cellule par cellule entre deux versions de mappings."
    >
      <div className="space-y-3">
        <header className="flex justify-end">
          <a
            href="/admin/tracking/events/mappings"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ← Retour à la liste
          </a>
        </header>
        <MappingDiffViewer aId={vA.id} bId={vB.id} aName={vA.name} bName={vB.name} />
      </div>
    </TrackingShell>
  );
}
