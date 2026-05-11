import dynamic from 'next/dynamic';
import { ToastProvider } from '@/components/ui/Toast';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { AddToCartButton } from '@/components/commerce/AddToCartButton';
import { buildKitPublicProduct } from '@/lib/products/public';

const MiniCartSlideOver = dynamic(
  () =>
    import('@/components/commerce/MiniCartSlideOver').then(
      (m) => m.MiniCartSlideOver,
    ),
  { ssr: false },
);

export default async function KitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const product = await buildKitPublicProduct();

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
        <AddToCartButton
          product={product}
          size="md"
          fullWidth={false}
          redirectTo="/panier"
        >
          Commander
        </AddToCartButton>
      </StickyCartCTA>
      <MiniCartSlideOver />
    </ToastProvider>
  );
}
