import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { RbacEditor } from '@/components/admin/settings/RbacEditor';
import { getSection } from '@/lib/admin-config/resolve';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsRbacPage() {
  const session = await requireAdmin('/admin/settings/rbac');
  const resolved = await getSection('rbac');
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <RbacEditor initialMatrix={resolved.payload.matrix} meta={resolved.meta} />
    </AdminShell>
  );
}
