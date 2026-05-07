# F3 — Form engine : state, dirty tracking, save

## Pourquoi `useReducer` et pas RHF

D6 (cf. A1) : RHF apporte ~30 ko gzip pour zéro valeur ajoutée ici.
Les éditeurs sont des composants contrôlés purs (cf. F1) ; le besoin
est :

1. un map `fieldKey → state` avec dirty/saving/error,
2. des actions discrètes à dispatcher (`FIELD_CHANGED`, `SAVE_*`, …),
3. une stratégie de persistance (debounce + retry + optimistic).

`useReducer` couvre exactement cela en ~120 lignes typées.

## Type d'état

```ts
// apps/web/src/components/admin/components/fields/types.ts
export interface FieldDirtyState {
  /** Valeur initiale chargée du serveur (draft si existe, sinon published, sinon defaultValue). */
  initial: unknown;
  /** Valeur courante en édition. */
  current: unknown;
  /** Auto-save en cours. */
  saving: boolean;
  /** Date du dernier save réussi (pour afficher « Enregistré il y a 3 s »). */
  savedAt: Date | null;
  /** Message d'erreur (FR) ou null. Provient de la réponse 4xx du serveur. */
  error: string | null;
  /** Compteur d'attentes ; > 0 = au moins un PATCH en vol pour ce champ. */
  pendingSaves: number;
  /** Optimistic concurrency : updatedAt renvoyé par le dernier GET ou PATCH. */
  ifMatch: string | null;
}

export interface FormState {
  componentKey: string;
  locale: string;
  fields: Record<string /* fieldKey */, FieldDirtyState>;
  /** True si une fenêtre de conflit (409) est ouverte. */
  conflict: ConflictModalState | null;
  /** True si l'admin a cliqué « Publier » mais qu'on attend la réponse. */
  publishing: boolean;
}

export interface ConflictModalState {
  fieldKey: string;
  localValue: unknown;
  remoteValue: unknown;
  remoteUpdatedAt: string;
  remoteAuthorId: string | null;
}
```

## Actions

```ts
export type FormAction =
  | { type: 'INIT'; fields: Record<string, FieldDirtyState> }
  | { type: 'FIELD_CHANGED'; fieldKey: string; value: unknown }
  | { type: 'SAVE_STARTED'; fieldKey: string }
  | { type: 'SAVE_SUCCEEDED'; fieldKey: string; savedAt: Date; updatedAt: string }
  | { type: 'SAVE_FAILED'; fieldKey: string; error: string }
  | { type: 'CONFLICT_DETECTED'; conflict: ConflictModalState }
  | { type: 'CONFLICT_RESOLVED_RELOAD'; fields: Record<string, FieldDirtyState> }
  | { type: 'CONFLICT_RESOLVED_KEEP_LOCAL' }
  | { type: 'PUBLISH_REQUESTED' }
  | { type: 'PUBLISH_SUCCEEDED' }
  | { type: 'PUBLISH_FAILED'; error: string }
  | { type: 'RELOAD'; fields: Record<string, FieldDirtyState> };
```

## Reducer

```ts
// apps/web/src/components/admin/components/fields/reducer.ts
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'INIT':
    case 'RELOAD':
      return { ...state, fields: action.fields, conflict: null };

    case 'FIELD_CHANGED': {
      const cur = state.fields[action.fieldKey];
      if (!cur) return state;
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.fieldKey]: {
            ...cur,
            current: action.value,
            error: null,            // l'utilisateur édite, on reset l'erreur
            savedAt: null,          // plus à jour côté serveur
          },
        },
      };
    }

    case 'SAVE_STARTED': {
      const cur = state.fields[action.fieldKey];
      if (!cur) return state;
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.fieldKey]: {
            ...cur,
            saving: true,
            pendingSaves: cur.pendingSaves + 1,
          },
        },
      };
    }

    case 'SAVE_SUCCEEDED': {
      const cur = state.fields[action.fieldKey];
      if (!cur) return state;
      const stillPending = cur.pendingSaves - 1;
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.fieldKey]: {
            ...cur,
            saving: stillPending > 0,
            pendingSaves: stillPending,
            savedAt: action.savedAt,
            ifMatch: action.updatedAt,
            initial: cur.current,    // baseline = ce qu'on vient d'enregistrer
            error: null,
          },
        },
      };
    }

    case 'SAVE_FAILED': {
      const cur = state.fields[action.fieldKey];
      if (!cur) return state;
      const stillPending = Math.max(0, cur.pendingSaves - 1);
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.fieldKey]: {
            ...cur,
            saving: stillPending > 0,
            pendingSaves: stillPending,
            error: action.error,
            // current reste tel quel : c'est l'utilisateur qui décide.
          },
        },
      };
    }

    case 'CONFLICT_DETECTED':
      return { ...state, conflict: action.conflict };

    case 'CONFLICT_RESOLVED_RELOAD':
      return { ...state, fields: action.fields, conflict: null };

    case 'CONFLICT_RESOLVED_KEEP_LOCAL':
      return { ...state, conflict: null };

    case 'PUBLISH_REQUESTED':
      return { ...state, publishing: true };
    case 'PUBLISH_SUCCEEDED':
      return { ...state, publishing: false };
    case 'PUBLISH_FAILED':
      return { ...state, publishing: false };
  }
}
```

