/**
 * QuoteEditor — sous-form `{ text, author }` pour les blocs citation.
 *
 * - `text` : `<textarea>` (réutilise la logique de `MultilineEditor`).
 * - `author` : `<input type="text">` court.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

interface QuoteValue {
  text: string;
  author: string;
}

export function QuoteEditor({
  value,
  onChange,
  error,
  id,
  readOnly,
}: EditorProps<QuoteValue>): JSX.Element {
  const current: QuoteValue = value ?? { text: '', author: '' };
  const errorId = error ? `${id}-error` : undefined;

  function update(patch: Partial<QuoteValue>): void {
    onChange({ ...current, ...patch });
  }

  return (
    <fieldset
      className="field-quote"
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <legend className="sr-only">Citation</legend>
      <label>
        <span>Texte</span>
        <textarea
          id={`${id}-text`}
          rows={3}
          value={current.text}
          onChange={(e) => update({ text: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      <label>
        <span>Auteur</span>
        <input
          id={`${id}-author`}
          type="text"
          value={current.author}
          onChange={(e) => update({ author: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
