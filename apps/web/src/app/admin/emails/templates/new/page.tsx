/**
 * /admin/emails/templates/new — Création d'un template avec choix starter (M5.7.7).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { NewTemplateForm } from './NewTemplateForm';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const session = await requireAdmin('/admin/emails/templates/new');
  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <Link href="/admin/emails/templates" className="text-sm text-stone-500 underline">
          ← Templates
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-stone-800">Nouveau template</h1>
        <p className="mt-1 text-sm text-stone-600">
          Choisissez un point de départ : template vierge ou la charte FemiGlow
          par défaut.
        </p>
      </header>
      <NewTemplateForm />
    </AdminShell>
  );
}
