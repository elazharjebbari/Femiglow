/**
 * TextEditor — éditeur scalaire pour `FieldType` = 'text'.
 *
 * - `<input type="text">` contrôlé.
 * - Compteur de caractères affiché si `config.maxLength`.
 * - Aucune validation locale au-delà de `maxLength` (HTML natif). La
 *   validation Zod est faite côté serveur (B2).
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §TextEditor
 */
'use client';

import type { EditorProps } from '../types';

export function TextEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const current = value ?? '';
  const max = cfg.maxLength;
  const errorId = error ? `${id}-error` : undefined;
  const counterId = max ? `${id}-counter` : undefined;
  return (
    <div className="field-text">
      <input
        id={id}
        type="text"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        placeholder={cfg.placeholder}
        maxLength={max}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, counterId].filter(Boolean).join(' ') || undefined}
      />
      {max ? (
        <span id={counterId} className="char-counter" aria-live="polite">
          {current.length} / {max}
        </span>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
