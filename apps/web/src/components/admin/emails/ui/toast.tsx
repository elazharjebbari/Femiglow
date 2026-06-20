'use client';

/**
 * ToastProvider / useToast — feedback de mutation unifié (SOC-F02 / TRV-02).
 *
 * Règles (spec F01-socle-feedback/02-spec-technique.yaml) :
 *   - succès : auto-dismiss 4 s, libellé formulé RÉSULTAT (« 3 emails
 *     relancés »), jamais « opération effectuée » ;
 *   - erreur : PERSISTANTE (fermeture manuelle), role=alert, message
 *     actionnable, bouton « Réessayer » optionnel rejouant la MÊME action ;
 *   - zéro faux succès : l'appelant n'appelle success() QUE sur res.ok
 *     (contrat vérifié par les tests des consommateurs) ;
 *   - pile plafonnée à 3 : éviction du succès le plus ancien, une erreur
 *     n'est JAMAIS évincée ; plus récent en tête ;
 *   - UNE seule live-region polite (les erreurs portent leur role=alert).
 *
 * Montage : UNE fois dans app/admin/emails/layout.tsx.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FOCUS } from './tokens';

type ToastTone = 'success' | 'error';

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  onRetry?: () => void;
};

export type ToastApi = {
  success: (message: string, opts?: { duration?: number }) => number;
  error: (message: string, opts?: { onRetry?: () => void }) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_STACK = 3;
const SUCCESS_DISMISS_MS = 4000;

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() doit être appelé sous <ToastProvider> (layout /admin/emails).');
  }
  return ctx;
}

/**
 * Variante TOLÉRANTE pour l'adoption incrémentale : null hors provider.
 * En prod le provider est TOUJOURS là (layout /admin/emails) ; cette variante
 * n'existe que pour les écrans en cours de migration dont les anciens harnais
 * de test montent le composant nu. Un écran 100 % migré repasse à useToast().
 */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  // Plus récent EN TÊTE (ordre du viewport).
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((item: ToastItem) => {
    setToasts((list) => {
      const next = [item, ...list];
      if (next.length <= MAX_STACK) return next;
      // Cap : évince le SUCCÈS le plus ancien (jamais une erreur).
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i]!.tone === 'success' && next[i]!.id !== item.id) {
          const evicted = next[i]!;
          const timer = timersRef.current.get(evicted.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(evicted.id);
          }
          next.splice(i, 1);
          return next;
        }
      }
      return next; // que des erreurs : on tolère le dépassement
    });
  }, []);

  const success = useCallback<ToastApi['success']>(
    (message, opts) => {
      idRef.current += 1;
      const id = idRef.current;
      push({ id, tone: 'success', message });
      const timer = setTimeout(() => dismiss(id), opts?.duration ?? SUCCESS_DISMISS_MS);
      timersRef.current.set(id, timer);
      return id;
    },
    [push, dismiss],
  );

  const error = useCallback<ToastApi['error']>(
    (message, opts) => {
      idRef.current += 1;
      const id = idRef.current;
      push({ id, tone: 'error', message, onRetry: opts?.onRetry });
      return id;
    },
    [push],
  );

  // Nettoyage des timers au démontage.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ success, error, dismiss }), [success, error, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* UNE seule live-region polite pour la pile (TRV-02). */}
      <div
        data-testid="toast-viewport"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : undefined}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') dismiss(t.id);
            }}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-md ${
              t.tone === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
            }`}
          >
            <span aria-hidden="true">{t.tone === 'error' ? '⚠' : '✓'}</span>
            <p className="flex-1">{t.message}</p>
            {t.onRetry ? (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  t.onRetry?.();
                }}
                className={`rounded border border-rose-300 bg-white px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 ${FOCUS}`}
              >
                Réessayer
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => dismiss(t.id)}
              className={`rounded text-current opacity-60 hover:opacity-100 ${FOCUS}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
