'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

const variantStyle: Record<Variant, string> = {
  primary: 'bg-cs-accent text-cs-fg-on-accent hover:bg-cs-accent-hover shadow-[0_6px_18px_-6px_rgba(156,42,71,0.45)]',
  secondary: 'bg-cs-fg-primary text-cs-bg-base hover:bg-cs-clay',
  ghost: 'bg-cs-bg-elevated text-cs-fg-primary border border-cs-border-strong hover:border-cs-clay',
  danger: 'bg-cs-danger text-cs-fg-on-accent hover:opacity-90',
  subtle: 'bg-cs-bg-sunken text-cs-fg-primary hover:bg-cs-bg-feature',
};

const sizeStyle: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, rightIcon, loading, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'cs-btn inline-flex items-center justify-center gap-2 rounded font-display transition-all',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cs-border-focus focus-visible:outline-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyle[variant],
        sizeStyle[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span aria-hidden className="cs-spinner" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'cs-spin 0.7s linear infinite' }} />
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

if (typeof document !== 'undefined' && !document.getElementById('cs-spinner-keyframes')) {
  const style = document.createElement('style');
  style.id = 'cs-spinner-keyframes';
  style.textContent = '@keyframes cs-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
