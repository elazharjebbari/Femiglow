/**
 * FieldsPanel — panneau d'édition des champs éditoriaux d'un composant (P8).
 *
 * Composant client. Reçoit du parent RSC :
 *   - `componentKey` : clé du SiteComponent.
 *   - `fieldDefs` : tableau des `ComponentFieldDefinition` (registre).
 *   - `initialFields` : valeurs initiales (draft si existe, sinon published,
 *     sinon defaultValue) sous forme `Record<key, FieldDirtyState>`.
 *
 * Rend :
 *   - une `FieldRow` par champ (groupées par `group` si présent),
 *   - un bouton « Publier les modifications » (PublishBar),
 *   - la `ConflictModal` quand un 409 survient.
 *
 * Cf. docs/components-cms/frontend/03-form-engine.md
 */
'use client';

import { useEffect, useMemo } from 'react';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import type { FieldDirtyState } from './types';
import { FieldRow } from './FieldRow';
import { ConflictModal } from './ConflictModal';
import { useFieldForm } from './useFieldForm';

interface Props {
  componentKey: string;
  fieldDefs: ComponentFieldDefinition[];
  initialFields: Record<string, FieldDirtyState>;
  locale?: string;
  /**
   * Si fourni, callback appelé après chaque save (succès ou échec) avec
   * l'état complet — utile pour la live preview (cf. F4).
   */
  onStateChange?: (fields: Record<string, FieldDirtyState>) => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function FieldsPanel({
  componentKey,
  fieldDefs,
  initialFields,
  locale = 'fr',
  onStateChange,
}: Props): JSX.Element {
  const { state, onChange, publish, forceSave, reloadFromServer } = useFieldForm({
    componentKey,
    locale,
    initial: initialFields,
    warnOnExit: true,
  });

  // Notifie le parent quand le state change (live preview).
  useEffect(() => {
    if (onStateChange) onStateChange(state.fields);
  }, [state.fields, onStateChange]);

  // Groupes ordonnés. On préserve l'ordre `field.order`, puis l'ordre
  // d'apparition dans le registre.
  const grouped = useMemo(() => {
    const sorted = [...fieldDefs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const groups = new Map<string, ComponentFieldDefinition[]>();
    for (const def of sorted) {
      const g = def.group ?? 'Général';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(def);
    }
    return Array.from(groups.entries());
  }, [fieldDefs]);

  const dirtyCount = Object.values(state.fields).filter(
    (f) => !deepEqual(f.current, f.initial),
  ).length;

  return (
    <section className="fields-panel" aria-labelledby="fields-panel-title">
      <h2 id="fields-panel-title" className="text-xl font-semibold tracking-tight text-stone-900">
        Champs éditoriaux
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Édition autosave (debounce 800 ms). Cliquez « Publier » pour rendre les
        modifications visibles en production.
      </p>

      {grouped.map(([group, defs]) => (
        <fieldset key={group} className="mt-6">
          <legend className="text-sm font-medium uppercase tracking-wide text-stone-500">
            {group}
          </legend>
          <div className="mt-3 space-y-4">
            {defs.map((def) => {
              const fieldState = state.fields[def.key];
              if (!fieldState) return null;
              return (
                <FieldRow
                  key={def.key}
                  fieldDef={def}
                  state={fieldState}
                  onChange={(v) => onChange(def.key, v)}
                  locale={locale}
                  componentKey={componentKey}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      <PublishBar
        dirtyCount={dirtyCount}
        publishing={state.publishing}
        publishError={state.publishError}
        onPublish={() => void publish()}
      />

      {state.conflict ? (
        <ConflictModal
          conflict={state.conflict}
          onKeepLocal={() => {
            const fk = state.conflict!.fieldKey;
            void forceSave(fk);
          }}
          onAcceptRemote={() => void reloadFromServer()}
          onClose={() => void reloadFromServer()}
        />
      ) : null}
    </section>
  );
}

interface PublishBarProps {
  dirtyCount: number;
  publishing: boolean;
  publishError: string | null;
  onPublish: () => void;
}

function PublishBar({
  dirtyCount,
  publishing,
  publishError,
  onPublish,
}: PublishBarProps): JSX.Element {
  // `sticky bottom-4` ancre la barre au bas du viewport pendant que
  // l'admin scrolle dans le formulaire (un panneau hero peut faire 8+
  // champs et le bouton de publication disparaissait sous la pliure).
  // `z-10` la garde au-dessus des éditeurs ; `shadow-md` la détache
  // visuellement du contenu une fois sticky.
  const isDirty = dirtyCount > 0;
  return (
    <div
      className={`publish-bar sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 shadow-md transition-colors ${
        isDirty
          ? 'border-amber-300 bg-amber-50'
          : 'border-stone-200 bg-stone-50'
      }`}
      role="region"
      aria-label="Publication"
    >
      <div className="min-w-0 text-sm text-stone-700">
        {isDirty ? (
          <span>
            <strong>{dirtyCount}</strong> champ{dirtyCount > 1 ? 's' : ''} en brouillon
            <span className="ml-2 text-xs text-stone-500">
              · sauvegarde automatique en cours
            </span>
          </span>
        ) : (
          <span className="text-stone-500">
            Aucune modification en attente
            <span className="ml-2 text-xs text-stone-400">
              · les changements sont sauvegardés en draft, cliquez « Publier » pour les rendre visibles en prod
            </span>
          </span>
        )}
        {publishError ? (
          <span className="ml-3 text-red-600" role="alert">
            {publishError}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
        onClick={onPublish}
        disabled={publishing || dirtyCount === 0}
      >
        {publishing ? 'Publication…' : 'Publier les modifications'}
      </button>
    </div>
  );
}
