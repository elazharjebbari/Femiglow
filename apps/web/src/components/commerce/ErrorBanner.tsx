'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface ErrorBannerProps {
  title: string;
  description?: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ title, description, onDismiss }: ErrorBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className={cn(
        'flex flex-col gap-2 border border-petale-dark bg-petale-soft/40 px-5 py-4 text-encre',
        'sm:flex-row sm:items-start sm:justify-between sm:gap-6',
      )}
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-petale-dark">
          {title}
        </p>
        {description && (
          <p className="text-sm text-encre/80">{description}</p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="self-start text-xs uppercase tracking-[0.18em] text-encre/60 underline-offset-4 hover:text-encre hover:underline"
        >
          Fermer
        </button>
      )}
    </div>
  );
}
