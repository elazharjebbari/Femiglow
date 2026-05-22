'use client';

/**
 * Sticky CTA mobile pour la landing /kit v2.
 *
 * Pourquoi ?
 * ──────────
 * En v2, le wizard est en position 6 (vs position 3 en v1). Sur mobile,
 * un utilisateur qui scroll vite peut manquer la zone commande. Le sticky
 * bottom CTA garantit un point d'entrée wizard permanent (`#commander-femiglow`)
 * tout au long du scroll, sans intrusion (caché < lg pour ne pas dupliquer
 * les CTA desktop).
 *
 * Référence Kolenda §5 P1 — *« CTA always-visible mobile »*.
 *
 * Tracking
 * ────────
 * Click fire un event `click` avec :
 *   - element_id = 'kit-sticky-mobile-cta'
 *   - link_url = '#commander-femiglow'
 *
 * Le scroll-into-view est natif (anchor href). Smooth scroll géré par
 * `scroll-behavior: smooth` sur `<html>` (cf. globals.css).
 */
import { useTracking } from '@/lib/tracking/use-tracking';

export function KitStickyMobileCta() {
  const { emit } = useTracking();
  const handleClick = () => {
    emit('click', {
      element_id: 'kit-sticky-mobile-cta',
      element_text: 'Commander · 199 MAD',
      link_url: '#commander-femiglow',
      source: 'sticky',
    });
  };

  return (
    <a
      href="#commander-femiglow"
      data-testid="kit-sticky-mobile-cta"
      onClick={handleClick}
      // Sticky bottom mobile uniquement. Le 'translate-z-0' force GPU
      // composite pour éviter le repaint pendant le scroll iOS Safari.
      className={[
        'fixed inset-x-3 bottom-3 z-40 flex items-center justify-center gap-2',
        'rounded-full bg-encre px-6 py-3 text-sm font-medium text-creme shadow-lg',
        'transition-transform active:scale-[0.98]',
        'lg:hidden',
      ].join(' ')}
    >
      <span aria-hidden="true">→</span>
      <span>Commander · 199 MAD</span>
    </a>
  );
}
