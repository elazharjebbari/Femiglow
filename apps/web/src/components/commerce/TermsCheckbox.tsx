'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import Link from 'next/link';

interface TermsCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
}

export const TermsCheckbox = forwardRef<HTMLInputElement, TermsCheckboxProps>(
  function TermsCheckbox({ error, id = 'checkout-consent', ...rest }, ref) {
    return (
      <div className="space-y-2">
        <label htmlFor={id} className="flex items-start gap-3 text-sm text-encre">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-invalid={error ? 'true' : undefined}
            className="mt-1 h-4 w-4 accent-encre"
            {...rest}
          />
          <span>
            J&rsquo;accepte les{' '}
            <Link
              href="/cgv"
              className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              conditions générales de vente
            </Link>{' '}
            et la{' '}
            <Link
              href="/confidentialite"
              className="underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {error && (
          <p role="alert" className="ps-7 text-xs text-petale-dark">
            {error}
          </p>
        )}
      </div>
    );
  },
);
