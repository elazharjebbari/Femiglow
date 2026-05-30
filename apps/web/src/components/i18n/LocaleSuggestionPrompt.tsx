/**
 * Locale Switcher V2 / Moteur — `LocaleSuggestionPrompt` (lots L5/L10).
 *
 * Proposition de bascule **discrète et non-intrusive** (ADR-006, INV-20) :
 *  - `surface='pearl'` : perle ancrée bas-fin (mismatch léger)
 *  - `surface='toast'` : toast bas (exit-rescue)
 * Deux choix **symétriques** (passer / rester) — jamais de modale, jamais
 * d'auto-redirect. Non-modal (n'emprisonne pas le focus de la page) ;
 * `Échap` = rester. Libellés fournis en props (résolus serveur, endonyme).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/04-frontend/engine-runtime.md §5
 */
'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import type { Locale } from '@/i18n.config';

export interface LocaleSuggestionPromptProps {
  suggested: Locale;
  surface: 'pearl' | 'toast';
  /** CTA « passer dans la langue suggérée » (endonyme). */
  switchLabel: string;
  /** CTA « rester » (dans la langue servie). */
  stayLabel: string;
  ariaLabel: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function LocaleSuggestionPrompt({
  suggested,
  surface,
  switchLabel,
  stayLabel,
  ariaLabel,
  onAccept,
  onDismiss,
}: LocaleSuggestionPromptProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  // Échap = rester (dismiss). N'emprisonne PAS le focus (non-modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const isToast = surface === 'toast';

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      data-testid="locale-suggestion-prompt"
      data-surface={surface}
      data-suggested={suggested}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'fixed z-[110] flex items-center gap-3 rounded border border-encre/10 bg-creme/95 px-4 py-3 shadow-sm backdrop-blur',
        isToast
          ? 'inset-x-4 bottom-4 justify-between sm:inset-x-auto sm:end-6 sm:w-[360px]'
          : 'bottom-5 end-5 sm:end-7',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onAccept}
        data-testid="locale-suggestion-accept"
        className="font-body text-sm font-medium text-encre underline decoration-sauge underline-offset-4 transition-colors hover:decoration-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre"
      >
        {switchLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        data-testid="locale-suggestion-dismiss"
        className="font-body text-xs text-encre/60 transition-colors hover:text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre"
      >
        {stayLabel}
      </button>
    </motion.div>
  );
}
