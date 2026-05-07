'use client';

import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui/Text';

export function SuccessState() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3 border-l-2 border-sauge pl-6 py-2"
    >
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl text-encre focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
      >
        Bien reçu. La maison vous répond.
      </h3>
      <Text size="body" tone="secondary">
        Nous lisons chaque message avec attention. Réponse sous 24 heures
        ouvrées.
      </Text>
    </div>
  );
}
