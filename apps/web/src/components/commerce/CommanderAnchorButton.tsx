'use client';

/**
 * CHA-231 — Bouton « Commander » qui scroll-anchor vers la section funnel
 * embarquée (#commander-femiglow). Remplace l'ancien CTA qui redirigeait
 * vers `/panier` — désormais la commande se finalise sans quitter `/kit`.
 *
 * - `scrollIntoView({behavior:'smooth'})` avec fallback instant si
 *   `prefers-reduced-motion` est actif (respect a11y).
 * - Émet l'event tracking `cta_commander_click` (proxy `add_to_cart` côté
 *   GA4 pour conserver la conversion funnel — voir `lib/tracking`).
 * - Évite tout double-tir via la garde busy/timeout standard.
 */

import { useCallback, type ReactNode } from 'react';

import { Button, type ButtonSize } from '@/components/ui/Button';
import { useTracking } from '@/lib/tracking/use-tracking';
import { cn } from '@/lib/utils/cn';

/**
 * Couleur d'accent visuel optionnelle pour personnaliser le CTA selon
 * la section qui le porte (Kolenda §4.6). `undefined` garde le rendu
 * historique (variant `primary` = bg-encre).
 *
 * `sauge-dark` est le défaut Kolenda pour le bloc pack (contraste fort
 * + cohérence palette sauge). Active aussi `motion-safe:animate-soft-pulse`
 * pour un signal d'attention discret.
 */
export type CommanderAnchorAccent = 'sauge-dark' | 'champagne' | 'terracotta';

const accentClasses: Record<CommanderAnchorAccent, string> = {
  // bg-sauge-dark = var(--color-sauge-dark) ≈ #4A5D4F ; texte crème.
  'sauge-dark':
    '!bg-sauge-dark !text-creme hover:!bg-sauge motion-safe:animate-soft-pulse',
  champagne:
    '!bg-champagne-dark !text-creme hover:!bg-champagne',
  // Terracotta = couleur literal #C28A6E (Tailwind opacity-modifier ne
  // supporte pas les CSS vars, cf. bug bg-encre/X documenté).
  terracotta:
    '!bg-[#C28A6E] !text-creme hover:!bg-[#A87356]',
};

interface CommanderAnchorButtonProps {
  /** ID de l'ancre (sans #). Défaut : `commander-femiglow`. */
  anchorId?: string;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: ReactNode;
  /** Données tracking. */
  productId?: string;
  productName?: string;
  priceCents?: number;
  currency?: string;
  /**
   * Accent visuel — change la palette du CTA selon la section.
   * `sauge-dark` active aussi le micro-pulse Kolenda §4.6.
   */
  accent?: CommanderAnchorAccent;
  /**
   * Source tracking pour distinguer les clics CTA selon la section
   * d'origine. Si `'pack_section'` est passé, émet en plus
   * `pack_cta_click` avec `{source, cta_label, cta_accent}`.
   */
  source?: 'pack_section' | 'hero' | string;
  /** Label de tracking explicite (par défaut, le `children` textuel). */
  trackingLabel?: string;
  /**
   * Libellé localisé du bouton. Défaut FR « Commander » — préserve les
   * usages legacy `(marketing)/kit`. Le caller serveur localisé (layout
   * `/[locale]/kit`) passe la traduction `common.commander`. Sert aussi de
   * fallback au label de tracking quand `children` n'est pas une string.
   */
  label?: string;
}

export function CommanderAnchorButton({
  anchorId = 'commander-femiglow',
  size = 'md',
  fullWidth = false,
  children,
  productId,
  productName,
  priceCents,
  currency = 'MAD',
  accent,
  source,
  trackingLabel,
  label = 'Commander',
}: CommanderAnchorButtonProps) {
  const { emit } = useTracking();

  const onClick = useCallback(() => {
    const target = document.getElementById(anchorId);
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (target) {
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      // Focus le wizard sans casser la lecture d'écran : on cible le shell
      // s'il existe pour que la lecture reprenne au step actif.
      const shell = target.querySelector('[data-testid="wizard-shell"]');
      if (shell instanceof HTMLElement) {
        // tabindex=-1 transitoire pour permettre `focus()` programmatique
        shell.setAttribute('tabindex', '-1');
        shell.focus({ preventScroll: true });
      }
    }

    if (priceCents !== undefined && productId && productName) {
      emit('add_to_cart', {
        currency,
        value: priceCents / 100,
        items: [
          {
            item_id: productId,
            item_name: productName,
            quantity: 1,
            price: priceCents / 100,
          },
        ],
      });
    }

    // §4.6 — event spécifique pack_cta_click si le bouton est utilisé
    // dans la section pack. Permet une mesure CTR distincte de l'event
    // ecommerce `add_to_cart` (qui agrège tous les CTA d'ajout).
    if (source === 'pack_section') {
      emit('pack_cta_click', {
        source: 'pack_section',
        cta_label:
          trackingLabel ??
          (typeof children === 'string' ? children : label),
        cta_accent: accent ?? 'default',
      });
    }
  }, [
    anchorId,
    currency,
    emit,
    priceCents,
    productId,
    productName,
    source,
    accent,
    trackingLabel,
    children,
    label,
  ]);

  return (
    <Button
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      onClick={onClick}
      data-testid="kit-commander-anchor-button"
      data-cta-accent={accent ?? undefined}
      data-cta-source={source ?? undefined}
      className={cn(accent && accentClasses[accent])}
    >
      {children ?? label}
    </Button>
  );
}
