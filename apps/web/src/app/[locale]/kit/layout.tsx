/**
 * Layout `/[locale]/kit/*` — réplique du `(marketing)/kit/layout.tsx`
 * pour les routes localisées. Fournit le ToastProvider, le sticky CTA
 * et le MiniCartSlideOver — sans quoi `KitPageLayoutV1/V2` crashent
 * (`useToast doit être appelé à l'intérieur de <ToastProvider>`).
 *
 * @see apps/web/src/app/(marketing)/kit/layout.tsx (version legacy)
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.9
 */
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { PromoCodeAutoApply } from '@/components/commerce/PromoCodeAutoApply';
import { ToastProvider } from '@/components/ui/Toast';
import { DEFAULT_LOCALE, isLocale } from '@/i18n.config';
import { buildKitPublicProduct } from '@/lib/products/public';
import { resolveKitCtaCopy } from '@/lib/kit/cta-copy.server';

const MiniCartSlideOver = dynamic(
  () =>
    import('@/components/commerce/MiniCartSlideOver').then(
      (m) => m.MiniCartSlideOver,
    ),
  { ssr: false },
);

export default async function LocaleKitLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const [product, ctaCopy, tKit] = await Promise.all([
    buildKitPublicProduct(),
    // Kit CRO v2 §4 — libellé du CTA sticky : CMS `kit-cta/ctaSticky` ▸ i18n
    // `marketing.kit.cta.sticky` (localisé FR/AR/EN).
    resolveKitCtaCopy(locale),
    // Phase 9bis — nom produit + aria localisés du sticky CTA (le nom DB
    // « Pack FemiGlow » fuitait en latin/FR sur /ar/kit).
    getTranslations({ locale, namespace: 'marketing.kit' }),
  ]);
  const effectivePriceCents = product.promoPriceCents ?? product.priceCents;
  const localizedProductName = tKit('product.name');
  const stickyAriaRegion = tKit('sticky.aria_region');
  // Gabarits bruts : `{code}` / `{amount}` sont remplis côté client.
  const promoFlagStrings = {
    label: tKit.raw('sticky.promo_flag.label') as string,
    toast: tKit.raw('sticky.promo_flag.toast') as string,
    aria: tKit.raw('sticky.promo_flag.aria') as string,
  };

  return (
    <ToastProvider>
      {/* Code promo de campagne (?code=GLOW99) + reprise du code mémorisé.
          useSearchParams ⇒ Suspense obligatoire (page ISR). */}
      <Suspense fallback={null}>
        <PromoCodeAutoApply />
      </Suspense>
      {children}
      <StickyCartCTA
        productName={localizedProductName}
        ariaRegion={stickyAriaRegion}
        priceCents={product.priceCents}
        promoPriceCents={product.promoPriceCents}
        currency={product.currency}
        observeId="hero-produit-anchor"
        locale={locale}
        promoFlagStrings={promoFlagStrings}
      >
        <CommanderAnchorButton
          size="md"
          productId={product.id}
          productName={localizedProductName}
          priceCents={effectivePriceCents}
          deductCredit
          currency={product.currency}
          source="sticky"
          labelTemplate={ctaCopy.sticky}
          priceLocale={locale}
        />
      </StickyCartCTA>
      <MiniCartSlideOver />
    </ToastProvider>
  );
}
