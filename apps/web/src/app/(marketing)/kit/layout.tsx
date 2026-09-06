import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { PromoCodeAutoApply } from '@/components/commerce/PromoCodeAutoApply';
import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { buildKitPublicProduct } from '@/lib/products/public';

const MiniCartSlideOver = dynamic(
  () =>
    import('@/components/commerce/MiniCartSlideOver').then(
      (m) => m.MiniCartSlideOver,
    ),
  { ssr: false },
);

/**
 * CHA-231 — La sticky CTA scroll désormais vers le funnel embarqué
 * (#commander-femiglow) au lieu de rediriger vers /panier. Le client passe
 * par lead → address → thank_you sans quitter /kit.
 */
export default async function KitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const product = await buildKitPublicProduct();
  const effectivePriceCents =
    product.promoPriceCents ?? product.priceCents;

  return (
    <ToastProvider>
      {/* Code promo de campagne (?code=GLOW99) + reprise du code mémorisé.
          useSearchParams ⇒ Suspense obligatoire (page ISR). */}
      <Suspense fallback={null}>
        <PromoCodeAutoApply />
      </Suspense>
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
