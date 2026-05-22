'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, leftAddon, rightAddon, id, className = '', ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = description ? `${inputId}-desc` : undefined;
  const errorId = error ? `${inputId}-err` : undefined;
  return (
    <div className="cs-input-field flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={inputId} className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          'flex items-center gap-2 rounded transition-colors',
          'border bg-cs-bg-elevated',
          error ? 'border-cs-danger' : 'border-cs-border',
          'focus-within:border-cs-accent',
        ].join(' ')}
        style={{ borderRadius: 'var(--cs-radius-sm)' }}
      >
        {leftAddon ? <span className="pl-3 text-cs-fg-muted">{leftAddon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={[describedBy, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={[
            'flex-1 bg-transparent px-3 py-2 text-sm text-cs-fg-primary placeholder:text-cs-fg-muted',
            'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
          {...rest}
        />
        {rightAddon ? <span className="pr-3 text-cs-fg-muted">{rightAddon}</span> : null}
      </div>
      {description && !error ? (
        <p id={describedBy} className="text-xs text-cs-fg-secondary">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-cs-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
