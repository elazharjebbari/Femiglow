/**
 * RecordEditor — récursif sur les sous-champs d'un `record`.
 *
 * Rend chaque entrée de `config.shape` via `getFieldEditor(sub.type)`. Aucun
 * accordéon UI pour v1 (on garde des `<fieldset>` empilées) — l'accordéon
 * peut être ajouté plus tard sans changer le contrat.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §RecordEditor
 */
'use client';

import type { EditorProps } from '../types';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import { getFieldEditor } from '../registry';

export function RecordEditor({
  value,
  onChange,
  error,
  fieldDef,
  locale,
  id,
  readOnly,
}: EditorProps<Record<string, unknown>>): JSX.Element {
  const shape = fieldDef.config?.shape ?? {};
  const current: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const errorId = error ? `${id}-error` : undefined;

  return (
    <fieldset
      className="field-record"
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <legend>{fieldDef.label}</legend>
      {Object.entries(shape).map(([key, sub]) => {
        const SubEditor = getFieldEditor(sub.type);
        const subDef: ComponentFieldDefinition = {
          key,
          label: key,
          type: sub.type,
          required: sub.required ?? false,
          config: sub.config,
        };
        return (
          <div key={key} className="field-record-row">
            <label htmlFor={`${id}-${key}`}>{key}</label>
            <SubEditor
              value={(current[key] ?? null) as never}
              onChange={(v) => onChange({ ...current, [key]: v })}
              error={null}
              fieldDef={subDef}
              locale={locale}
              id={`${id}-${key}`}
              readOnly={readOnly}
            />
          </div>
        );
      })}
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
