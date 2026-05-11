'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonSize } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCartStore } from '@/lib/stores/cart-store';
import { useTracking } from '@/lib/tracking/use-tracking';
import { computePromo } from '@/lib/utils/promo';
import type { CartItem, Product } from '@/lib/schemas';

/**
 * @tracking-category cta_primary
 * @tracking-events add_to_cart
 * @tracking-description Bouton principal d'ajout au panier — émet add_to_cart avec items + value.
 */
interface AddToCartButtonProps {
  product: Product;
  quantity?: number;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: ReactNode;
  /**
   * Si fourni, après ajout au panier on redirige vers cette URL au lieu
   * d'ouvrir la `MiniCartSlideOver`. Utilisé sur `/kit` pour envoyer
   * directement vers `/panier` (skip de l'étape intermédiaire).
   */
  redirectTo?: string;
}

export function AddToCartButton({
  product,
  quantity = 1,
  size = 'lg',
  fullWidth = true,
  children,
  redirectTo,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem);
  const addItemAndOpen = useCartStore((s) => s.addItemAndOpen);
  const router = useRouter();
  const { show } = useToast();
  const { emit } = useTracking();
  const [busy, setBusy] = useState(false);

  const onClick = () => {
    if (busy) return; // évite le double tir add_to_cart sur double-tap rapide
    setBusy(true);
    // Si une promo est active, c'est elle qui devient le prix payé : panier,
    // tracking ecommerce et JSON-LD doivent tous refléter ce prix effectif.
    // `computePromo` masque silencieusement les saisies incohérentes
    // (promo >= prix) en retombant sur le prix barré.
    const promo = computePromo(product.priceCents, product.promoPriceCents);
    const unitPriceCents = promo.effectivePriceCents;
    const item: CartItem = {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      quantity,
      unitPriceCents,
      imageSrc: product.images[0]?.src,
    };
    if (redirectTo) {
      addItem(item);
    } else {
      addItemAndOpen(item);
    }
    emit('add_to_cart', {
      currency: product.currency,
      value: (unitPriceCents * quantity) / 100,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          quantity,
          price: unitPriceCents / 100,
          // GA4-friendly : `discount` = remise unitaire en unité majeure,
          // utile pour les rapports promo. `0` quand pas de promo (le champ
          // optionnel reste cohérent côté analytics).
          discount: promo.active ? (promo.savingsCents) / 100 : 0,
        },
      ],
    });
    // Charte VII.5 : on évite « ajouté au panier » (commercial) au profit
    // d'un retour plus brand-aligned.
    show('Ajouté à votre rituel.');
    setBusy(false);
    if (redirectTo) {
      router.push(redirectTo);
    }
  };

  return (
    <Button
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      loading={busy}
      onClick={onClick}
    >
      {children ?? 'Commander le rituel'}
    </Button>
  );
}
