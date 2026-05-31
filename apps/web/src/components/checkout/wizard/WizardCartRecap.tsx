/**
 * `WizardCartRecap` — bandeau récap panier permanent dans le wizard
 * (Kolenda §5 W3, Pricing #6 « cart visible during checkout »).
 *
 * Affiché en premier enfant du `WizardShell` :
 *  - **Mobile (< sm)** : sticky `top-0 z-30`, 1 ligne compacte avec
 *    thumbnail + label + total + barré.
 *  - **Desktop (≥ sm)** : statique, 2 lignes (détail produits sous label).
 *
 * Server Component pur — la cart est passée en prop depuis le serveur
 * (déjà résolue dans `KitCommanderSection.initialCart`).
 */
/* eslint-disable @next/next/no-img-element */
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import { cn } from '@/lib/utils/cn';

export interface WizardCartRecapProps {
  cart: CartSnapshot;
  /** Image packshot pour le thumbnail. */
  thumbnailSrc?: string;
  /** Prix barré « non packagé » pour cohérence avec la section pack. */
  priceCompareAt?: string;
  /** Classes additionnelles sur le wrapper. */
  className?: string;
  /**
   * CHA-232 — Libellés i18n (injectés par le WizardShell client). Server
   * Component pur : on ne peut pas appeler `useWizardTranslation` ici, donc
   * les copies arrivent en props. Les défauts FR conservent le rendu hors
   * contexte (tests, prévisualisation).
   */
  ariaLabel?: string;
  packLabel?: (quantity: number) => string;
  shippingIncludedLabel?: string;
  /**
   * Phase 9 — libellé devise localisé (MAD en fr/en, درهم en ar). Remplace le
   * code `cart.currency` brut dans le total ET le prix barré. Défaut FR = code.
   */
  currencyLabel?: string;
}

export function WizardCartRecap({
  cart,
  // Même packshot que le hero produit (kit-principale.png) → cohérence
  // visuelle tunnel hero → wizard recap. Voir aussi WizardMobilePackThumb
  // qui partage le même default.
  thumbnailSrc = '/products/kit-principale.png',
  priceCompareAt,
  className,
  ariaLabel = 'Récapitulatif de votre commande',
  packLabel = (quantity) => `${quantity} × Pack FemiGlow`,
  shippingIncludedLabel = 'livraison incluse',
  currencyLabel,
}: WizardCartRecapProps): JSX.Element | null {
  if (!cart || !cart.items || cart.items.length === 0) return null;

  const totalQty = cart.items.reduce((acc, it) => acc + it.quantity, 0);
  // Phase 9 — devise localisée : on substitue le code `cart.currency` par le
  // libellé localisé (درهم sur /ar). Les chiffres restent latins (marque).
  const currencyDisplay = currencyLabel ?? cart.currency;
  const totalLabel = `${(cart.totalCents / 100).toFixed(0)} ${currencyDisplay}`;
  // Prix barré localisé : on remplace le code devise brut dans la chaîne déjà
  // formatée (ex. « 289 MAD » → « 289 درهم »).
  const compareAtLabel =
    priceCompareAt && currencyLabel
      ? priceCompareAt.replace(cart.currency, currencyLabel)
      : priceCompareAt;
  const productDetailLabel = cart.items.map((i) => i.name).join(' + ');
  const headLabel = packLabel(totalQty);

  return (
    <aside
      role="region"
      aria-label={ariaLabel}
      data-testid="wizard-cart-recap"
      className={cn(
        // Mobile : sticky top-0 z-30 + backdrop blur + bord bas
        // Desktop : statique, rounded, bordure complète
        'sticky top-0 z-30 -mx-6 -mt-6 mb-2 flex items-center gap-3 border-b border-encre/10 bg-creme/95 px-6 py-3 backdrop-blur',
        'sm:static sm:mx-0 sm:mt-0 sm:rounded sm:border sm:py-4',
        className,
      )}
    >
      <img
        src={thumbnailSrc}
        alt=""
        width={40}
        height={50}
        className="h-12 w-10 shrink-0 rounded object-cover"
      />
      <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-encre">{headLabel}</p>
          <p className="hidden text-xs text-encre/60 sm:block">
            {productDetailLabel} · {shippingIncludedLabel}
          </p>
        </div>
        <p className="flex items-baseline gap-2 text-sm">
          <span
            className="font-medium tabular-nums text-encre"
            data-testid="wizard-cart-recap-total"
          >
            {totalLabel}
          </span>
          {compareAtLabel && (
            <span
              className="text-xs text-encre/40 line-through"
              data-testid="wizard-cart-recap-compare-at"
            >
              {compareAtLabel}
            </span>
          )}
        </p>
      </div>
    </aside>
  );
}
