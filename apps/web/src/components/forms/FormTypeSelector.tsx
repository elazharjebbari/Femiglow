'use client';

import type { ContactType } from '@/lib/schemas';
import { cn } from '@/lib/utils/cn';

interface FormTypeOption {
  value: ContactType;
  label: string;
}

const DEFAULT_OPTIONS: ReadonlyArray<FormTypeOption> = [
  { value: 'question', label: 'Une question' },
  { value: 'order', label: 'Une commande' },
  { value: 'professional', label: 'Un échange professionnel' },
];

interface FormTypeSelectorProps {
  value: ContactType;
  onChange: (next: ContactType) => void;
  name?: string;
  legend?: string;
  /** Phase 7 wiring — options localisées. Défaut FR si absent. */
  options?: ReadonlyArray<FormTypeOption>;
}

export function FormTypeSelector({
  value,
  onChange,
  name = 'type',
  legend = 'Quel type de message\u202F?',
  options = DEFAULT_OPTIONS,
}: FormTypeSelectorProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-encre">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className="grid gap-2 sm:grid-cols-3"
      >
        {options.map((option) => {
          const checked = option.value === value;
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              data-state={checked ? 'checked' : 'unchecked'}
              className={cn(
                'flex cursor-pointer items-center justify-center gap-2 border px-4 py-3 text-sm transition-colors duration-base',
                'focus-within:outline focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-encre',
                checked
                  ? 'border-encre bg-encre text-creme'
                  : 'border-encre/20 bg-creme text-encre hover:border-encre/40',
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
