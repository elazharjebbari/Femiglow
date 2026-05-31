'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ShippingMode } from '@/lib/schemas';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';

interface OptionConfig {
  value: ShippingMode;
  title: string;
  hint: string;
  price: string;
}

interface ShippingModeSelectorProps {
  options: ReadonlyArray<OptionConfig>;
  name: string;
  value: ShippingMode;
  onChange: (value: ShippingMode) => void;
  onBlur?: () => void;
  disabledExpress?: boolean;
  freeShipping?: boolean;
}

export const ShippingModeSelector = forwardRef<
  HTMLDivElement,
  ShippingModeSelectorProps
>(function ShippingModeSelector(
  { options, name, value, onChange, onBlur, disabledExpress, freeShipping = false },
  ref,
) {
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Mode de livraison"
      className="grid gap-3 sm:grid-cols-2"
    >
      {options.map((opt) => {
        const isDisabled = opt.value === 'express' && disabledExpress;
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex min-h-[88px] cursor-pointer flex-col gap-1 border px-4 py-3 transition-colors',
              checked && !isDisabled && 'border-encre bg-encre/5',
              !checked && !isDisabled && 'border-encre/15 hover:border-encre/30',
              isDisabled && 'border-encre/10 bg-encre/[0.02] opacity-60 cursor-not-allowed',
            )}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                onBlur={onBlur}
                disabled={isDisabled}
                className="h-4 w-4 accent-encre"
              />
              <span className="font-medium text-encre">{opt.title}</span>
              <span className="ms-auto text-sm text-encre/70">
                <ShippingPriceDisplay
                  displayPrice={opt.price}
                  freeShipping={freeShipping}
                  size="sm"
                  align="right"
                />
              </span>
            </span>
            <span className="ps-7 text-xs text-encre/60">{opt.hint}</span>
          </label>
        );
      })}
    </div>
  );
});
