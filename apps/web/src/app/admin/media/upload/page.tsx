import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { MediaUploadForm } from '@/components/admin/media/MediaUploadForm';

export const dynamic = 'force-dynamic';

export default async function MediaUploadPage() {
  const session = await requireAdmin('/admin/media/upload');
  return (
    <AdminShell adminEmail={session.email} active="media">
      <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-stone-500">
        <Link href="/admin/media" className="hover:underline">
          Médias
        </Link>{' '}
        <span aria-hidden="true">/</span> Importer
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Importer des médias
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Importez plusieurs fichiers à la fois. Le pipeline d'optimisation se
          déclenche automatiquement.
        </p>
      </header>
      <MediaUploadForm />
    </AdminShell>
  );
}
