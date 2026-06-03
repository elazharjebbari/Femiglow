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
  /**
   * Phase 3 — crédit de fidélité appliqué (centimes). Le total affiché devient
   * `totalCents − min(credit, totalCents)` et une ligne « Crédit … » apparaît.
   * Défaut 0 → rendu strictement inchangé (non-régression).
   */
  appliedCreditCents?: number;
  /** Libellé localisé de la ligne crédit. */
  creditLabel?: (amount: string) => string;
  /**
   * Coupon d'accueil résolu serveur. `active` ⇔ welcome_auto actif (treatment).
   * Quand actif ET qu'une économie existe (compareAtTotalCents − totalCents > 0),
   * on affiche une ligne calme « geste d'accueil · Économie X » (mise en récit
   * de la remise, sans second objet saillant). Défaut absent → rendu inchangé.
   */
  welcomeCoupon?: { active: boolean; postPurchaseCreditCents?: number };
  /** Libellé localisé long (desktop) « Votre geste d'accueil est appliqué ». */
  welcomeLabel?: string;
  /** Libellé court (mobile) « Geste d'accueil ». */
  welcomeLabelShort?: string;
  /** Libellé localisé « Économie {montant} » (desktop). */
  economyLabel?: (amount: string) => string;
  /** Libellé localisé du clin d'œil crédit fidélité post-achat. */
  forwardCreditLabel?: (amount: string) => string;
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
  appliedCreditCents = 0,
  creditLabel = (amount) => `Crédit fidélité −${amount}`,
  welcomeCoupon,
  welcomeLabel = 'Votre geste d’accueil est appliqué',
  welcomeLabelShort = 'Geste d’accueil',
  economyLabel = (amount) => `Économie ${amount}`,
  forwardCreditLabel = (amount) => `Et un crédit de ${amount} vous attend après cette commande.`,
}: WizardCartRecapProps): JSX.Element | null {
  if (!cart || !cart.items || cart.items.length === 0) return null;

  const totalQty = cart.items.reduce((acc, it) => acc + it.quantity, 0);
  // Phase 9 — devise localisée : on substitue le code `cart.currency` par le
  // libellé localisé (درهم sur /ar). Les chiffres restent latins (marque).
  const currencyDisplay = currencyLabel ?? cart.currency;
  // Phase 3 — crédit fidélité plafonné au total (jamais négatif).
  const credit = Math.max(0, Math.min(appliedCreditCents, cart.totalCents));
  const totalAfterCredit = cart.totalCents - credit;
  const totalLabel = `${(totalAfterCredit / 100).toFixed(0)} ${currencyDisplay}`;
  const creditLineLabel =
    credit > 0 ? creditLabel(`${(credit / 100).toFixed(0)} ${currencyDisplay}`) : null;
  // Coupon d'accueil : économie absolue (Kolenda Pricing §6) déjà portée par le
  // snapshot. On met en récit la remise SANS nouvel objet saillant ni % ni rouge.
  const welcomeEconomyCents = cart.compareAtTotalCents
    ? cart.compareAtTotalCents - cart.totalCents
    : 0;
  const showWelcome = !!welcomeCoupon?.active && welcomeEconomyCents > 0;
  const welcomeEconomyAmount = `${(welcomeEconomyCents / 100).toFixed(0)} ${currencyDisplay}`;
  // Clin d'œil crédit fidélité post-achat (forward, pas une 2ᵉ remise sur CE
  // panier → conforme coupon-doc). Affiché si un template post_purchase actif.
  const forwardCreditCents = welcomeCoupon?.postPurchaseCreditCents ?? 0;
  const forwardCreditLine =
    showWelcome && forwardCreditCents > 0
      ? forwardCreditLabel(`${(forwardCreditCents / 100).toFixed(0)} ${currencyDisplay}`)
      : null;
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
          {/* Coupon d'accueil — état « appliqué » explicite : coche fine sauge
              (signal de succès) + économie absolue (Kolenda Pricing §6) en
              accent terracotta. « 90 MAD » insécable (anti-casse mobile). Pas
              de %, pas de rouge, pas de sticker, pas d'emoji. */}
          {showWelcome && (
            <p
              className="fg-coupon-line mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs"
              data-testid="wizard-welcome-coupon"
            >
              {/* Médaillon sauge qui éclôt + coche qui se dessine = signal
                  « validé » vivant mais sobre (famille sauge, pas de rouge). */}
              <span
                aria-hidden
                className="fg-coupon-badge flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#A8B89E]/30"
              >
                <svg viewBox="0 0 16 16" width="11" height="11" className="text-[#4A5D4A]">
                  <path
                    d="M4 8.4l2.6 2.6 5.4-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="fg-coupon-check"
                  />
                </svg>
              </span>
              <span className="font-medium text-encre">
                <span className="sm:hidden">{welcomeLabelShort}</span>
                <span className="hidden sm:inline">{welcomeLabel}</span>
              </span>
              <span aria-hidden className="text-encre/25">·</span>
              <span
                className="fg-coupon-eco whitespace-nowrap font-semibold tabular-nums text-[#C28A6E]"
                data-testid="wizard-welcome-economy"
              >
                <span className="sm:hidden">−{welcomeEconomyAmount}</span>
                <span className="hidden sm:inline">{economyLabel(welcomeEconomyAmount)}</span>
              </span>
            </p>
          )}
          {forwardCreditLine && (
            <p
              className="text-[11px] leading-snug text-encre/55"
              data-testid="wizard-welcome-forward"
            >
              {forwardCreditLine}
            </p>
          )}
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
        {creditLineLabel && (
          <p
            className="text-xs text-sauge sm:text-right"
            data-testid="wizard-credit-line"
          >
            {creditLineLabel}
          </p>
        )}
      </div>
    </aside>
  );
}
