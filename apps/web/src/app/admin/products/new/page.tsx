import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { ProductCreateForm } from '@/components/admin/products/ProductCreateForm';

export const dynamic = 'force-dynamic';

export default async function AdminProductNewPage() {
  const session = await requireAdmin('/admin/products/new');
  return (
    <AdminShell adminEmail={session.email} active="products">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Nouveau produit
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Slug + titre. Tu pourras compléter ensuite.
        </p>
      </header>
      <ProductCreateForm />
    </AdminShell>
  );
}
