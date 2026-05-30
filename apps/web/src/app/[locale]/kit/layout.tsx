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
import { getTranslations } from 'next-intl/server';

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { ToastProvider } from '@/components/ui/Toast';
import { DEFAULT_LOCALE, isLocale } from '@/i18n.config';
import { buildKitPublicProduct } from '@/lib/products/public';

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
  const [product, t, tKit] = await Promise.all([
    buildKitPublicProduct(),
    // Phase 7 wiring — libellé localisé du CTA sticky (était « Commander »
    // hardcodé qui fuitait en FR sur /ar/kit et /en/kit).
    getTranslations({ locale, namespace: 'common' }),
    // Phase 9bis — nom produit + aria localisés du sticky CTA (le nom DB
    // « Pack FemiGlow » fuitait en latin/FR sur /ar/kit).
    getTranslations({ locale, namespace: 'marketing.kit' }),
  ]);
  const effectivePriceCents = product.promoPriceCents ?? product.priceCents;
  const localizedProductName = tKit('product.name');
  const stickyAriaRegion = tKit('sticky.aria_region');

  return (
    <ToastProvider>
      {children}
      <StickyCartCTA
        productName={localizedProductName}
        ariaRegion={stickyAriaRegion}
        priceCents={product.priceCents}
        promoPriceCents={product.promoPriceCents}
        currency={product.currency}
        observeId="hero-produit-anchor"
      >
        <CommanderAnchorButton
          size="md"
          productId={product.id}
          productName={localizedProductName}
          priceCents={effectivePriceCents}
          currency={product.currency}
          label={t('commander')}
        />
      </StickyCartCTA>
      <MiniCartSlideOver />
    </ToastProvider>
  );
}
