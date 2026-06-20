/**
 * Field — enveloppe de champ du socle emails (charte 09 §A.2).
 *
 * Label (TYPO.label) + aide optionnelle + erreur inline tonale (INK.danger),
 * avec câblage a11y : `htmlFor`/`id`, `aria-describedby` vers l'aide ET l'erreur,
 * `aria-invalid` quand erreur. Le contrôle est passé en enfant via une fonction
 * (render-prop) qui reçoit les attributs ARIA à épandre — l'assistance à la
 * saisie (G11) se branche sur ce contrat unique.
 */
import { useId, type ReactNode } from 'react';
import { INK, TYPO } from './tokens';

export type FieldAria = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

export type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** Reçoit les attributs ARIA à épandre sur le contrôle (input/select/combobox). */
  children: (aria: FieldAria) => ReactNode;
};

export function Field({ label, hint, error, required, className = '', children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className={TYPO.label}>
        {label}
        {required ? <span className={`ml-0.5 ${INK.danger}`} aria-hidden="true">*</span> : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {hint && !error ? (
        <p id={hintId} className={TYPO.meta}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className={`text-xs ${INK.danger}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
