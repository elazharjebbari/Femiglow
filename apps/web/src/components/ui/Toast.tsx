'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type ToastItem = {
  id: string;
  message: string;
};

type ToastContextValue = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((current) => [...current, { id, message }]);
  }, []);

  useEffect(() => {
    const oldest = items[0];
    if (!oldest) return;
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((t) => t.id !== oldest.id));
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [items]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-24 mx-auto flex w-full max-w-sm flex-col items-center gap-2 px-4 lg:bottom-8"
        style={{ zIndex: 'var(--z-toast)' }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto rounded-md bg-encre px-4 py-3 text-sm text-creme shadow-lg"
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être appelé à l’intérieur de <ToastProvider>.');
  }
  return ctx;
}
