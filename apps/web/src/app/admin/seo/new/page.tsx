import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeoOverrideEditor } from '@/components/admin/seo/SeoOverrideEditor';

export const dynamic = 'force-dynamic';

export default async function AdminSeoNewPage() {
  const session = await requireAdmin('/admin/seo/new');

  return (
    <AdminShell adminEmail={session.email} active="seo">
      <SeoOverrideEditor initial={null} mode="create" />
    </AdminShell>
  );
}
