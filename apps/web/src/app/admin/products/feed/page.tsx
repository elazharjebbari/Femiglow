/**
 * `/admin/products/feed` — Aperçu du feed produit Kolenda-driven.
 *
 * Triple vue :
 *  1. **Aperçu UI** : la section `<ProductFeedSection/>` rendue dans son
 *     vrai style (telle qu'elle apparaît sur `/kit`).
 *  2. **Vue JSON** : la structure `ProductFeed` complète (debug, copy
 *     review).
 *  3. **Vue XML** : le feed Google Merchant prêt à brancher (avec
 *     bouton « Télécharger feed.xml » qui lie l'endpoint public).
 *
 * L'admin peut ainsi vérifier d'un coup d'œil le copywriting + le
 * rendu commercial + le payload diffusé aux régies (Google Shopping,
 * Facebook Catalog).
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { CopyButton } from '@/components/admin/products/CopyButton';
import { FeedRevalidateButton } from '@/components/admin/products/FeedRevalidateButton';
import { ProductFeedSection } from '@/components/sections/ProductFeedSection';
import { ToastProvider } from '@/components/ui/Toast';
import { requireAdmin } from '@/lib/auth/require-admin';
import { cms } from '@/lib/cms';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import { validateMerchantFeed } from '@/lib/products/feed/merchant-linter';
import { merchantFeedXml } from '@/lib/products/feed/merchant-xml';
import { buildKitPublicProduct } from '@/lib/products/public';
import { getProductReviewStats } from '@/lib/products/reviews';

export const dynamic = 'force-dynamic';

export default async function AdminProductFeedPage() {
  const session = await requireAdmin('/admin/products/feed');
  const [content, product] = await Promise.all([
    cms.getKitPageContent(),
    buildKitPublicProduct(),
  ]);
  // Stats reviews côté admin = identiques à celles affichées sur /kit. On
  // reste cohérent avec la page publique pour que le preview admin ne
  // mente pas (le rating/count affiché ici doit être ce que verra Google
  // Merchant + le visiteur).
  const reviewStats = await getProductReviewStats(product.id);
  const feed = buildKitProductFeed(product, content, reviewStats);
  const xml = merchantFeedXml(feed);
  // Audit Merchant — donne à l'admin une visibilité immédiate sur
  // la conformité (errors → rejet ingestion) et les recommandations
  // Kolenda (warnings → suboptimal mais accepté). Cf. §4.5 du
  // rapport CHA-225.
  const lintReport = validateMerchantFeed(feed);

  return (
    <AdminShell adminEmail={session.email} active="products">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Feed produit
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Aperçu du bloc copywriting Kolenda-driven affiché sur{' '}
            <Link href="/kit" className="underline underline-offset-2">
              /kit
            </Link>{' '}
            + payload Google Merchant prêt à brancher. Toute évolution
            éditoriale passe par{' '}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
              src/lib/products/feed/kit-feed.ts
            </code>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href="/admin/products"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ← Produits
          </Link>
          {/* Force la purge des caches `product-feed` + `product:le-kit`
              et déclenche un re-build immédiat du XML — utile après
              une modif de copywriting ou de pricing pour ne pas
              attendre la fenêtre ISR de 30 min. */}
          <FeedRevalidateButton />
          <a
            href="/feed.xml"
            download="femiglow-feed.xml"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
            data-testid="admin-feed-download"
          >
            Télécharger feed.xml
          </a>
        </div>
      </header>

      <div className="space-y-10">
        {/* 0 — Audit Merchant (errors/warnings) — affiché en premier
            pour que l'admin voit immédiatement les problèmes avant
            même de scroller vers l'aperçu. */}
        <section
          aria-labelledby="feed-lint-title"
          className="space-y-3"
          data-testid="admin-feed-lint"
        >
          <h2
            id="feed-lint-title"
            className="text-sm font-semibold uppercase tracking-wide text-stone-500"
          >
            Audit Merchant
          </h2>
          {lintReport.errors.length === 0 && lintReport.warnings.length === 0 ? (
            <p
              className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              data-testid="admin-feed-lint-clean"
            >
              ✓ Feed conforme — aucune erreur ni recommandation.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lintReport.errors.map((issue) => (
                <li
                  key={`err-${issue.code}-${issue.path}`}
                  className="flex flex-wrap items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900"
                  data-testid="admin-feed-lint-error"
                >
                  <span className="rounded bg-rose-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Erreur
                  </span>
                  <code className="text-xs text-rose-800">{issue.path}</code>
                  <span className="ml-auto rounded border border-rose-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                    {issue.code}
                  </span>
                  <p className="basis-full text-sm">{issue.message}</p>
                </li>
              ))}
              {lintReport.warnings.map((issue) => (
                <li
                  key={`warn-${issue.code}-${issue.path}`}
                  className="flex flex-wrap items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900"
                  data-testid="admin-feed-lint-warning"
                >
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Reco
                  </span>
                  <code className="text-xs text-amber-800">{issue.path}</code>
                  <span className="ml-auto rounded border border-amber-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                    {issue.code}
                  </span>
                  <p className="basis-full text-sm">{issue.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 1 — Aperçu UI (section telle qu'elle est rendue sur /kit) */}
        <section aria-labelledby="feed-preview-title" className="space-y-3">
          <h2
            id="feed-preview-title"
            className="text-sm font-semibold uppercase tracking-wide text-stone-500"
          >
            Aperçu /kit
          </h2>
          <div
            className="overflow-hidden rounded-lg border border-stone-200 bg-white"
            data-testid="admin-feed-preview"
          >
            {/* AddToCartButton (utilisé par <ProductFeedSection/>) consomme le
                contexte ToastProvider pour les confirmations « ajouté au
                panier ». L'admin shell ne le fournit pas — on l'injecte
                localement, périmétré à l'aperçu. */}
            <ToastProvider>
              <ProductFeedSection feed={feed} product={product} anchorId="admin-product-feed" />
            </ToastProvider>
          </div>
        </section>

        {/* 2 — Structure JSON (debug, copy review) */}
        <section aria-labelledby="feed-json-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="feed-json-title"
              className="text-sm font-semibold uppercase tracking-wide text-stone-500"
            >
              Structure JSON
            </h2>
            {/* CopyButton — coller rapidement dans Postman / un schéma
                LangChain / un repro. Cf. rapport §4.1. */}
            <CopyButton
              text={JSON.stringify(feed, null, 2)}
              label="Copier le JSON"
              testId="admin-feed-json-copy"
            />
          </div>
          <pre
            className="max-h-[420px] overflow-auto rounded-md border border-stone-200 bg-stone-950 p-4 text-xs leading-relaxed text-stone-100"
            data-testid="admin-feed-json"
          >
            {JSON.stringify(feed, null, 2)}
          </pre>
        </section>

        {/* 3 — XML Google Merchant */}
        <section aria-labelledby="feed-xml-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="feed-xml-title"
              className="text-sm font-semibold uppercase tracking-wide text-stone-500"
            >
              XML Google Merchant
            </h2>
            <CopyButton
              text={xml}
              label="Copier le XML"
              testId="admin-feed-xml-copy"
            />
          </div>
          <p className="text-xs text-stone-600">
            URL publique :{' '}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px]">
              /feed.xml
            </code>{' '}
            — RSS 2.0 + namespace <code className="text-[11px]">g:</code> ·
            content-type <code className="text-[11px]">application/xml</code>.
            Cette URL peut être branchée directement dans Google Merchant
            Center, Facebook Catalog ou tout outil de Shopping ads.
          </p>
          <pre
            className="max-h-[420px] overflow-auto rounded-md border border-stone-200 bg-stone-50 p-4 font-mono text-xs leading-relaxed text-stone-800"
            data-testid="admin-feed-xml"
          >
            {xml}
          </pre>
        </section>
      </div>
    </AdminShell>
  );
}
