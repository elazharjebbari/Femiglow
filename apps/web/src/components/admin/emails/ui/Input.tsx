/**
 * Input / SearchInput — contrôle de saisie texte du socle emails (charte 09
 * §A.2/§A.4). Bordure stone + RADIUS + token FOCUS unique (l'anneau de focus
 * n'est plus oublié sur les champs nus — cf. revue adversariale P3.0-c).
 *
 * Présentationnel : se combine avec Field (label/aria) ou s'utilise seul avec
 * un `aria-label`. L'assistance de saisie (G11) se branche au-dessus via
 * EntityCombobox quand la valeur est une entité.
 */
'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { FOCUS, RADIUS } from './tokens';

const BASE = `w-full border border-stone-300 px-3 py-1.5 text-sm ${RADIUS.control} ${FOCUS} disabled:cursor-not-allowed disabled:bg-stone-50`;

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', type = 'text', ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={`${BASE} ${className}`} {...rest} />;
});
