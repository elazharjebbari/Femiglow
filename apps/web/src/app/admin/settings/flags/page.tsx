import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { FlagsEditor } from '@/components/admin/settings/FlagsEditor';
import { getSection } from '@/lib/admin-config/resolve';
import { flagsDefault } from '@/lib/admin-config/defaults';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsFlagsPage() {
  const session = await requireAdmin('/admin/settings/flags');
  const resolved = await getSection('flags');
  // Fusion non destructive : les flags du code (defaults) garantissent qu'un
  // flag nouvellement ajouté apparaît dans l'éditeur même si le payload DB n'a
  // pas encore été re-seedé ; les valeurs DB restent prioritaires pour les clés
  // déjà persistées.
  const initialFlags = { ...flagsDefault.flags, ...resolved.payload.flags };
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <FlagsEditor initialFlags={initialFlags} meta={resolved.meta} />
    </AdminShell>
  );
}
