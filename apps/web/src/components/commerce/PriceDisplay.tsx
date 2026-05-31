/**
 * <PriceDisplay> — affichage du prix produit, avec ou sans promo.
 *
 * Charte FemiGlow + tactiques Kolenda Pricing
 * -------------------------------------------
 * La charte (II.5, VII.3) interdit le vocabulaire « solde / promo / offre
 * flash » et toute couleur criarde. Kolenda recommande de différencier
 * visuellement le prix barré du prix actif (#3), de réduire le symbole
 * devise (#7), d'introduire un espace entre les deux (#10) et de privilégier
 * le framing montant ou % selon le panier (#34).
 *
 * Compromis retenu :
 *  - prix barré en `text-encre/50` (ton « brume » de la charte, sans rouge
 *    agressif — l'œil distingue par contraste de luminance + barré),
 *  - prix actif en `text-encre` Cormorant — typo emblématique de la marque,
 *  - mention « Économisez … » sous le bloc, en small caps `text-encre/50` —
 *    informe sans crier,
 *  - aucun badge « SOLDES », aucun countdown.
 *
 * Réutilisation
 *  - public : <HeroProduit>, <StickyCartCTA>, fiche produit catalogue,
 *  - admin : panneau « Vitrine » de <VariantsEditor>.
 */
'use client';

import { usePathname } from 'next/navigation';

import { computePromo, formatPromoSavings } from '@/lib/utils/promo';
import { formatPrice } from '@/lib/utils/format-price';
import type { Currency } from '@/lib/products/currency';
import { isLocale } from '@/i18n.config';

/**
 * Phase 9 i18n — lit la locale active de façon résiliente depuis le premier
 * segment du pathname (`/ar/kit` → `ar`). Hors route localisée (admin,
 * legacy `(marketing)`), retourne `undefined` → `formatPrice` conserve sa
 * sortie FR/EN byte-identique (suffixe code ISO `MAD`).
 */
function useActiveLocale(): string | undefined {
  const path = usePathname() ?? '/';
  const first = path.split('/').filter(Boolean)[0];
  return first && isLocale(first) ? first : undefined;
}

export type PriceDisplaySize = 'sm' | 'md' | 'lg' | 'xl';

interface PriceDisplayProps {
  priceCents: number;
  /** `null`/`undefined` → aucun affichage de promo. */
  promoPriceCents?: number | null;
  currency: Currency | string;
  /**
   * Échelle visuelle. `xl` pour le hero, `lg` pour la carte produit, `md`
   * pour la sticky CTA, `sm` pour les listes / synthèses admin.
   */
  size?: PriceDisplaySize;
  /**
   * Affiche la mention « Économisez … » sous les prix quand la promo est
   * active. Désactivable pour les contextes où l'espace est compté
   * (sticky CTA mobile, badges).
   */
  showSavings?: boolean;
  /**
   * Layout :
   *  - `'stack'` : prix actif au-dessus, barré en dessous (hero, carte),
   *  - `'inline'` : barré + actif côte-à-côte (sticky CTA, synthèse admin).
   */
  layout?: 'stack' | 'inline';
  /** Classe CSS additionnelle sur le wrapper. */
  className?: string;
}

const SIZE_CLASSES: Record<
  PriceDisplaySize,
  { active: string; original: string; savings: string }
> = {
  sm: {
    active: 'text-base',
    original: 'text-xs',
    savings: 'text-[10px] tracking-[0.16em]',
  },
  md: {
    active: 'text-lg',
    original: 'text-sm',
    savings: 'text-[10px] tracking-[0.18em]',
  },
  lg: {
    active: 'text-2xl',
    original: 'text-base',
    savings: 'text-[11px] tracking-[0.2em]',
  },
  xl: {
    active: 'text-3xl sm:text-4xl',
    original: 'text-lg sm:text-xl',
    savings: 'text-xs tracking-[0.22em]',
  },
};

export function PriceDisplay({
  priceCents,
  promoPriceCents = null,
  currency,
  size = 'lg',
  showSavings = true,
  layout = 'stack',
  className,
}: PriceDisplayProps) {
  const locale = useActiveLocale();
  const promo = computePromo(priceCents, promoPriceCents);
  const sizes = SIZE_CLASSES[size];
  // Wrapper locale-aware : `formatPromoSavings` consomme un `(cents, currency)`
  // → on injecte la locale active pour le suffixe arabe (درهم) sur /ar.
  const fmt = (cents: number, cur: Currency | string) =>
    formatPrice(cents, cur, locale);
  const savingsLabel = showSavings
    ? formatPromoSavings(promo, currency, fmt)
    : null;

  // -- Cas sans promo : un seul prix ---------------------------------------
  if (!promo.active) {
    return (
      <span
        className={[
          'font-display text-encre [font-feature-settings:\'tnum\',\'lnum\']',
          sizes.active,
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={`Prix : ${fmt(priceCents, currency)}`}
      >
        {fmt(priceCents, currency)}
      </span>
    );
  }

  // -- Cas promo active : prix actif + prix barré --------------------------
  // Kolenda #10 : on insère un gap visuel pour amplifier la perception de
  // remise (Mueller-Lyer). On reste en encre/brume pour respecter la charte.
  const wrapperClass = [
    'inline-flex flex-col gap-1',
    layout === 'inline' ? 'sm:flex-row sm:items-baseline sm:gap-3' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={wrapperClass}
      aria-label={`Prix : ${fmt(promo.effectivePriceCents, currency)}, prix initial ${fmt(promo.originalPriceCents, currency)}`}
    >
      <span
        className={[
          'flex items-baseline gap-2',
          layout === 'inline' ? '' : 'flex-wrap',
        ].join(' ')}
      >
        <span
          className={[
            'font-display text-encre [font-feature-settings:\'tnum\',\'lnum\']',
            sizes.active,
          ].join(' ')}
        >
          {fmt(promo.effectivePriceCents, currency)}
        </span>
        <span
          // Prix barré : on garde la même typo Cormorant, en plus petit, en
          // brume + barré. Pas de rouge — on signale l'avant-après par le
          // contraste typo + ligne barrée, conforme à la charte.
          className={[
            'font-display text-encre/50 line-through [font-feature-settings:\'tnum\',\'lnum\']',
            sizes.original,
          ].join(' ')}
          aria-hidden="true"
        >
          {fmt(promo.originalPriceCents, currency)}
        </span>
      </span>
      {savingsLabel ? (
        <span
          className={[
            'font-sans uppercase text-encre/50',
            sizes.savings,
            layout === 'inline' ? 'sm:self-center' : '',
          ].join(' ')}
        >
          {savingsLabel}
        </span>
      ) : null}
    </span>
  );
}
