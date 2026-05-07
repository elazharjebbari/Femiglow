/**
 * Sous-page SEO dédiée à un produit donné.
 *
 * Cette page délègue à `SeoOverrideEditor` avec un `lockedTarget` :
 *  - scope     = 'product'
 *  - targetKey = slug du produit
 *  - locale    = locale par défaut du site (fr-MA)
 *
 * Si un override existe déjà (id matchant le triplet), on l'édite ;
 * sinon on entre en mode création avec ces clés pré-remplies (et verrouillées).
 *
 * Le bouton « Supprimer » du SeoOverrideEditor renvoie vers la fiche produit
 * (`backHref`) plutôt que vers la liste SEO globale.
 */
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { SeoOverrideEditor } from '@/components/admin/seo/SeoOverrideEditor';
import { getProductBySlug } from '@/lib/db/queries/products';
import { getOverrideByTarget } from '@/lib/db/queries/seo';
import { KIT_LOCALE } from '@/lib/products/public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function AdminProductSeoPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const session = await requireAdmin(`/admin/products/${slug}/seo`);
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const override = await getOverrideByTarget('product', slug, KIT_LOCALE);

  return (
    <AdminShell adminEmail={session.email} active="products">
      <SeoOverrideEditor
        initial={override}
        mode={override ? 'edit' : 'create'}
        lockedTarget={{ scope: 'product', targetKey: slug, locale: KIT_LOCALE }}
        backHref={`/admin/products/${slug}`}
        backLabel={`Produit · ${product.product.title}`}
      />
    </AdminShell>
  );
}
