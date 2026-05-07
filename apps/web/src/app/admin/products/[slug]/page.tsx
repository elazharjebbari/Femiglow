import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getProductBySlug } from '@/lib/db/queries/products';
import { ProductDetailEditor } from '@/components/admin/products/ProductDetailEditor';
import { VariantsEditor } from '@/components/admin/products/VariantsEditor';
import { ProductPublishButton } from '@/components/admin/products/ProductPublishButton';
import { ProductHistoryPanel } from '@/components/admin/products/ProductHistoryPanel';
import { getProductPublicHref } from '@/lib/products/cache';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const session = await requireAdmin('/admin/products');
  const { slug } = await Promise.resolve(params);
  const data = await getProductBySlug(slug);
  if (!data) notFound();

  const statusColor: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-stone-200 text-stone-700',
  };

  // Chemin public où le produit est rendu (ex. `/kit` pour `le-kit`).
  // Quand il existe, on affiche un lien explicite « Voir sur la vitrine »
  // pour matérialiser la synchronisation entre cette interface et la page
  // publique. Voir `lib/products/cache.ts` pour le mapping.
  const publicHref = getProductPublicHref(data.product.slug);

  return (
    <AdminShell adminEmail={session.email} active="products">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs">
            <Link
              href="/admin/products"
              className="text-stone-500 underline-offset-2 hover:underline"
            >
              ← Produits
            </Link>
            <span className="text-stone-400">/</span>
            <span className="font-mono text-stone-600">{data.product.slug}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                statusColor[data.product.status] ?? ''
              }`}
            >
              {data.product.status}
            </span>
            {publicHref ? (
              <Link
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
                title={`Voir le produit sur ${publicHref}`}
              >
                Visible sur {publicHref} ↗
              </Link>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {data.product.title}
          </h1>
          {data.product.tagline ? (
            <p className="mt-1 text-sm text-stone-600">{data.product.tagline}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/products/${data.product.slug}/seo`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            SEO & données enrichies
          </Link>
          <ProductPublishButton
            slug={data.product.slug}
            status={data.product.status}
            variantsCount={data.variants.length}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
            Fiche produit
          </h2>
          <ProductDetailEditor product={data.product} />
        </section>
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">
              Variantes
            </h2>
            <VariantsEditor
              slug={data.product.slug}
              initialVariants={data.variants}
              publicShowcaseHref={publicHref}
            />
          </section>
          <ProductHistoryPanel slug={data.product.slug} />
        </div>
      </div>
    </AdminShell>
  );
}
