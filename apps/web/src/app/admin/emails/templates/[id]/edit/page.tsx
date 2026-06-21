/**
 * /admin/emails/templates/[id]/edit — Édition d'un template HTML (M5.7.8).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getTemplateById, listVersions } from '@/lib/mail/templates/custom/queries';
import { TemplateEditor } from '@/components/admin/emails/templates/TemplateEditor';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/templates/${params.id}/edit`);
  const template = await getTemplateById(params.id);
  if (!template) notFound();
  const versions = await listVersions(params.id);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-4">
        <Link href="/admin/emails/templates" className="text-sm text-stone-500 underline">
          ← Templates
        </Link>
        <h1 className="mt-1 font-serif text-2xl text-stone-800">{template.name}</h1>
        <p className="text-xs text-stone-500 font-mono">{template.slug}</p>
      </header>
      <TemplateEditor template={template} versions={versions} adminEmail={session.email} />
    </AdminShell>
  );
}
