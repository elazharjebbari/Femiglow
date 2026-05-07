/**
 * MultilineEditor — `<textarea>` auto-resize (3 → 8 rows) avec compteur.
 *
 * On évite une dépendance externe : le sizing dynamique est un simple effet
 * sur `scrollHeight`, plafonné par CSS via `maxRows`.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import { useEffect, useRef } from 'react';
import type { EditorProps } from '../types';

const MIN_ROWS = 3;
const MAX_ROWS = 8;

export function MultilineEditor({
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
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const errorId = error ? `${id}-error` : undefined;
  const counterId = max ? `${id}-counter` : undefined;

  // Auto-resize : on remet à zéro la hauteur puis on lit `scrollHeight`.
  // Plafonné par MAX_ROWS via la propriété rows minimum.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '20');
    const min = MIN_ROWS * lineHeight;
    const max = MAX_ROWS * lineHeight;
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`;
  }, [current]);

  return (
    <div className="field-multiline">
      <textarea
        id={id}
        ref={ref}
        rows={MIN_ROWS}
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
