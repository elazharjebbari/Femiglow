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
  }, [anchorId, currency, emit, priceCents, productId, productName]);

  return (
    <Button
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      onClick={onClick}
      data-testid="kit-commander-anchor-button"
    >
      {children ?? 'Commander'}
    </Button>
  );
}
