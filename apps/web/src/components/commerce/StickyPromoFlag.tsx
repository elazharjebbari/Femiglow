'use client';

/**
 * `StickyPromoFlag` — onglet « Code GLOW99 appliqué » qui sort du bord
 * supérieur de la sticky d'achat.
 *
 * Rendu UNIQUEMENT quand un code marketing (`isPromo`) réduit réellement le
 * prix : sans code, le composant renvoie `null` et la sticky reste bit-à-bit
 * identique (cf. règle d'usage de `use-applied-coupon`).
 *
 * Pourquoi un onglet au-dessus de la barre plutôt qu'une puce dans la barre :
 * la colonne prix fait ~190 px à 375 px de large, une puce y tronquerait le nom
 * du pack ou le prix. L'onglet ne prend aucune place à la barre, reste attaché
 * à l'offre (il « pousse » du filet de la barre) et se lit avant le bouton.
 *
 * Mouvement (une seule fois, à l'apparition de la barre) : l'onglet monte et
 * apparaît, la coche se trace, un reflet unique traverse la puce. Au survol :
 * léger soulèvement et le reflet repasse. Au clic : onde autour de la coche,
 * message « déjà appliqué » puis scroll vers le formulaire.
 * `prefers-reduced-motion` : aucune animation, rendu final direct.
 *
 * Positionné en `left` PHYSIQUE (comme le lanceur du chat est forcé à droite
 * physique) : en RTL l'onglet reste loin du lanceur.
 *
 * Couleurs translucides en valeurs littérales : les tokens `var(--…)` ne
 * supportent pas le modificateur d’opacité Tailwind (`/20` ne génère rien).
 */

import { useCallback, useState } from 'react';

import { scrollToCommander } from '@/components/commerce/CommanderAnchorButton';
import { useOptionalToast } from '@/components/ui/Toast';
import type { Currency } from '@/lib/products/currency';
import { useAppliedCoupon } from '@/lib/checkout/state/use-applied-coupon';
import { useTracking } from '@/lib/tracking/use-tracking';
import { formatPrice } from '@/lib/utils/format-price';
import { cn } from '@/lib/utils/cn';

export interface StickyPromoFlagStrings {
  /** « Code {code} appliqué ». */
  label: string;
  /** Message du clic : « Votre code {code} est déjà appliqué : −{amount}… ». */
  toast: string;
  /** Nom accessible : « Code {code} appliqué, {amount} déduits. Aller au formulaire. » */
  aria: string;
}

export const DEFAULT_STICKY_PROMO_FLAG_STRINGS: StickyPromoFlagStrings = {
  label: 'Code {code} appliqué',
  toast: 'Votre code {code} est déjà appliqué : −{amount} sur votre commande. Il ne reste qu’à la confirmer.',
  aria: 'Code {code} appliqué, {amount} déduits. Aller au formulaire de commande.',
};

interface StickyPromoFlagProps {
  currency: Currency;
  locale?: string;
  strings?: StickyPromoFlagStrings;
  anchorId?: string;
}

/** Toast mobile (3 lignes ≈ 84 px) + marge : laissé libre au-dessus de la sticky. */
const TOAST_RESERVE_PX = 96;

function fill(template: string, code: string, amount: string): string {
  return template.replace('{code}', code).replace('{amount}', amount);
}

