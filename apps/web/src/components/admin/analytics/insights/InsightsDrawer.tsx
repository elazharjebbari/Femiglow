/**
 * InsightsDrawer — panneau latéral de drill-down (page ou composant).
 * cf. docs/analytics-insights/13-wizard-design.md §11
 *
 * Comportement :
 *  - Slide right (translateX 100% → 0) en 320 ms
 *  - Esc pour fermer
 *  - Focus trap basique (focus initial sur bouton "Fermer")
 *  - Restauration du focus à la fermeture
 *  - Overlay cliquable pour fermer
 */
'use client';

import { useEffect, useRef } from 'react';

interface InsightsDrawerProps {
  open: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function InsightsDrawer({
  open,
  onClose,
  kicker,
  title,
  subtitle,
  children,
}: InsightsDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    closeBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insights-drawer-title"
      data-testid="insights-drawer"
      className="fixed inset-0 z-40"
    >
      <button
        type="button"
        aria-label="Fermer le drawer"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/30"
        data-testid="insights-drawer-overlay"
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-xl md:max-w-lg"
        style={{ animation: 'insights-drawer-slide 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <header className="flex items-start justify-between border-b border-stone-200 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {kicker}
            </p>
            <h2
              id="insights-drawer-title"
              className="mt-1 font-mono text-lg text-stone-900"
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded text-stone-500 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            data-testid="insights-drawer-close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>

      <style>{`
        @keyframes insights-drawer-slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          aside { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
