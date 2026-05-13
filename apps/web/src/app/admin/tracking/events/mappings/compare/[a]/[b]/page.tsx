import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingDiffViewer } from '@/components/admin/tracking/mappings/MappingDiffViewer';

export const dynamic = 'force-dynamic';

export default async function MappingCompareePage({ params }: { params: { a: string; b: string } }) {
  await requireAdmin('/admin/tracking/events/mappings/compare');
  const a = decodeURIComponent(params.a);
  const b = decodeURIComponent(params.b);
  const [vA, vB] = await Promise.all([mappingStore.get(a), mappingStore.get(b)]);
  if (!vA || !vB) notFound();

  return (
    <main className="space-y-4 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Comparaison de versions</h1>
          <p className="text-xs text-stone-500">
            Visualise les différences cellule par cellule entre deux versions de mappings.
          </p>
        </div>
        <a
          href="/admin/tracking/events/mappings"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          ← Retour
        </a>
      </header>
      <MappingDiffViewer aId={vA.id} bId={vB.id} aName={vA.name} bName={vB.name} />
    </main>
  );
}
