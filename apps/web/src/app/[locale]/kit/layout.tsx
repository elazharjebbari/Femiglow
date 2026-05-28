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

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { ToastProvider } from '@/components/ui/Toast';
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
}: {
  children: React.ReactNode;
}) {
  const product = await buildKitPublicProduct();
  const effectivePriceCents = product.promoPriceCents ?? product.priceCents;

  return (
    <ToastProvider>
      {children}
      <StickyCartCTA
        productName={product.name}
        priceCents={product.priceCents}
        promoPriceCents={product.promoPriceCents}
        currency={product.currency}
        observeId="hero-produit-anchor"
      >
        <CommanderAnchorButton
          size="md"
          productId={product.id}
          productName={product.name}
          priceCents={effectivePriceCents}
          currency={product.currency}
        >
          Commander
        </CommanderAnchorButton>
      </StickyCartCTA>
      <MiniCartSlideOver />
    </ToastProvider>
  );
}
