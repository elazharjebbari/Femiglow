/**
 * KickerEditor — TextEditor + preview avec la classe typographique du kicker.
 *
 * Le kicker est un sur-titre court (uppercase, letter-spacing). On réutilise
 * `TextEditor` pour ne pas dupliquer la logique input + compteur, et on
 * ajoute une preview live en dessous.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';
import { TextEditor } from './TextEditor';

export function KickerEditor(props: EditorProps<string>): JSX.Element {
  const current = props.value ?? '';
  return (
    <div className="field-kicker">
      <TextEditor {...props} />
      {current ? (
        <p
          className="kicker-preview"
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--color-kicker, var(--color-sauge, #6b7c5a))',
            fontSize: '0.75rem',
            marginTop: '0.5rem',
          }}
          aria-live="polite"
        >
          {current}
        </p>
      ) : null}
    </div>
  );
}