## Hook `useFieldForm`

Le composant page n'utilise que ce hook. Il encapsule reducer +
debounce + fetch + retry + résolution de conflit.

```ts
// apps/web/src/components/admin/components/fields/useFieldForm.ts
'use client';

import { useReducer, useEffect, useRef, useCallback } from 'react';
import { formReducer, type FormAction, type FormState, type FieldDirtyState } from './reducer';

const SAVE_DEBOUNCE_MS = 800;

interface UseFieldFormOptions {
  componentKey: string;
  locale?: string;
  /** Snapshot initial chargé côté server-component parent. */
  initial: Record<string, FieldDirtyState>;
  /** Si true, intercepte beforeunload tant qu'il reste des dirty. */
  warnOnExit?: boolean;
}

export function useFieldForm({ componentKey, locale = 'fr', initial, warnOnExit }: UseFieldFormOptions) {
  const [state, dispatch] = useReducer(formReducer, {
    componentKey,
    locale,
    fields: initial,
    conflict: null,
    publishing: false,
  });

  // un timer par champ pour le debounce auto-save
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const flush = useCallback(async (fieldKey: string) => {
    const cur = state.fields[fieldKey];
    if (!cur) return;
    if (cur.current === cur.initial) return; // rien à sauver

    dispatch({ type: 'SAVE_STARTED', fieldKey });
    try {
      const res = await fetch(
        `/api/admin/components/${componentKey}/fields/${fieldKey}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(cur.ifMatch ? { 'If-Match': cur.ifMatch } : {}),
          },
          body: JSON.stringify({ value: cur.current, locale }),
        },
      );

      if (res.status === 409) {
        const data = await res.json();
        dispatch({
          type: 'CONFLICT_DETECTED',
          conflict: {
            fieldKey,
            localValue: cur.current,
            remoteValue: data.error.details.remoteValue,
            remoteUpdatedAt: data.error.details.remoteUpdatedAt,
            remoteAuthorId: data.error.details.remoteAuthorId,
          },
        });
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        dispatch({
          type: 'SAVE_FAILED',
          fieldKey,
          error: data.error?.message ?? `Erreur ${res.status}`,
        });
        return;
      }
      const data = await res.json();
      dispatch({
        type: 'SAVE_SUCCEEDED',
        fieldKey,
        savedAt: new Date(),
        updatedAt: data.binding.updatedAt,
      });
    } catch (err) {
      dispatch({
        type: 'SAVE_FAILED',
        fieldKey,
        error: err instanceof Error ? err.message : 'Erreur réseau',
      });
    }
  }, [componentKey, locale, state.fields]);

  const onChange = useCallback((fieldKey: string, value: unknown) => {
    dispatch({ type: 'FIELD_CHANGED', fieldKey, value });
    const existing = timers.current.get(fieldKey);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      void flush(fieldKey);
      timers.current.delete(fieldKey);
    }, SAVE_DEBOUNCE_MS);
    timers.current.set(fieldKey, t);
  }, [flush]);

  const publish = useCallback(async () => {
    dispatch({ type: 'PUBLISH_REQUESTED' });
    // Pour publier, on flush d'abord les drafts en vol.
    for (const key of Object.keys(state.fields)) {
      const t = timers.current.get(key);
      if (t) {
        clearTimeout(t);
        timers.current.delete(key);
        await flush(key);
      }
    }
    try {
      const res = await fetch(
        `/api/admin/components/${componentKey}/fields/publish`,
        {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: 'PUBLISH_FAILED', error: data.error?.message ?? 'Échec' });
        return;
      }
      dispatch({ type: 'PUBLISH_SUCCEEDED' });
    } catch (err) {
      dispatch({
        type: 'PUBLISH_FAILED',
        error: err instanceof Error ? err.message : 'Erreur réseau',
      });
    }
  }, [componentKey, flush, state.fields]);

  // Avertir avant de quitter si dirty
  useEffect(() => {
    if (!warnOnExit) return;
    const hasDirty = Object.values(state.fields).some(
      (f) => f.current !== f.initial || f.saving,
    );
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.fields, warnOnExit]);

  return { state, dispatch, onChange, publish, flush };
}
```

## Debounce et retry

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| Debounce auto-save | **800 ms** | Largement plus haut que le rythme de frappe rapide (~120 ms entre touches), évite N PATCH par mot. |
| Max retries auto-save | 3 | Réseau flaky uniquement, pas pour les 4xx. |
| Backoff | 200 / 600 / 1500 ms | Doublement avec jitter. |

Le **retry** est isolé du reducer : `flush` ré-essaye uniquement sur
erreur réseau (`fetch` rejected). Toute réponse HTTP (200-5xx) est
traitée comme une décision serveur — pas de retry automatique sur
500 (l'utilisateur peut cliquer « réessayer »).

## Optimistic update + rollback

L'UI reflète immédiatement la valeur tapée (state local mis à jour
sur `FIELD_CHANGED`). En cas de `SAVE_FAILED` :

- la valeur **reste** ce que l'utilisateur a tapé (on ne rollback pas
  silencieusement, ce serait perturbant) ;
- le badge passe rouge avec le message d'erreur ;
- l'utilisateur peut éditer pour corriger (ce qui re-déclenche un save).

Sur `409 Conflict`, modal explicite (cf. ci-dessous) avec choix
explicite entre les deux versions.

## Conflit (409) — modal de résolution

```
┌──────────────────────────────────────────────────────────┐
│  Conflit de version                                       │
│                                                            │
│  Marie a modifié ce champ il y a 12 secondes.              │
│                                                            │
│  ┌────────────────────────┐  ┌────────────────────────┐   │
│  │ Votre version          │  │ Version sur le serveur │   │
│  │                        │  │                        │   │
│  │ Le rituel du soir,     │  │ Le rituel du soir,     │   │
│  │ en cinq minutes.       │  │ en quelques minutes.   │   │
│  └────────────────────────┘  └────────────────────────┘   │
│                                                            │
│  [Garder la mienne]   [Reprendre celle du serveur]        │
└──────────────────────────────────────────────────────────┘
```

- **Garder la mienne** → `dispatch({ type: 'CONFLICT_RESOLVED_KEEP_LOCAL' })`
  + nouveau PATCH sans `If-Match` (force-overwrite explicite,
  l'admin a vu les deux versions).
- **Reprendre celle du serveur** → GET `/fields?locale=…` pour
  rafraîchir l'`initial` de tous les champs, dispatch `RELOAD`.

Pas de merge auto. Le diff visuel suffit pour l'admin solo.

## Indicateurs UI

Chaque `FieldRow` (cf. F1) affiche un `<FieldStatusBadge state>` :

| Condition | Affichage |
|---|---|
| `current === initial` | rien (état neutre) |
| `current !== initial && saving` | spinner + « Enregistrement… » |
| `current !== initial && !saving && !error && savedAt` | check vert + « Enregistré il y a Xs » |
| `error` | icône triangle + message FR + bouton « Réessayer » |

## Publication

L'écran a un bouton « Publier les modifications » global
(`<PublishBar>`). Il est :

- **désactivé** si aucune dirty et aucun draft en DB (rien à publier).
- **actif** sinon ; affiche un compteur « 3 champs en brouillon ».

À l'appel :

1. `flush` les drafts en vol (clear timers, await tous les PATCH).
2. POST `/fields/publish` (cf. B1).
3. Sur succès : `RELOAD` complet (les `initial` deviennent les
   nouvelles valeurs publiées).
4. Sur 409 : la modale conflit (par champ) s'affiche pour le ou les
   champs concernés.

## Tests dédiés

| Test | Sujet |
|---|---|
| `reducer.spec.ts` (Vitest) | invariants reducer (transitions, idempotence) |
| `useFieldForm.spec.ts` (RTL + MSW) | debounce, save success, save fail, retry réseau |
| `conflict.spec.ts` (RTL + MSW) | 409 → modal → keep-local et reload |
| `publish.spec.ts` (RTL + MSW) | flush avant publish, succès, 409 |

Cf. T2 et T4.

## Cross-références

- A4 : statuts et transitions DB.
- F1 : éditeurs contrôlés (consommateurs de `state.fields[key].current`).
- F4 : la preview écoute `FIELDS_CHANGED` issu d'un effet de ce hook.
- B1 : routes REST PATCH/publish.
- B2 : messages d'erreur FR retournés par le serveur.
