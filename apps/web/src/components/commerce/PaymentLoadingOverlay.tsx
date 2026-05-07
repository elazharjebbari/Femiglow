'use client';

import { Fleuron } from '@/components/ui/Fleuron';

export function PaymentLoadingOverlay() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-creme/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <span aria-hidden="true" className="motion-safe:animate-pulse">
          <Fleuron tone="champagne" size="md" />
        </span>
        <p className="font-display text-2xl text-encre">Paiement en cours…</p>
        <p className="text-sm text-encre/60">
          Ne fermez pas cette page. La maison confirme votre commande.
        </p>
      </div>
    </div>
  );
}
