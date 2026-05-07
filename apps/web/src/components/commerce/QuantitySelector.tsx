'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface QuantitySelectorProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  productName: string;
  productId: string;
  className?: string;
}

const buttonClasses = cn(
  'inline-flex h-11 w-11 items-center justify-center rounded-full',
  'border border-encre/30 bg-creme text-encre',
  'transition-transform duration-fast ease-out-soft',
  'hover:border-encre active:scale-95',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]',
  'focus-visible:outline-encre disabled:cursor-not-allowed disabled:opacity-40',
  'motion-reduce:transition-none motion-reduce:active:scale-100',
);

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  productName,
  productId,
  className,
}: QuantitySelectorProps) {
  const [localValue, setLocalValue] = useState(value);
  const liveMessageRef = useRef<string>('');
  const [liveMessage, setLiveMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const liveId = useId();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function commit(next: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(next);
    }, 200);
  }

  function announce(message: string) {
    liveMessageRef.current = message;
    setLiveMessage('');
    requestAnimationFrame(() => setLiveMessage(message));
  }

  function applyDelta(delta: number) {
    const next = localValue + delta;
    if (next < min) {
      announce(`Quantit\u00e9 minimale atteinte\u202F: ${min}.`);
      return;
    }
    if (next > max) {
      announce(`Quantit\u00e9 maximale atteinte\u202F: ${max}.`);
      return;
    }
    setLocalValue(next);
    announce(`Quantit\u00e9\u202F: ${next}.`);
    commit(next);
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number(event.target.value);
    if (Number.isNaN(raw)) return;
    const clamped = Math.max(min, Math.min(max, Math.trunc(raw)));
    setLocalValue(clamped);
    announce(`Quantit\u00e9\u202F: ${clamped}.`);
    commit(clamped);
  }

  return (
    <div
      className={cn('inline-flex items-center gap-2', className)}
      role="group"
      aria-labelledby={inputId}
    >
      <span id={inputId} className="sr-only">
        {'Quantit\u00e9 pour '}
        {productName}
      </span>
      <button
        type="button"
        className={buttonClasses}
        onClick={() => applyDelta(-1)}
        aria-label={`Diminuer la quantit\u00e9 de ${productName}`}
        disabled={localValue <= min}
        data-testid={`qty-decrement-${productId}`}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {'\u2212'}
        </span>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={localValue}
        onChange={handleInput}
        aria-label={`Quantit\u00e9 de ${productName}`}
        aria-describedby={liveId}
        className={cn(
          'h-11 w-14 border-b border-encre/30 bg-transparent text-center',
          'font-body text-base text-encre',
          'focus:border-encre focus:outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
      <button
        type="button"
        className={buttonClasses}
        onClick={() => applyDelta(1)}
        aria-label={`Augmenter la quantit\u00e9 de ${productName}`}
        disabled={localValue >= max}
        data-testid={`qty-increment-${productId}`}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {'+'}
        </span>
      </button>
      <span
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMessage}
      </span>
    </div>
  );
}
