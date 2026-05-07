'use client';

import { useId } from 'react';

export function PromoCodeInput() {
  const inputId = useId();
  return (
    <div className="space-y-2 border-t border-encre/10 pt-4">
      <label
        htmlFor={inputId}
        className="block text-xs uppercase tracking-[0.18em] text-encre/60"
      >
        Code promo
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          disabled
          aria-disabled="true"
          placeholder="Disponible bientôt"
          className="w-full bg-creme/50 px-0 py-2 text-sm text-encre/40 placeholder:text-encre/30 border-b border-encre/15"
        />
        <button
          type="button"
          disabled
          className="text-xs uppercase tracking-[0.18em] text-encre/30 cursor-not-allowed"
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}
