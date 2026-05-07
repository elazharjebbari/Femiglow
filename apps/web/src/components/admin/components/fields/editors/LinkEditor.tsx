/**
 * LinkEditor — sous-form `{ href, label, external }`.
 *
 * - `href` : input texte (validation Zod côté serveur).
 * - `label` : input texte.
 * - `external` : checkbox (auto-coché si href semble externe : http/https +
 *   pas le même host).
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

interface LinkValue {
  href: string;
  label: string;
  external: boolean;
}

function isExternalGuess(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('/') || href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  return /^https?:\/\//i.test(href);
}

export function LinkEditor({
  value,
  onChange,
  error,
  id,
  readOnly,
}: EditorProps<LinkValue>): JSX.Element {
  const current: LinkValue = value ?? { href: '', label: '', external: false };
  const errorId = error ? `${id}-error` : undefined;

  function update(patch: Partial<LinkValue>): void {
    const next = { ...current, ...patch };
    // Heuristique : si l'utilisateur n'a pas explicitement coché et qu'il
    // tape une URL externe, on auto-coche `external`. Si on saute en interne,
    // on décoche.
    if (patch.href !== undefined && patch.external === undefined) {
      next.external = isExternalGuess(patch.href);
    }
    onChange(next);
  }

  return (
    <fieldset
      className="field-link"
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <legend className="sr-only" id={id}>
        Lien
      </legend>
      <label>
        <span>URL</span>
        <input
          type="text"
          value={current.href}
          onChange={(e) => update({ href: e.target.value })}
          readOnly={readOnly}
          placeholder="https://… ou /chemin"
        />
      </label>
      <label>
        <span>Texte du lien</span>
        <input
          type="text"
          value={current.label}
          onChange={(e) => update({ label: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={current.external}
          onChange={(e) => update({ external: e.target.checked })}
          disabled={readOnly}
        />
        <span>Ouvrir dans un nouvel onglet</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
