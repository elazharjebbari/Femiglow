'use client';

/**
 * Wizard — squelette d'assistant partagé du socle emails (SOC-F05 / TRV-08).
 *
 * Corrige la rigidité des 3 wizards de l'audit (campagne/automation/audience) :
 *   - étapes DÉJÀ ATTEINTES cliquables (retour direct sans marteler Précédent),
 *     étapes futures inertes (aria-disabled) ;
 *   - `next()` sur étape invalide : avancée bloquée + message role=alert rendu
 *     À CÔTÉ du bouton Suivant (jamais en tête de page — AUTO-09/CAMP) ;
 *   - Ctrl+→ / Ctrl+← : navigation clavier ;
 *   - focus posé sur le TITRE de l'étape à chaque changement (lecteurs
 *     d'écran : l'étape annoncée immédiatement) ;
 *   - `persistKey` : étape courante + plus loin atteint persistés en
 *     sessionStorage — F5/remontage => reprise exacte (les DONNÉES restent la
 *     responsabilité du consommateur, cf. autosave F05).
 *
 * Consommateurs cibles : CampaignWizard (P3.2), AutomationWizard (P4.3),
 * AudienceWizard (P2.4) — adoption progressive, un wizard par chantier.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type WizardStep = {
  id: string;
  title: string;
  /** true = valide ; string = message d'erreur affiché près du bouton Suivant. */
  validate?: () => true | string;
  content: ReactNode;
};

export type WizardProps = {
  steps: WizardStep[];
  /** Persistance sessionStorage de l'étape (reprise après F5). */
  persistKey?: string;
  /** Libellé du bouton de la dernière étape (défaut « Terminer »). */
  finishLabel?: string;
  onFinish?: () => void;
  onStepChange?: (index: number) => void;
};

function storageKey(persistKey: string) {
  return `emails-wizard:${persistKey}`;
}

function restore(persistKey: string | undefined, stepCount: number): { current: number; furthest: number } {
  if (!persistKey) return { current: 0, furthest: 0 };
  try {
    const raw = sessionStorage.getItem(storageKey(persistKey));
    if (!raw) return { current: 0, furthest: 0 };
    const parsed = JSON.parse(raw) as { current?: number; furthest?: number };
    const furthest = Math.min(Math.max(parsed.furthest ?? 0, 0), stepCount - 1);
    const current = Math.min(Math.max(parsed.current ?? 0, 0), furthest);
    return { current, furthest };
  } catch {
    return { current: 0, furthest: 0 };
  }
}

export function Wizard({ steps, persistKey, finishLabel = 'Terminer', onFinish, onStepChange }: WizardProps) {
  const [{ current, furthest }, setPos] = useState(() => restore(persistKey, steps.length));
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);

  const persist = useCallback(
    (pos: { current: number; furthest: number }) => {
      if (!persistKey) return;
      try {
        sessionStorage.setItem(storageKey(persistKey), JSON.stringify(pos));
      } catch {
        /* stockage indisponible : la reprise est un confort, pas un contrat */
      }
    },
    [persistKey],
  );

  const moveTo = useCallback(
    (index: number) => {
      setPos((pos) => {
        const next = { current: index, furthest: Math.max(pos.furthest, index) };
        persist(next);
        return next;
      });
      setError(null);
      onStepChange?.(index);
    },
    [persist, onStepChange],
  );

  /** Clic barre d'étapes : atteintes uniquement (i <= furthest). */
  const goTo = useCallback(
    (index: number) => {
      if (index === current) return;
      if (index > furthest) return; // étape future : inerte
      moveTo(index);
    },
    [current, furthest, moveTo],
  );

  const next = useCallback(() => {
    const step = steps[current];
    if (!step) return;
    const verdict = step.validate?.() ?? true;
    if (verdict !== true) {
      setError(verdict);
      return;
    }
    if (current === steps.length - 1) {
      onFinish?.();
      return;
    }
    moveTo(current + 1);
  }, [current, steps, moveTo, onFinish]);

  const prev = useCallback(() => {
    if (current > 0) moveTo(current - 1);
  }, [current, moveTo]);

  // Focus sur le titre à CHAQUE changement d'étape (pas au montage initial —
  // on ne vole pas le focus d'une page qui se charge).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    titleRef.current?.focus();
  }, [current]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!e.ctrlKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    },
    [next, prev],
  );

  const step = steps[current];
  if (!step) return null;
  const isLast = current === steps.length - 1;

  return (
    <div onKeyDown={onKeyDown}>
      {/* Barre d'étapes */}
      <nav aria-label="Étapes">
        <ol className="mb-6 flex items-center gap-2 text-xs">
          {steps.map((s, i) => {
            const reached = i <= furthest;
            const isCurrent = i === current;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={!reached}
                  aria-disabled={!reached || undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
                    isCurrent
                      ? 'bg-stone-900 text-white'
                      : reached
                        ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        : 'cursor-not-allowed bg-stone-100 text-stone-400'
                  }`}
                >
                  <span aria-hidden="true">{i < current ? '✓' : i + 1}</span>
                  {s.title}
                </button>
                {i < steps.length - 1 ? (
                  <span aria-hidden="true" className="text-stone-300">
                    —
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Étape courante */}
      <h2
        ref={titleRef}
        tabIndex={-1}
        className="text-lg font-semibold text-stone-900 outline-none"
      >
        {current + 1}. {step.title}
      </h2>
      <div className="mt-3">{step.content}</div>

      {/* Navigation — le message d'erreur vit ICI, près du bouton Suivant. */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          ← Précédent
        </button>
        <div className="flex items-center gap-3">
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={next}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              isLast ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-stone-900 hover:bg-stone-800'
            }`}
          >
            {isLast ? finishLabel : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
}
