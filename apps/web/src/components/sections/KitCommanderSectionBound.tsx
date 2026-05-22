/**
 * CHA-231 — Server Component wrapper qui construit le snapshot panier du
 * rituel FemiGlow et le passe au `KitCommanderSection` client.
 *
 * Source unique :
 *  - Lit le produit DB via `getKitProductCached` (`unstable_cache` + tags).
 *  - Fallback `mockKit` si la base est vide ou le produit non publié.
 *  - SKU primaire + prix DB → `CartSnapshot`. Si le SKU manque (mock pur
 *    sans variantes), on tombe sur les constantes mock (SKU/price connu).
 *
 * Pourquoi un wrapper ?
 *  - Le composant `KitPage` (Server) ne doit pas accumuler la logique de
 *    construction du cart snapshot ; on centralise ici pour réutilisation
 *    éventuelle (page promo, landing, etc.).
 */
import { mockKit } from '@/data/mock';
import {
  KIT_PRODUCT_SLUG,
  getKitProductCached,
} from '@/lib/products/public';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import { projectCartSnapshotFromVariant } from '@/lib/checkout/helpers/cart-snapshot-builder';

// Fallback fixe utilisé UNIQUEMENT si la DB est vide ou le produit non publié
// (env. local sans seed, snapshot mock). On garde la valeur stable pour ne pas
// casser les tests d'intégration qui ciblent ce variantId.
const FALLBACK_KIT_VARIANT_ID = 'pvar_0c01jxc1yn4kjp3b';
const FALLBACK_KIT_SKU = 'FEMI-KIT-100';

import {
  KitCommanderSection,
  type KitCommanderSectionProps,
} from './KitCommanderSection';

interface KitCommanderSectionBoundProps
  extends Omit<KitCommanderSectionProps, 'initialCart'> {
  /**
   * Override optionnel — utile pour les pages de test ou les promos où
   * on veut forcer un snapshot custom. Sinon, on construit automatiquement
   * à partir du DB Product + variantes.
   */
  initialCartOverride?: CartSnapshot;
}

function buildCartSnapshotFromMock(): CartSnapshot {
  // Délégation au helper pur (testé exhaustivement dans
  // `cart-snapshot-builder.test.ts`). Le mock fallback agit comme une
  // "variant DB" synthétique pour réutiliser la même logique compareAt
  // que la branche DB → zéro divergence entre les deux chemins.
  return projectCartSnapshotFromVariant(
    {
      sku: FALLBACK_KIT_SKU,
      priceCents: mockKit.priceCents,
      promoPriceCents: mockKit.promoPriceCents ?? null,
      currency: mockKit.currency,
      variantId: FALLBACK_KIT_VARIANT_ID,
    },
    { productName: mockKit.name },
  );
}

export async function KitCommanderSectionBound({
  initialCartOverride,
  ...rest
}: KitCommanderSectionBoundProps) {
  let initialCart: CartSnapshot;

  if (initialCartOverride) {
    initialCart = initialCartOverride;
  } else {
    const data = await getKitProductCached();
    const primary = data?.variants[0];
    if (!data || data.product.status !== 'published' || !primary) {
      initialCart = buildCartSnapshotFromMock();
    } else {
      // Délégation au helper pur — même contrat compareAt que le mock
      // fallback. Cf. `cart-snapshot-builder.test.ts` pour les 13 cas
      // testés (promo active, no-promo, EUR, multi-qty, etc.).
      initialCart = projectCartSnapshotFromVariant(
        {
          sku: primary.sku,
          priceCents: primary.priceCents,
          promoPriceCents: primary.promoPriceCents,
          currency: primary.currency,
          variantId: primary.id,
        },
        { productName: data.product.title || mockKit.name },
      );
    }
  }

  // Le slug est utile au debug — on ne l'expose pas dans le client pour ne
  // pas grossir le payload, mais on garde la trace serveur via le tag de
  // cache `productTag(KIT_PRODUCT_SLUG)` (déjà géré par `getKitProductCached`).
  void KIT_PRODUCT_SLUG;

  return <KitCommanderSection initialCart={initialCart} {...rest} />;
}
