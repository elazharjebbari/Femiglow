'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  error: 'bg-red-50 text-red-900 border-red-200',
  info: 'bg-stone-50 text-stone-900 border-stone-200',
};

const TONE_PREFIX: Record<ToastTone, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-md ${TONE_CLASS[t.tone]}`}
          >
            <span aria-hidden="true" className="mr-2">
              {TONE_PREFIX[t.tone]}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // En SSR ou si pas wrappé : fallback silencieux pour éviter les crash
    return { push: () => undefined };
  }
  return ctx;
}
