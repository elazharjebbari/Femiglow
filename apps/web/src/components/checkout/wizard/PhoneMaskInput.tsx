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
import { formatPhoneFR, toLocalMoroccanDigits } from '@/lib/checkout/helpers/phone-mask';

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
        ? formatPhoneFR(toLocalMoroccanDigits(value))
        : typeof defaultValue === 'string'
          ? formatPhoneFR(toLocalMoroccanDigits(defaultValue))
          : '';
    const [displayValue, setDisplayValue] = useState<string>(initial);

    // Sync displayValue si le parent change la valeur (ex. reset après refresh).
    useEffect(() => {
      if (typeof value === 'string') {
        setDisplayValue(formatPhoneFR(toLocalMoroccanDigits(value)));
      }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      // Normalise d'abord (international `+212`/`00212` → local) AVANT de masquer,
      // sinon les formats internationaux sont tronqués à 10 chiffres → illisible.
      const local = toLocalMoroccanDigits(e.target.value);
      setDisplayValue(formatPhoneFR(local));
      // Remplace la value dans l'événement pour que RHF reçoive la forme locale
      // (chiffres seuls), compatible avec le `.transform` Zod existant.
      e.target.value = local;
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