export function StickyPromoFlag({
  currency,
  locale,
  strings = DEFAULT_STICKY_PROMO_FLAG_STRINGS,
  anchorId = 'commander-femiglow',
}: StickyPromoFlagProps) {
  const coupon = useAppliedCoupon();
  const toast = useOptionalToast();
  const { emit } = useTracking();
  // Incrémenté à chaque clic : la `key` remonte l'onde, qui rejoue son animation.
  const [ripple, setRipple] = useState(0);

  const code = coupon.code ?? '';
  const amount = formatPrice(coupon.creditCents, currency, locale);

  const onClick = useCallback(() => {
    setRipple((n) => n + 1);
    toast?.show(fill(strings.toast, code, amount));
    emit('cta_click', {
      cta_intent: 'promo_flag',
      label: code,
      destination: `#${anchorId}`,
      component_id: 'sticky_promo_flag',
    });
    // Défilement lancé DANS le geste : différé (setTimeout), un défilement
    // `smooth` peut être ignoré par certains navigateurs. L'onde reste visible
    // (la sticky ne bouge pas pendant le trajet).
    scrollToCommander(anchorId, toast ? { extraBottomInset: TOAST_RESERVE_PX } : undefined);
  }, [toast, strings.toast, code, amount, emit, anchorId]);

  if (!coupon.hasDiscount || !coupon.isPromo || !code) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={fill(strings.aria, code, amount)}
      data-testid="sticky-promo-flag"
      className={cn(
        // Onglet posé sur le filet supérieur de la barre (-1px : il recouvre le
        // filet, l'onglet semble pousser de la barre).
        'group/flag absolute bottom-full left-4 -mb-px lg:left-3',
        'inline-flex h-7 items-center gap-1.5 rounded-t-lg border border-b-0 border-[rgba(79,109,82,0.22)] bg-creme ps-1.5 pe-2.5',
        'shadow-[0_-6px_14px_-8px_rgba(79,109,82,0.35)]',
        'transition-[transform,background-color,border-color,box-shadow] duration-fast ease-out-soft',
        'hover:-translate-y-px hover:border-[rgba(79,109,82,0.45)] hover:bg-[#EEF4EC] hover:shadow-[0_-8px_18px_-8px_rgba(79,109,82,0.45)]',
        'active:translate-y-0 active:scale-[0.97] active:duration-instant',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge-dark',
        // Entrée rejouée à chaque apparition de la barre (data-visible du parent).
        'motion-safe:group-data-[visible=true]/sticky:animate-promo-flag-in',
      )}
    >
      {/* Reflet : clippé par son propre conteneur (le bouton garde son ombre). */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-lg">
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-1/3 -translate-x-[120%] -skew-x-12',
            'bg-gradient-to-r from-transparent via-[rgba(232,217,188,0.85)] to-transparent',
            'motion-safe:group-data-[visible=true]/sticky:animate-promo-sheen',
            'motion-safe:group-hover/flag:animate-promo-sheen-hover',
          )}
        />
      </span>

      <span aria-hidden="true" className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        {ripple > 0 ? (
          <span
            key={ripple}
            className="absolute inset-0 rounded-full bg-sauge-dark motion-safe:animate-promo-ring motion-reduce:hidden"
          />
        ) : null}
        <span className="absolute inset-0 rounded-full bg-sauge-dark" />
        <svg viewBox="0 0 16 16" width="10" height="10" className="relative text-creme" focusable="false">
          <path
            d="M4 8.4l2.6 2.6 5.4-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="12"
            className="motion-safe:group-data-[visible=true]/sticky:animate-promo-check-draw"
          />
        </svg>
      </span>

      <span
        className="relative whitespace-nowrap text-[10.5px] font-medium uppercase leading-none tracking-[0.14em] text-sauge-dark rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
        data-testid="sticky-promo-flag-label"
      >
        {fill(strings.label, '\u0000', amount)
          .split('\u0000')
          .flatMap((part, i) =>
            i === 0
              ? [part]
              : [
                  <span key={i} className="font-semibold text-encre [font-feature-settings:'tnum']" dir="ltr">
                    {code}
                  </span>,
                  part,
                ],
          )}
      </span>

      <svg
        viewBox="0 0 16 16"
        width="10"
        height="10"
        aria-hidden="true"
        focusable="false"
        className="relative -me-0.5 text-[rgba(79,109,82,0.6)] transition-transform duration-fast ease-out-soft group-hover/flag:translate-x-0.5 group-hover/flag:text-sauge-dark rtl:rotate-180 rtl:group-hover/flag:-translate-x-0.5"
      >
        <path
          d="M6 3.5L10.5 8 6 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
