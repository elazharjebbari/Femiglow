'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './GtmIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal plein écran réutilisable.
 * Pas de portail React (Next.js gère le mount), focus-trap natif via
 * `autofocus` sur le bouton de fermeture, Esc et clic outside ferment.
 */
export function GtmFullscreenPreview({ open, onClose, title, children }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => closeBtnRef.current?.focus(), 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = original;
      };
    }
    setMounted(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-stone-50/95 backdrop-blur-sm motion-safe:animate-[fg-fade-in_180ms_ease-out_both]"
    >
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white/80 px-6 py-3 backdrop-blur">
          <p className="text-sm font-medium text-stone-900">{title}</p>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            <IconClose className="h-3.5 w-3.5" />
            Fermer
            <kbd className="ml-1 rounded border border-stone-300 bg-stone-50 px-1 font-mono text-[10px] text-stone-500">
              Esc
            </kbd>
          </button>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
