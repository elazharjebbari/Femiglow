'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import type { CheckoutPaymentMethod } from '@/lib/schemas';

interface PaymentOption {
  value: CheckoutPaymentMethod;
  title: string;
  hint: string;
  icon: 'cod' | 'card' | 'cmi';
}

const orderedOptions: ReadonlyArray<PaymentOption> = [
  {
    value: 'cod',
    title: 'Paiement à la livraison',
    hint: 'Réglez en main propre au coursier.',
    icon: 'cod',
  },
  {
    value: 'card',
    title: 'Carte bancaire',
    hint: 'Visa, Mastercard — bientôt disponible.',
    icon: 'card',
  },
  {
    value: 'cmi',
    title: 'Carte marocaine (CMI)',
    hint: 'Banques marocaines — bientôt disponible.',
    icon: 'cmi',
  },
];

interface PaymentMethodSelectorProps {
  name: string;
  value: CheckoutPaymentMethod;
  onChange: (value: CheckoutPaymentMethod) => void;
  onBlur?: () => void;
}

export const PaymentMethodSelector = forwardRef<
  HTMLDivElement,
  PaymentMethodSelectorProps
>(function PaymentMethodSelector({ name, value, onChange, onBlur }, ref) {
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Moyen de paiement"
      className="grid gap-3 lg:grid-cols-3"
    >
      {orderedOptions.map((opt) => {
        const checked = value === opt.value;
        const disabled = opt.value !== 'cod';
        return (
          <label
            key={opt.value}
            className={cn(
              'flex min-h-[96px] cursor-pointer flex-col gap-2 border px-4 py-3 transition-colors',
              disabled && 'cursor-not-allowed opacity-40',
              !disabled &&
                (checked
                  ? 'border-encre bg-encre/5'
                  : 'border-encre/15 hover:border-encre/30'),
              disabled && 'border-encre/10',
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
                disabled={disabled}
                className="h-4 w-4 accent-encre"
              />
              <PaymentIcon kind={opt.icon} />
              <span className="font-medium text-encre">{opt.title}</span>
            </span>
            <span className="ps-7 text-xs text-encre/60">{opt.hint}</span>
          </label>
        );
      })}
    </div>
  );
});

function PaymentIcon({ kind }: { kind: PaymentOption['icon'] }) {
  if (kind === 'cod') {
    return (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-encre/70"
      >
        <rect x="2.5" y="5" width="13" height="9" rx="1" />
        <path d="M5 9h2M11 9h2" />
      </svg>
    );
  }
  if (kind === 'card') {
    return (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-encre/70"
      >
        <rect x="2" y="4" width="14" height="10" rx="1" />
        <path d="M2 7.5h14" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-encre/70"
    >
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 2.5v13M2.5 9h13" />
    </svg>
  );
}

export function getPaymentOptions(): ReadonlyArray<PaymentOption> {
  return orderedOptions;
}