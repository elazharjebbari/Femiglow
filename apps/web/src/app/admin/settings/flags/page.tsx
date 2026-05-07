import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { FlagsEditor } from '@/components/admin/settings/FlagsEditor';
import { getSection } from '@/lib/admin-config/resolve';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsFlagsPage() {
  const session = await requireAdmin('/admin/settings/flags');
  const resolved = await getSection('flags');
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <FlagsEditor initialFlags={resolved.payload.flags} meta={resolved.meta} />
    </AdminShell>
  );
}
