import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeoSettingsEditor } from '@/components/admin/seo/SeoSettingsEditor';
import { getSeoSettings } from '@/lib/db/queries/seo';

export const dynamic = 'force-dynamic';

export default async function AdminSeoSettingsPage() {
  const session = await requireAdmin('/admin/seo/settings');
  const settings = await getSeoSettings();

  return (
    <AdminShell adminEmail={session.email} active="seo">
      <SeoSettingsEditor initial={settings} />
    </AdminShell>
  );
}
