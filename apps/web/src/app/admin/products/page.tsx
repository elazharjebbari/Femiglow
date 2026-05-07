import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listProducts } from '@/lib/db/queries/products';
import { PRODUCT_STATUSES, type ProductStatus } from '@/lib/products/types';
import { ProductsBulkPanel } from '@/components/admin/products/ProductsBulkPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?:
    | Promise<{ status?: string; q?: string; category?: string }>
    | { status?: string; q?: string; category?: string };
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/products');
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const status =
    sp.status && (PRODUCT_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as ProductStatus)
      : sp.status === 'all'
        ? 'all'
        : undefined;

  const { items, total } = await listProducts({
    status,
    q: sp.q || undefined,
    category: sp.category || undefined,
  });

  return (
    <AdminShell adminEmail={session.email} active="products">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Produits
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Catalogue éditable. Cycle de vie : draft ↔ published → archived → suppression.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          + Nouveau produit
        </Link>
      </header>

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-white p-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Statut</span>
          <select
            name="status"
            defaultValue={(status as string) ?? ''}
            className="rounded border border-stone-200 bg-white px-2 py-1"
          >
            <option value="">Tous</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="all">all</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-stone-500">Recherche</span>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="slug, titre…"
            className="w-64 rounded border border-stone-200 bg-white px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          Filtrer
        </button>
      </form>

      <p className="mb-2 text-xs text-stone-500">
        {total} produit{total === 1 ? '' : 's'}
      </p>

      <ProductsBulkPanel items={items} />
    </AdminShell>
  );
}
