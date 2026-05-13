import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { LegalWizard } from '@/components/admin/legal/LegalWizard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listAllTemplateVars, listAllZones } from '@/lib/legal/repository';

export const dynamic = 'force-dynamic';

export default async function NewLegalPage() {
  const session = await requireAdmin('/admin/legal/new');
  const [zones, vars] = await Promise.all([listAllZones(), listAllTemplateVars()]);

  return (
    <AdminShell adminEmail={session.email} active="legal">
      <header className="mb-6">
        <Link href="/admin/legal" className="text-xs text-stone-500 hover:underline">
          ← Pages légales
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Nouvelle page légale
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Wizard en 5 étapes. La page sera créée en <strong>draft</strong>. Tu pourras la
          publier ensuite depuis l&apos;éditeur (avec confirmation).
        </p>
      </header>

      <LegalWizard
        zones={zones.map((z) => ({
          key: z.key,
          label: z.label,
          isRequired: z.isRequired,
        }))}
        templateVars={vars.map((v) => ({
          key: v.key,
          value: v.value,
          isRequired: v.isRequired,
        }))}
      />
    </AdminShell>
  );
}
