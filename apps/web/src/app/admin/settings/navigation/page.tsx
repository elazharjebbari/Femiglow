import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { NavEditor } from '@/components/admin/settings/NavEditor';
import { getSection } from '@/lib/admin-config/resolve';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsNavPage() {
  const session = await requireAdmin('/admin/settings/navigation');
  const resolved = await getSection('nav');

  return (
    <AdminShell adminEmail={session.email} active="settings">
      <NavEditor initialItems={resolved.payload.items} meta={resolved.meta} />
    </AdminShell>
  );
}
