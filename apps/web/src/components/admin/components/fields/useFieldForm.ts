/**
 * useFieldForm — hook unique pour la page d'édition CMS (F3).
 *
 * Encapsule :
 *   - reducer (state) + actions
 *   - debounce auto-save par champ (800 ms)
 *   - retry réseau (jusqu'à 3 fois, backoff 200/600/1500 + jitter)
 *   - détection 409 → ouverture de la modale conflit
 *   - publish global (POST par champ dirty → revalidate)
 *   - garde-fou `beforeunload` quand des dirty existent
 *
 * Aucune dépendance UI : retourne `state`, `dispatch`, et helpers d'API.
 *
 * Cf. docs/components-cms/frontend/03-form-engine.md
 */
'use client';

import { useReducer, useEffect, useRef, useCallback } from 'react';
import {
  formReducer,
  makeInitialField,
  type ConflictModalState,
  type FormAction,
  type FormState,
} from './reducer';
import type { FieldDirtyState } from './types';

export const SAVE_DEBOUNCE_MS = 800;
const RETRY_DELAYS_MS = [200, 600, 1500];

interface UseFieldFormOptions {
  componentKey: string;
  locale?: string;
  /** Snapshot initial chargé côté server-component parent. */
  initial: Record<string, FieldDirtyState>;
  /** Si true, intercepte beforeunload tant qu'il reste des dirty. */
  warnOnExit?: boolean;
}

interface UseFieldFormResult {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  /** Modifie une valeur de champ + déclenche le debounce auto-save. */
  onChange: (fieldKey: string, value: unknown) => void;
  /** Sauvegarde immédiate d'un champ (sans attendre le debounce). */
  flush: (fieldKey: string) => Promise<void>;
  /** Force-overwrite d'un champ (sans `If-Match`). Sortie de modale conflit. */
  forceSave: (fieldKey: string) => Promise<void>;
  /** Recharge tous les champs depuis le serveur (résolution conflit). */
  reloadFromServer: () => Promise<void>;
  /** Publish (par champ dirty) ; flush d'abord, puis POST publish chacun. */
  publish: () => Promise<void>;
}

