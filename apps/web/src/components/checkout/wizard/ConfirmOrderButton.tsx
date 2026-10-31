'use client';

import { forwardRef, type MouseEventHandler, type PointerEventHandler } from 'react';

import type { AddressPhase } from '@/lib/checkout/address/address-phase';
import { cn } from '@/lib/utils/cn';

export interface ConfirmOrderButtonProps {
  phase: AddressPhase;
  label: string;
  /** Formulaire visé : le bouton vit hors du `<form>`, dans la barre. */
  formId: string;
  /** Hauteur réduite, clavier ouvert. */
  compact?: boolean;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onClick: MouseEventHandler<HTMLButtonElement>;
}

function ParcelIcon() {
  return (
    <svg
      className="fg-cta-icon"
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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

/**
 * CTA de l'étape 2. Jamais grisé : tant que le formulaire est incomplet, il
 * nomme ce qu'il reste à faire et y amène. Réservé à la confirmation, le
 * grenat n'apparaît qu'à l'état `ready` (cf. `.fg-cta` dans `globals.css`).
 */
export const ConfirmOrderButton = forwardRef<HTMLButtonElement, ConfirmOrderButtonProps>(
  function ConfirmOrderButton(
    { phase, label, formId, compact, onPointerDown, onClick },
    ref,
  ) {
    const submitting = phase === 'submitting';
    return (
      <>
        <button
          ref={ref}
          type="submit"
          form={formId}
          onPointerDown={onPointerDown}
          onClick={onClick}
          disabled={submitting}
          aria-busy={submitting || undefined}
          data-phase={phase}
          data-testid="wizard-address-submit"
          className={cn('fg-cta', compact && 'fg-cta--compact')}
        >
          <span className="fg-cta-badge">
            {submitting ? (
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
              />
            ) : (
              <ParcelIcon />
            )}
          </span>
          <span className="fg-cta-label">{label}</span>
        </button>
        {/* Annonce au lecteur d'écran, seulement au passage à l'état prêt. */}
        <span className="sr-only" aria-live="polite">
          {phase === 'ready' ? label : ''}
        </span>
      </>
    );
  },
);
