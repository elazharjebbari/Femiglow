/**
 * ListEditor — conteneur sortable pour une liste d'items du même type.
 *
 * - Récursif : récupère l'éditeur de l'item via `getFieldEditor(itemType)`.
 * - `+ Ajouter` : produit un item via `defaultForType(itemType, itemConfig)`.
 *   Limité par `maxItems`.
 * - Bouton corbeille par item, limité par `minItems`.
 * - Bouton ↑/↓ pour réordonner (alternative simple à dnd-kit pour v1 ; on
 *   pourra migrer vers `@dnd-kit/sortable` en F1.5 sans changer le contrat).
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §ListEditor
 */
'use client';

import type { EditorProps } from '../types';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import { getFieldEditor } from '../registry';
import { defaultForType } from '../defaults';

export function ListEditor({
  value,
  onChange,
  error,
  fieldDef,
  locale,
  id,
  readOnly,
}: EditorProps<unknown[]>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const items: unknown[] = Array.isArray(value) ? value : [];
  const itemType = cfg.itemType ?? 'text';
  const ItemEditor = getFieldEditor(itemType);
  const errorId = error ? `${id}-error` : undefined;

  const itemDef: ComponentFieldDefinition = {
    key: fieldDef.key,
    label: fieldDef.label,
    type: itemType,
    required: false,
    config: cfg.itemConfig,
  };

  function move(from: number, to: number): void {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  function remove(idx: number): void {
    onChange(items.filter((_, i) => i !== idx));
  }

  const canAdd = !readOnly && (cfg.maxItems == null || items.length < cfg.maxItems);
  const canRemove = !readOnly && (cfg.minItems == null || items.length > cfg.minItems);

  return (
    <div className="field-list" aria-describedby={errorId}>
      <ol className="list-items" aria-label={fieldDef.label}>
        {items.map((item, i) => (
          <li key={i} className="list-item">
            <div className="list-item-controls" aria-label={`Item ${i + 1}`}>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={readOnly || i === 0}
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={readOnly || i === items.length - 1}
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={!canRemove}
                aria-label="Supprimer"
              >
                Supprimer
              </button>
            </div>
            <div className="list-item-editor">
              <label htmlFor={`${id}-${i}`} className="sr-only">
                {`${fieldDef.label} — item ${i + 1}`}
              </label>
              <ItemEditor
                value={(item ?? null) as never}
                onChange={(next) => {
                  const out = items.slice();
                  out[i] = next;
                  onChange(out);
                }}
                error={null}
                fieldDef={itemDef}
                locale={locale}
                id={`${id}-${i}`}
                readOnly={readOnly}
              />
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="list-add"
        onClick={() => onChange([...items, defaultForType(itemType, cfg.itemConfig)])}
        disabled={!canAdd}
      >
        + Ajouter
      </button>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
