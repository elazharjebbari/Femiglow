/**
 * Button / IconButton — primitives d'action du socle emails (charte 09 §A.2).
 *
 * Casse la duplication des classes de bouton recopiées inline (ConfirmDialog,
 * EmptyState, toast, KpiCards…). Couleurs issues d'ui/tokens.ts (verrou G10) ;
 * focus unique (FOCUS) ; état busy unifié (aria-busy + libellé dédié + 1 seule
 * action garantie par le disabled). data-variant exposé (traçabilité, charte §A.2).
 */
'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { BUTTON, FOCUS, RADIUS, type ButtonVariant } from './tokens';

type Size = 'sm' | 'md';

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

const BASE =
  `inline-flex items-center justify-center gap-1.5 font-medium ${RADIUS.control} ` +
  `transition disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: Size;
  /** Action en vol : aria-busy + libellé `busyLabel` + bouton désactivé. */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy = false, busyLabel, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`${BASE} ${SIZE_CLS[size]} ${BUTTON[variant]} ${className}`}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});

export type IconButtonProps = {
  /** OBLIGATOIRE : un bouton-icône sans nom accessible est interdit (a11y). */
  'aria-label': string;
  variant?: ButtonVariant;
  size?: Size;
  busy?: boolean;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', busy = false, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  const pad = size === 'sm' ? 'p-1' : 'p-1.5';
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center ${pad} ${RADIUS.control} transition disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS} ${BUTTON[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
