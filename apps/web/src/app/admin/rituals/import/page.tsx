import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { RitualsImportClient } from '@/components/admin/rituals/RitualsImportClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import — Rituels' };

export default async function AdminRitualsImportPage() {
  const session = await requireAdmin('/admin/rituals/import');

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Importer des rituels partagés
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Téléchargez un modèle, collez votre contenu, prévisualisez, commitez.
            Tous les rituels créés passent en PENDING (modération obligatoire).
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/rituals/queue" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Queue
          </Link>
          <Link href="/admin/rituals/published" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Publiés
          </Link>
          <Link href="/admin/rituals/import" className="border border-stone-900 bg-stone-900 px-3 py-1 text-white">
            Importer
          </Link>
        </nav>
      </header>

      <RitualsImportClient />
    </AdminShell>
  );
}
