'use client';

import { useEffect, useRef } from 'react';

/**
 * Bouton de confirmation DANS le formulaire de l'étape 2, juste sous l'adresse.
 *
 * Le bouton de la barre fixe vit en bas de l'écran, loin des champs : une
 * cliente qui vient de saisir son adresse ne comprenait pas qu'il appartenait
 * au formulaire. Dès que l'adresse est saisie, ce bouton apparaît à côté du
 * champ, avec l'action et le montant à payer à la réception. Tant qu'il est à
 * l'écran, la barre fixe s'efface (`onVisibleChange`) : jamais deux boutons
 * identiques en même temps.
 *
 * Même matière que le CTA de la barre (grenat, pastille colis), sur deux
 * lignes, entrée en fondu sans pulsation (cf. `.fg-inline-cta`).
 */

export interface InlineConfirmButtonProps {
  title: string;
  subtitle: string;
  submitting: boolean;
  savingLabel: string;
  onVisibleChange?: (visible: boolean) => void;
}

function ParcelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6L10 2.5Zm0 15V9.75M3.5 6 10 9.75 16.5 6M6.75 4.25l6.5 3.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      className="fg-inline-cta-chevron"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InlineConfirmButton({
  title,
  subtitle,
  submitting,
  savingLabel,
  onVisibleChange,
}: InlineConfirmButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const onVisibleChangeRef = useRef(onVisibleChange);
  onVisibleChangeRef.current = onVisibleChange;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      onVisibleChangeRef.current?.(true);
      return () => onVisibleChangeRef.current?.(false);
    }
    const observer = new IntersectionObserver(
      ([entry]) => onVisibleChangeRef.current?.(Boolean(entry?.isIntersecting)),
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      onVisibleChangeRef.current?.(false);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      disabled={submitting}
      aria-busy={submitting || undefined}
      data-testid="wizard-inline-confirm"
      className="fg-inline-cta lg:hidden"
    >
      <span className="fg-inline-cta-badge">
        {submitting ? (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
          />
        ) : (
          <ParcelIcon />
        )}
      </span>
      <span>
        <span className="fg-inline-cta-title">{submitting ? savingLabel : title}</span>
        <span className="fg-inline-cta-sub">{subtitle}</span>
      </span>
      <Chevron />
    </button>
  );
}
