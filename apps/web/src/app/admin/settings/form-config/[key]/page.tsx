/**
 * /admin/settings/form-config/[key] — éditeur d'un wizard.
 *
 * Server component. Charge la row courante via le repo, puis passe
 * l'éditeur client.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §3.2
 */
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { FormConfigEditor } from '@/components/admin/settings/FormConfigEditor';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import type { FormConfigJson } from '@/lib/checkout/form-config/schema';

export const dynamic = 'force-dynamic';

const KNOWN_KEYS = new Set(['wizard_kit', 'wizard_commander']);

export default async function AdminFormConfigDetailPage({
  params,
}: {
  params: { key: string };
}) {
  const session = await requireAdmin(`/admin/settings/form-config/${params.key}`);
  if (!KNOWN_KEYS.has(params.key)) notFound();

  const row = await formConfigRepo.getByKey(params.key);
  if (!row) notFound();

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <FormConfigEditor
        formKey={row.key}
        initialConfig={row.config as FormConfigJson}
        initialVersion={row.version}
        initialActive={row.active}
        initialDescription={row.description}
      />
    </AdminShell>
  );
}
