/**
 * BooleanEditor — switch a11y (`role="switch"`).
 *
 * Pas de dépendance UI : un simple `<button>` avec `aria-checked` qui change
 * d'état au clic / Espace / Entrée. Le style visuel "track" est fait via CSS
 * sur le sélecteur `[role='switch'][aria-checked='true']`.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

export function BooleanEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<boolean>): JSX.Element {
  const checked = value === true;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field-boolean">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        aria-label={fieldDef.label}
        disabled={readOnly}
        onClick={() => onChange(!checked)}
        className="switch"
        data-state={checked ? 'on' : 'off'}
      >
        <span aria-hidden="true" className="switch-thumb" />
      </button>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
