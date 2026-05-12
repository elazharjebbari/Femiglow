/**
 * CHA-057 / CHA-244 — `ChatHeader`.
 *
 * CHA-244 — Bouton fermer redessiné : 44 × 44 (WCAG 2.5.5 AAA), icône
 * chevron-down (« retour à la page »), label texte « Fermer » visible
 * en plus de l'aria-label, pour qu'on trouve la sortie au premier
 * regard. cf. docs/admin-config/43-chat-mobile-ux-fix-runbook.md §C.
 */
'use client';

import { useChatStore } from './chat-store';

export function ChatHeader() {
  const close = useChatStore((s) => s.close);
  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white"
        >
          <span className="text-xs font-medium">FG</span>
        </div>
        <div>
          <p className="text-base font-medium text-stone-900">Assistante FemiGlow</p>
          <p className="text-xs text-stone-500">En ligne · répond en quelques secondes</p>
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Fermer le chat"
        data-testid="chat-close"
        // 44×44 = cible tactile WCAG 2.5.5 AAA. Label texte
        // « Fermer » visible (et non plus seulement aria-label) pour
        // que la sortie soit immédiatement identifiable sur mobile.
        className="inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Chevron-down = « retour à la page » (idiome bottom-sheet iOS/Android) */}
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Fermer</span>
      </button>
    </header>
  );
}
