import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { TemplateVarsEditor } from '@/components/admin/legal/TemplateVarsEditor';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listAllTemplateVars } from '@/lib/legal/repository';

export const dynamic = 'force-dynamic';

export default async function TemplateVarsPage() {
  const session = await requireAdmin('/admin/legal/template-vars');
  const vars = await listAllTemplateVars();

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
            ← Pages légales
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Variables de template
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Ces valeurs sont substituées dans toutes les pages légales via{' '}
            <code className="bg-stone-100 px-1 py-0.5 text-xs">{`{{KEY}}`}</code>.
            Les variables <strong>requises</strong> bloquent la publication tant
            qu&apos;elles ne sont pas remplies.
          </p>
        </div>
      </header>

      <TemplateVarsEditor
        vars={vars.map((v) => ({
          key: v.key,
          label: v.label,
          description: v.description,
          value: v.value,
          isRequired: v.isRequired,
          sensitive: v.sensitive,
        }))}
      />
    </AdminShell>
  );
}
