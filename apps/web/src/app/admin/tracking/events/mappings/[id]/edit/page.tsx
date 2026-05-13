import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { MappingVersionEditor } from '@/components/admin/tracking/mappings/MappingVersionEditor';

export const dynamic = 'force-dynamic';

export default async function MappingVersionEditPage({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/tracking/events/mappings/${params.id}/edit`);
  const version = await mappingStore.get(decodeURIComponent(params.id));
  if (!version) notFound();

  return (
    <main className="space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold text-stone-900">Éditer — {version.name}</h1>
        <p className="text-xs text-stone-500">D-001 : sauvegarder créera une nouvelle version draft (l'originale reste intacte).</p>
      </header>
      <MappingVersionEditor initial={version} />
    </main>
  );
}
