/**
 * `PhoneMaskInput` — TextField avec masque téléphone live FR
 * `06 12 34 56 78` (Kolenda §5 W4 P5).
 *
 * Comportement :
 *  - Affiche en permanence la valeur **masquée** (avec espaces).
 *  - Renvoie au form parent la valeur **RAW** (sans espaces) pour que
 *    le `.transform` Zod existant continue de fonctionner sans modif.
 *  - Max 10 digits enforcé silencieusement.
 *  - Refuse les caractères non-numériques (ignorés à la saisie).
 *
 * Forward du `ref` natif pour React Hook Form `register`.
 *
 * Client Component (état local `displayValue`).
 */
'use client';

import { forwardRef, useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from 'react';

import { TextField } from '@/components/forms/Field';
import { formatPhoneFR } from '@/lib/checkout/helpers/phone-mask';

export interface PhoneMaskInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Valeur RAW (sans espaces) injectée par le parent (ex. RHF defaultValues). */
  value?: string;
}

export const PhoneMaskInput = forwardRef<HTMLInputElement, PhoneMaskInputProps>(
  function PhoneMaskInput({ value, defaultValue, onChange, ...rest }, ref) {
    const initial =
      typeof value === 'string'
        ? formatPhoneFR(value)
        : typeof defaultValue === 'string'
          ? formatPhoneFR(defaultValue)
          : '';
    const [displayValue, setDisplayValue] = useState<string>(initial);

    // Sync displayValue si le parent change la valeur (ex. reset après refresh).
    useEffect(() => {
      if (typeof value === 'string') {
        setDisplayValue(formatPhoneFR(value));
      }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
      const masked = formatPhoneFR(raw);
      setDisplayValue(masked);
      // Remplace la value RAW dans l'événement pour que RHF reçoive
      // les digits seuls (compat avec le `.transform` Zod existant).
      e.target.value = raw;
      onChange?.(e);
    };

    return (
      <TextField
        {...rest}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={displayValue}
        onChange={handleChange}
      />
    );
  },
);
