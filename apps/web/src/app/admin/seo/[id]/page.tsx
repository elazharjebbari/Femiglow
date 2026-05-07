import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeoOverrideEditor } from '@/components/admin/seo/SeoOverrideEditor';
import { getOverrideById } from '@/lib/db/queries/seo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function AdminSeoEditPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const session = await requireAdmin(`/admin/seo/${id}`);
  const override = await getOverrideById(id);
  if (!override) notFound();

  return (
    <AdminShell adminEmail={session.email} active="seo">
      <SeoOverrideEditor initial={override} mode="edit" />
    </AdminShell>
  );
}
