/**
 * Form engine — reducer + types (F3).
 *
 * Couvre :
 *   - mapping `fieldKey → FieldDirtyState`
 *   - actions discrètes pour edit / save / publish / conflit
 *   - aucune dépendance UI (pur, testable en isolation)
 *
 * Cf. docs/components-cms/frontend/03-form-engine.md
 */
import type { FieldDirtyState } from './types';

export interface ConflictModalState {
  fieldKey: string;
  localValue: unknown;
  remoteValue: unknown;
  remoteUpdatedAt: string;
  remoteAuthorId: string | null;
}

export interface FormState {
  componentKey: string;
  locale: string;
  fields: Record<string /* fieldKey */, FieldDirtyState>;
  /** Modal de conflit ouverte (un seul à la fois côté UI). */
  conflict: ConflictModalState | null;
  /** True pendant l'appel `publish` (peut être long si flush en cours). */
  publishing: boolean;
  /** Erreur globale de publish (différente d'une erreur de save par champ). */
  publishError: string | null;
}

export type FormAction =
  | { type: 'INIT'; fields: Record<string, FieldDirtyState> }
  | { type: 'RELOAD'; fields: Record<string, FieldDirtyState> }
  | { type: 'FIELD_CHANGED'; fieldKey: string; value: unknown }
  | { type: 'SAVE_STARTED'; fieldKey: string }
  | { type: 'SAVE_SUCCEEDED'; fieldKey: string; savedAt: string; updatedAt: string }
  | { type: 'SAVE_FAILED'; fieldKey: string; error: string }
  | { type: 'CONFLICT_DETECTED'; conflict: ConflictModalState }
  | { type: 'CONFLICT_RESOLVED_RELOAD'; fields: Record<string, FieldDirtyState> }
  | { type: 'CONFLICT_RESOLVED_KEEP_LOCAL' }
  | { type: 'PUBLISH_REQUESTED' }
  | { type: 'PUBLISH_SUCCEEDED' }
  | { type: 'PUBLISH_FAILED'; error: string };

function patchField(
  state: FormState,
  fieldKey: string,
  patch: Partial<FieldDirtyState>,
): FormState {
  const cur = state.fields[fieldKey];
  if (!cur) return state;
  return {
    ...state,
    fields: { ...state.fields, [fieldKey]: { ...cur, ...patch } },
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'INIT':
    case 'RELOAD':
      return { ...state, fields: action.fields, conflict: null, publishError: null };

    case 'FIELD_CHANGED':
      return patchField(state, action.fieldKey, {
        current: action.value,
        error: null,
        // On ne touche pas `lastSavedAt` ici : tant que la valeur courante
        // diffère de l'initial, le badge "saved" disparaît grâce à
        // `deepEqual(current, initial)` côté FieldRow.
      });

    case 'SAVE_STARTED':
      return patchField(state, action.fieldKey, { saving: true });

    case 'SAVE_SUCCEEDED': {
      const cur = state.fields[action.fieldKey];
      if (!cur) return state;
      return patchField(state, action.fieldKey, {
        saving: false,
        lastSavedAt: action.savedAt,
        ifMatch: action.updatedAt,
        // baseline = ce qu'on vient d'enregistrer ; le badge "saved" peut
        // s'afficher car deepEqual(current, initial) sera true.
        initial: cur.current,
        error: null,
      });
    }

    case 'SAVE_FAILED':
      return patchField(state, action.fieldKey, {
        saving: false,
        error: action.error,
        // current reste tel quel : l'utilisateur garde sa version pour
        // pouvoir corriger.
      });

    case 'CONFLICT_DETECTED':
      // En cas de conflit, on stoppe le saving spinner du champ concerné.
      return {
        ...state,
        conflict: action.conflict,
        fields: state.fields[action.conflict.fieldKey]
          ? {
              ...state.fields,
              [action.conflict.fieldKey]: {
                ...state.fields[action.conflict.fieldKey]!,
                saving: false,
              },
            }
          : state.fields,
      };

    case 'CONFLICT_RESOLVED_RELOAD':
      return { ...state, fields: action.fields, conflict: null };

    case 'CONFLICT_RESOLVED_KEEP_LOCAL':
      return { ...state, conflict: null };

    case 'PUBLISH_REQUESTED':
      return { ...state, publishing: true, publishError: null };

    case 'PUBLISH_SUCCEEDED':
      return { ...state, publishing: false };

    case 'PUBLISH_FAILED':
      return { ...state, publishing: false, publishError: action.error };

    default: {
      const exhaustive: never = action;
      void exhaustive;
      return state;
    }
  }
}

/**
 * Helper : produit l'état initial d'un champ à partir d'une valeur
 * persistée (draft ou published).
 */
export function makeInitialField(
  value: unknown,
  ifMatch?: string | null,
): FieldDirtyState {
  return {
    initial: value,
    current: value,
    error: null,
    saving: false,
    lastSavedAt: ifMatch ?? null,
    ifMatch: ifMatch ?? null,
  };
}
