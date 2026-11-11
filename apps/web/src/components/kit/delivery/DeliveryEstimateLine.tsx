'use client';

/**
 * Ligne livraison collée au prix (hero /kit) : la livraison a l'apparence d'un
 * prix et se lit avec lui (Kolenda, Visual Attention p. 54-55). Avant le choix
 * de la ville : « Livraison 19 à 45 MAD selon votre ville · Ma ville ». Après :
 * « Livraison à Rabat · 35 MAD · Changer » et « Total à la réception 234 MAD ».
 */

import { useState } from 'react';

import { DeliveryCitySheet } from '@/components/kit/delivery/DeliveryCitySheet';
import {
  formatMad,
  useDeliveryEstimate,
} from '@/lib/checkout/delivery/delivery-estimate';
import {
  getWizardDictionary,
  type DictionaryLanguage,
} from '@/lib/checkout/i18n/dictionary';
import { cn } from '@/lib/utils/cn';

export interface DeliveryEstimateLineProps {
  /** Prix du kit affiché, remises déduites (centimes). */
  productCents: number;
  language: DictionaryLanguage;
  className?: string;
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden className="shrink-0 text-sauge-dark">
      <path
        d="M2.5 5.5h9v8h-9zM11.5 8.5h3.2l2.8 2.9v2.1h-6M5.5 15.5a1.5 1.5 0 1 0 0-.01M14.5 15.5a1.5 1.5 0 1 0 0-.01"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeliveryEstimateLine({ productCents, language, className }: DeliveryEstimateLineProps) {
  const copy = getWizardDictionary(language).deliveryEstimate;
  const estimate = useDeliveryEstimate(productCents, language);
  const [open, setOpen] = useState(false);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const linkClass =
    '-my-2 inline-flex min-h-[44px] shrink-0 items-center px-1 text-[14px] font-medium text-sauge-dark underline decoration-sauge-dark/40 underline-offset-4 hover:decoration-sauge-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre';

  return (
    <div className={cn('space-y-1.5', className)} dir={dir} data-testid="delivery-estimate" data-known={estimate.known}>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-encre/10 bg-creme px-3.5 py-2.5">
        <p className="flex min-w-0 items-center gap-2.5 text-[14px] leading-snug text-encre/75">
          <TruckIcon />
          {estimate.known && estimate.cityName ? (
            <span className="min-w-0">
              {copy.toCity(estimate.cityName)}
              {' · '}
              <span
                dir="ltr"
                key={estimate.shippingCents ?? 'x'}
                className="fg-amount-in whitespace-nowrap px-0.5 font-medium tabular-nums text-encre"
                data-testid="delivery-estimate-amount"
              >
                {estimate.shippingCents === 0 ? copy.free : formatMad(estimate.shippingCents ?? 0, language)}
              </span>
            </span>
          ) : (
            <span className="min-w-0">
              {estimate.freeShipping ? (
                <span className="font-medium text-encre">{copy.free}</span>
              ) : (
                <>
                  {copy.label}{' '}
                  <span className="font-medium tabular-nums text-encre" data-testid="delivery-estimate-range">
                    {estimate.rangeLabel}
                  </span>
                </>
              )}
            </span>
          )}
        </p>
        {!estimate.freeShipping && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={linkClass}
            data-testid="delivery-estimate-open"
            aria-haspopup="dialog"
          >
            {estimate.known ? copy.change : copy.chooseCity}
          </button>
        )}
      </div>

      {estimate.known && estimate.totalCents !== null && (
        <p className="px-1 text-[14px] text-encre/75" data-testid="delivery-estimate-total">
          {copy.totalLabel}{' '}
          <span dir="ltr" key={estimate.totalCents} className="fg-amount-in whitespace-nowrap px-0.5 font-medium tabular-nums text-encre">
            {formatMad(estimate.totalCents, language)}
          </span>
          {estimate.eta ? <span className="text-encre/60"> · {estimate.eta}</span> : null}
        </p>
      )}

      <DeliveryCitySheet
        open={open}
        onOpenChange={setOpen}
        productCents={productCents}
        language={language}
      />
    </div>
  );
}
