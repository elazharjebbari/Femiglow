'use client';

import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { cn } from '@/lib/utils/cn';

/** En deçà, un prix rouge fait baisser les ventes (Kolenda, Pricing p. 15). */
const RED_PRICE_MIN_DISCOUNT = 0.3;

export interface ActionBarTotalProps {
  totalCents: number;
  /** Total sans la remise, `null` sans prix de référence. */
  referenceCents: number | null;
  /** Ligne de remise déjà formatée (« Code GLOW99 : −100 MAD »). */
  promoLine?: string | null;
}

/**
 * Total de la barre d'action, selon Kolenda (`docs/kolenda/Pricing.pdf`) :
 * prix final plus grand et d'une autre couleur que le prix barré (p. 10, 13),
 * les deux sur la même ligne, un peu espacés (p. 23), côté début de ligne
 * (p. 5), devise réduite (p. 17). Le prix ne s'anime pas (p. 33).
 */
export function ActionBarTotal({ totalCents, referenceCents, promoLine }: ActionBarTotalProps) {
  const { t } = useWizardTranslation();
  const copy = t.addressV2;
  const currency = t.cartRecap.currency;
  const reference = referenceCents !== null && referenceCents > totalCents ? referenceCents : null;
  const redPrice =
    reference !== null && (reference - totalCents) / reference >= RED_PRICE_MIN_DISCOUNT;

  return (
    <div data-testid="wizard-action-total">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-encre-soft">
        <span>{copy.totalLabel}</span>
        {promoLine && (
          <span className="font-medium text-sauge-dark" data-testid="wizard-promo-applied">
            {promoLine}
          </span>
        )}
      </p>
      <p dir="ltr" className="flex items-baseline gap-2.5 rtl:flex-row-reverse">
        <span
          className={cn(
            'text-[22px] font-semibold leading-tight tabular-nums',
            redPrice ? 'text-action' : 'text-encre',
          )}
          data-testid="wizard-action-total-amount"
        >
          {(totalCents / 100).toFixed(0)} <span className="text-sm font-medium">{currency}</span>
        </span>
        {reference !== null && (
          <s
            className="text-sm tabular-nums text-encre-soft"
            data-testid="wizard-action-total-reference"
          >
            <span className="sr-only">{copy.insteadOf} </span>
            {(reference / 100).toFixed(0)} {currency}
          </s>
        )}
      </p>
    </div>
  );
}
