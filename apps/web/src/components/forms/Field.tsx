import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
}

export function FieldShell({ id, label, hint, error, required, children, trailing }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-start text-sm font-medium text-encre">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-encre/50">
            *
          </span>
        )}
      </label>
      {children}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hint && !error && (
            <p id={hintId} className="text-xs text-encre/60">
              {hint}
            </p>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-xs text-petale-dark">
              {error}
            </p>
          )}
        </div>
        {trailing && <div className="text-xs text-encre/50">{trailing}</div>}
      </div>
    </div>
  );
}

const inputClasses = cn(
  'w-full bg-creme text-encre',
  'border-b border-encre/30 px-0 py-3',
  'placeholder:text-encre/40',
  'focus:outline-none focus:border-encre focus-visible:ring-0',
  'transition-colors duration-base',
  'aria-[invalid=true]:border-petale-dark',
);

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, hint, error, required, className, ...rest },
  ref,
) {
  if (!id) throw new Error('TextField requires an id for label association.');
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={id}
        // CHA-231 : auto-détection LTR/RTL selon le contenu (utile en bilingue
        // FR/AR). Override possible via prop `dir` sur l'appelant.
        dir="auto"
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  showCounter?: boolean;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    {
      id,
      label,
      hint,
      error,
      required,
      className,
      rows = 5,
      showCounter,
      maxLength,
      defaultValue,
      value,
      onChange,
      ...rest
    },
    ref,
  ) {
    if (!id) throw new Error('TextAreaField requires an id for label association.');
    const describedBy =
      [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

    const [internalLength, setInternalLength] = useState(() => {
      if (typeof value === 'string') return value.length;
      if (typeof defaultValue === 'string') return defaultValue.length;
      return 0;
    });

    const counterText =
      showCounter && maxLength
        ? `${internalLength} / ${maxLength}`
        : showCounter
          ? `${internalLength}`
          : undefined;

    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        trailing={counterText}
      >
        <textarea
          ref={ref}
          id={id}
          // CHA-231 : auto-détection LTR/RTL pour la saisie bilingue FR/AR.
          dir="auto"
          rows={rows}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(inputClasses, 'resize-none', className)}
          defaultValue={defaultValue}
          value={value}
          onChange={(event) => {
            setInternalLength(event.target.value.length);
            onChange?.(event);
          }}
          {...rest}
        />
      </FieldShell>
    );
  },
);
