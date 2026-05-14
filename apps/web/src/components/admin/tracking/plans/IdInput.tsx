/**
 * Input contrôlé pour les identifiants tracking (GA4, GTM, Meta, …).
 *
 * - Validation live via regex (W-004 du validator côté serveur).
 * - Affiche un message d'aide / d'erreur sous le champ.
 * - Accessibilité : aria-invalid + aria-describedby pour message d'erreur.
 */
'use client';

import { useId } from 'react';

export interface IdInputProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  pattern?: RegExp;
  placeholder?: string;
  hint?: string;
  errorMessage?: string;
  disabled?: boolean;
}

export function IdInput({
  label,
  value,
  onChange,
  pattern,
  placeholder,
  hint,
  errorMessage,
  disabled,
}: IdInputProps): JSX.Element {
  const id = useId();
  const describedById = `${id}-desc`;
  const showFormatError = !!(pattern && value && !pattern.test(value));
  const error = errorMessage ?? (showFormatError ? 'Format invalide.' : null);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={hint || error ? describedById : undefined}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-300'
            : 'border-stone-300 bg-white text-stone-900 focus:ring-emerald-300'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      />
      {(error || hint) && (
        <p
          id={describedById}
          className={`text-xs ${error ? 'text-rose-700' : 'text-stone-500'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
