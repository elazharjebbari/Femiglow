import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-encre text-creme hover:-translate-y-px active:translate-y-0 active:brightness-95',
  secondary:
    'bg-transparent text-encre border border-encre hover:bg-encre hover:text-creme',
  ghost: 'bg-transparent text-encre hover:bg-encre/5',
  link:
    'bg-transparent text-encre underline underline-offset-4 decoration-encre/40 hover:decoration-encre p-0',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-11 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-14 px-8 text-base',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  extra?: string,
): string {
  const isLink = variant === 'link';
  return cn(
    'inline-flex items-center justify-center gap-2 font-medium tracking-tight',
    'transition-all duration-base ease-out-soft',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]',
    'focus-visible:outline-encre disabled:opacity-40 disabled:cursor-not-allowed',
    !isLink && sizeClasses[size],
    variantClasses[variant],
    fullWidth && 'w-full',
    extra,
  );
}

const Spinner = () => (
  <span
    aria-hidden="true"
    className="inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
  />
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading,
      iconLeading,
      iconTrailing,
      children,
      className,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...rest}
      >
        {loading ? <Spinner /> : iconLeading && <span aria-hidden="true">{iconLeading}</span>}
        <span>{loading ? 'Un instant…' : children}</span>
        {iconTrailing && !loading && <span aria-hidden="true">{iconTrailing}</span>}
      </button>
    );
  },
);
