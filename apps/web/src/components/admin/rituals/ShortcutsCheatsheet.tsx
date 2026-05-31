'use client';
import { useEffect } from 'react';
import type { KeyboardShortcut } from '@/lib/admin/use-keyboard-shortcuts';

interface ShortcutsCheatsheetProps {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export function ShortcutsCheatsheet({
  open,
  onClose,
  shortcuts,
}: ShortcutsCheatsheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-cheatsheet-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      onClick={onClose}
      data-testid="shortcuts-cheatsheet"
    >
      <div
        className="w-full max-w-md rounded border border-stone-200 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="shortcuts-cheatsheet-title"
          className="mb-4 font-serif text-xl text-stone-900"
        >
          Raccourcis clavier
        </h2>
        <dl className="space-y-2 text-sm">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className={`flex items-baseline justify-between gap-4 ${
                s.enabled === false ? 'opacity-40' : ''
              }`}
            >
              <dt>
                <kbd className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 font-mono text-xs">
                  {s.key === ' ' ? 'Espace' : s.key}
                </kbd>
              </dt>
              <dd className="flex-1 text-stone-700">{s.description}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
