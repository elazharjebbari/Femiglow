/**
 * FieldRow — wrapper a11y autour d'un `EditorComponent`.
 *
 * Rôles :
 *   - rend le `<label htmlFor>` (libellé + indication required).
 *   - rend la description optionnelle.
 *   - lookup l'éditeur via `getFieldEditor(fieldDef.type)`.
 *   - injecte un `id` stable (`field-<key>`) pour `htmlFor`.
 *   - marque le state dirty via `data-dirty` pour styliser.
 *   - rend un `FieldStatusBadge` minimal (sauvegarde / saved / erreur).
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §FieldRow
 */
'use client';

import Link from 'next/link';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import type { FieldDirtyState } from './types';
import { getFieldEditor } from './registry';

interface FieldRowProps {
  fieldDef: ComponentFieldDefinition;
  state: FieldDirtyState;
  onChange: (next: unknown) => void;
  locale?: string;
  readOnly?: boolean;
  /** Si fourni, on rend un lien vers la page d'historique du champ (P11). */
  componentKey?: string;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function FieldStatusBadge({ state }: { state: FieldDirtyState }): JSX.Element | null {
  if (state.error) {
    return (
      <span className="field-badge field-badge--error" aria-label="Erreur">
        ⚠
      </span>
    );
  }
  if (state.saving) {
    return (
      <span className="field-badge field-badge--saving" aria-live="polite">
        Sauvegarde…
      </span>
    );
  }
  if (state.lastSavedAt && deepEqual(state.current, state.initial)) {
    return (
      <span className="field-badge field-badge--saved" aria-label="Sauvegardé">
        ✓
      </span>
    );
  }
  return null;
}

export function FieldRow({
  fieldDef,
  state,
  onChange,
  locale = 'fr',
  readOnly,
  componentKey,
}: FieldRowProps): JSX.Element {
  const Editor = getFieldEditor(fieldDef.type);
  const id = `field-${fieldDef.key}`;
  const dirty = !deepEqual(state.current, state.initial);
  return (
    <div className="field-row" data-dirty={dirty || undefined} data-field-key={fieldDef.key}>
      <div className="field-row-head flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="field-label">
          {fieldDef.label}
          {fieldDef.required ? (
            <span aria-label="requis" className="field-required-marker">
              {' *'}
            </span>
          ) : null}
        </label>
        {componentKey ? (
          <Link
            href={`/admin/components/${componentKey}/fields/${fieldDef.key}/history`}
            className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
            aria-describedby={id}
          >
            Historique
          </Link>
        ) : null}
      </div>
      {fieldDef.description ? (
        <p className="field-help" id={`${id}-help`}>
          {fieldDef.description}
        </p>
      ) : null}
      <Editor
        value={state.current as never}
        onChange={onChange}
        error={state.error}
        fieldDef={fieldDef}
        locale={locale}
        id={id}
        readOnly={readOnly}
      />
      <FieldStatusBadge state={state} />
    </div>
  );
}
