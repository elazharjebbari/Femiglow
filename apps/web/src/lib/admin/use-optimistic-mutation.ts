'use client';
import { useCallback, useRef, useState } from 'react';

export interface OptimisticMutationOptions<TArgs extends unknown[], TResult> {
  /** Action serveur (fetch, etc.). Doit jeter en cas d'erreur. */
  mutate: (...args: TArgs) => Promise<TResult>;
  /** Application instantanée locale, retourne une fonction de rollback. */
  optimisticUpdate?: (...args: TArgs) => (() => void) | void;
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  onError?: (error: Error, ...args: TArgs) => void;
}

export interface OptimisticMutationState<TArgs extends unknown[], TResult> {
  /** Lance la mutation. Renvoie le résultat ou rejette. */
  run: (...args: TArgs) => Promise<TResult>;
  /** true pendant l'appel réseau. */
  pending: boolean;
  /** Dernière erreur, ou null. */
  error: Error | null;
  /** Reset l'erreur. */
  clearError: () => void;
}

/**
 * Helper de mutation avec UI optimiste et rollback automatique en cas d'erreur.
 *
 * Pattern :
 *   1. `optimisticUpdate` est appelé immédiatement et retourne `rollback`.
 *   2. `mutate` est lancé en arrière-plan.
 *   3. Si succès → `onSuccess`.
 *   4. Si erreur → rollback() puis `onError`.
 *
 * Empêche le double-submit pendant qu'une mutation est en vol.
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P1.4
 */
export function useOptimisticMutation<TArgs extends unknown[], TResult>(
  options: OptimisticMutationOptions<TArgs, TResult>,
): OptimisticMutationState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      if (inFlight.current) {
        throw new Error('Mutation déjà en cours');
      }
      inFlight.current = true;
      setPending(true);
      setError(null);

      const rollback = options.optimisticUpdate?.(...args) ?? undefined;

      try {
        const result = await options.mutate(...args);
        options.onSuccess?.(result, ...args);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (typeof rollback === 'function') {
          try {
            rollback();
          } catch (rollbackErr) {
            // Ne pas masquer l'erreur d'origine si rollback échoue.
            console.error('[useOptimisticMutation] rollback failed', rollbackErr);
          }
        }
        setError(err);
        options.onError?.(err, ...args);
        throw err;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [options],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, pending, error, clearError };
}