function jitter(base: number): number {
  return base + Math.floor(Math.random() * Math.min(200, base / 2));
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Pour les besoins des tests, on expose une "fenêtre" de timers cancellables
 * via la ref interne `_useFieldFormTestTimers`. Pas de logique runtime ici.
 */
export function useFieldForm({
  componentKey,
  locale = 'fr',
  initial,
  warnOnExit,
}: UseFieldFormOptions): UseFieldFormResult {
  const [state, dispatch] = useReducer(formReducer, {
    componentKey,
    locale,
    fields: initial,
    conflict: null,
    publishing: false,
    publishError: null,
  });

  // Un timer par champ pour le debounce auto-save.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // On veut accéder à la dernière `state.fields` dans flush() sans rebuilder
  // la closure à chaque update — sinon on recrée le timer pour rien.
  const stateRef = useRef(state);
  stateRef.current = state;

  const persistField = useCallback(
    async (fieldKey: string, opts: { force?: boolean } = {}): Promise<void> => {
      const cur = stateRef.current.fields[fieldKey];
      if (!cur) return;
      if (deepEqual(cur.current, cur.initial)) return; // rien à sauver

      dispatch({ type: 'SAVE_STARTED', fieldKey });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (!opts.force && cur.ifMatch) headers['If-Match'] = cur.ifMatch;

      let lastNetworkError: unknown = null;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          const res = await fetch(
            `/api/admin/components/${encodeURIComponent(componentKey)}/fields/${encodeURIComponent(
              fieldKey,
            )}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ value: cur.current, locale }),
            },
          );

          if (res.status === 409) {
            const data = (await res.json().catch(() => null)) as {
              error?: { details?: Partial<ConflictModalState> };
            } | null;
            const details = data?.error?.details ?? {};
            dispatch({
              type: 'CONFLICT_DETECTED',
              conflict: {
                fieldKey,
                localValue: cur.current,
                remoteValue: details.remoteValue,
                remoteUpdatedAt: details.remoteUpdatedAt ?? new Date().toISOString(),
                remoteAuthorId: details.remoteAuthorId ?? null,
              },
            });
            return;
          }
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            dispatch({
              type: 'SAVE_FAILED',
              fieldKey,
              error: data?.error?.message ?? `Erreur ${res.status}`,
            });
            return;
          }

          const data = (await res.json()) as {
            binding: { updatedAt: string };
          };
          dispatch({
            type: 'SAVE_SUCCEEDED',
            fieldKey,
            savedAt: new Date().toISOString(),
            updatedAt: data.binding.updatedAt,
          });
          return;
        } catch (err) {
          lastNetworkError = err;
          // Erreur réseau — retry avec backoff (ne touche pas aux 4xx/5xx).
          if (attempt < RETRY_DELAYS_MS.length) {
            await new Promise((r) =>
              setTimeout(r, jitter(RETRY_DELAYS_MS[attempt]!)),
            );
            continue;
          }
        }
      }
      dispatch({
        type: 'SAVE_FAILED',
        fieldKey,
        error:
          lastNetworkError instanceof Error
            ? lastNetworkError.message
            : 'Erreur réseau',
      });
    },
    [componentKey, locale],
  );

  const flush = useCallback(
    async (fieldKey: string): Promise<void> => {
      const t = timers.current.get(fieldKey);
      if (t) {
        clearTimeout(t);
        timers.current.delete(fieldKey);
      }
      await persistField(fieldKey);
    },
    [persistField],
  );

  const forceSave = useCallback(
    async (fieldKey: string): Promise<void> => {
      // Sortie de la modale conflit avec "garder ma version".
      dispatch({ type: 'CONFLICT_RESOLVED_KEEP_LOCAL' });
      await persistField(fieldKey, { force: true });
    },
    [persistField],
  );

  const onChange = useCallback(
    (fieldKey: string, value: unknown): void => {
      dispatch({ type: 'FIELD_CHANGED', fieldKey, value });
      const existing = timers.current.get(fieldKey);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.current.delete(fieldKey);
        void persistField(fieldKey);
      }, SAVE_DEBOUNCE_MS);
      timers.current.set(fieldKey, t);
    },
    [persistField],
  );

  const reloadFromServer = useCallback(async (): Promise<void> => {
    const res = await fetch(
      `/api/admin/components/${encodeURIComponent(componentKey)}/fields?locale=${encodeURIComponent(locale)}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      fields: Array<{
        key: string;
        published: { value: unknown; updatedAt: string } | null;
        draft: { value: unknown; updatedAt: string } | null;
      }>;
    };
    const next: Record<string, FieldDirtyState> = {};
    for (const f of data.fields) {
      const src = f.draft ?? f.published;
      next[f.key] = makeInitialField(src?.value ?? null, src?.updatedAt ?? null);
    }
    dispatch({ type: 'CONFLICT_RESOLVED_RELOAD', fields: next });
  }, [componentKey, locale]);

  const publish = useCallback(async (): Promise<void> => {
    dispatch({ type: 'PUBLISH_REQUESTED' });
    // 1) flush des drafts en vol.
    const keys = Object.keys(stateRef.current.fields);
    for (const key of keys) {
      const t = timers.current.get(key);
      if (t) {
        clearTimeout(t);
        timers.current.delete(key);
        await persistField(key);
      }
    }
    // 2) Publish par champ : on POST /publish pour chaque champ avec un draft
    // visible (heuristique : on déclenche partout, le serveur renvoie 404 si
    // aucun draft, ce qu'on ignore silencieusement).
    let firstError: string | null = null;
    for (const key of keys) {
      try {
        // T3.8 — la route publish lit la locale en query string (`?locale=ar`).
        // Sans ce param, le serveur retombait sur 'fr' et ne publiait jamais
        // les drafts AR / EN. Cf. apps/web/src/app/api/admin/components/[key]/fields/[fieldKey]/publish/route.ts.
        const res = await fetch(
          `/api/admin/components/${encodeURIComponent(componentKey)}/fields/${encodeURIComponent(key)}/publish?locale=${encodeURIComponent(locale)}`,
          {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          },
        );
        if (res.status === 404) continue; // pas de draft → ignoré
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          if (!firstError) firstError = data?.error?.message ?? `Erreur ${res.status}`;
        }
      } catch (err) {
        if (!firstError) {
          firstError = err instanceof Error ? err.message : 'Erreur réseau';
        }
      }
    }
    if (firstError) {
      dispatch({ type: 'PUBLISH_FAILED', error: firstError });
      return;
    }
    dispatch({ type: 'PUBLISH_SUCCEEDED' });
    // 3) Rafraîchir les champs (les drafts sont devenus published).
    await reloadFromServer();
  }, [componentKey, locale, persistField, reloadFromServer]);

  // Cleanup des timers quand le hook est démonté.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  // Garde-fou `beforeunload` quand des dirty existent.
  useEffect(() => {
    if (!warnOnExit) return;
    const hasDirty = Object.values(state.fields).some(
      (f) => !deepEqual(f.current, f.initial) || f.saving,
    );
    if (!hasDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent): void {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.fields, warnOnExit]);

  return {
    state,
    dispatch,
    onChange,
    flush,
    forceSave,
    reloadFromServer,
    publish,
  };
}
