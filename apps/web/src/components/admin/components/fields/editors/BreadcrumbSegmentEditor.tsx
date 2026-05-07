/**
 * BreadcrumbSegmentEditor — sous-form `{ label, href }`.
 *
 * Utilisé pour décrire un segment unique d'une chaîne de breadcrumb. Le
 * conteneur (un `ListEditor` au-dessus) gère l'ordre.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

interface BreadcrumbSegmentValue {
  label: string;
  href: string;
}

export function BreadcrumbSegmentEditor({
  value,
  onChange,
  error,
  id,
  readOnly,
}: EditorProps<BreadcrumbSegmentValue>): JSX.Element {
  const current: BreadcrumbSegmentValue = value ?? { label: '', href: '' };
  const errorId = error ? `${id}-error` : undefined;

  function update(patch: Partial<BreadcrumbSegmentValue>): void {
    onChange({ ...current, ...patch });
  }

  return (
    <fieldset
      className="field-breadcrumb-segment"
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <legend className="sr-only">Segment</legend>
      <label>
        <span>Libellé</span>
        <input
          id={`${id}-label`}
          type="text"
          value={current.label}
          onChange={(e) => update({ label: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      <label>
        <span>URL</span>
        <input
          id={`${id}-href`}
          type="text"
          value={current.href}
          onChange={(e) => update({ href: e.target.value })}
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
