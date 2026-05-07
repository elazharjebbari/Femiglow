/**
 * EnumEditor — segmented control (≤ 4 options) ou `<select>` (> 4).
 *
 * En mode segmented, on respecte le pattern `radiogroup` : un `<div>` parent
 * et des boutons `role="radio"` avec `aria-checked`. Le clavier (←/→) sera
 * géré par le navigateur via `tabIndex` sur l'option active uniquement.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

const SEGMENTED_THRESHOLD = 4;

export function EnumEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const options = cfg.options ?? [];
  const current = value ?? '';
  const errorId = error ? `${id}-error` : undefined;

  if (options.length <= SEGMENTED_THRESHOLD && options.length > 0) {
    return (
      <div className="field-enum">
        <div
          id={id}
          role="radiogroup"
          aria-label={fieldDef.label}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="segmented"
        >
          {options.map((opt) => {
            const checked = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked || (!current && opt.value === options[0]?.value) ? 0 : -1}
                disabled={readOnly}
                onClick={() => onChange(opt.value)}
                data-state={checked ? 'on' : 'off'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="field-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="field-enum">
      <select
        id={id}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      >
        {!current ? (
          <option value="" disabled>
            —
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
