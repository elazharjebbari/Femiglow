import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { BrandingEditor } from '@/components/admin/settings/BrandingEditor';
import { getSection } from '@/lib/admin-config/resolve';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsBrandingPage() {
  const session = await requireAdmin('/admin/settings/branding');
  const resolved = await getSection('branding');
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <BrandingEditor initialBranding={resolved.payload} meta={resolved.meta} />
    </AdminShell>
  );
}
