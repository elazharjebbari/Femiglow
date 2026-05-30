'use client';

import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui/Text';

interface SuccessStateProps {
  /** Phase 7 wiring — titre localisé. Défaut FR si absent. */
  title?: string;
  /** Phase 7 wiring — corps localisé. Défaut FR si absent. */
  body?: string;
}

export function SuccessState({
  title = 'Bien reçu. La maison vous répond.',
  body = 'Nous lisons chaque message avec attention. Réponse sous 24 heures ouvrées.',
}: SuccessStateProps = {}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3 border-s-2 border-sauge ps-6 py-2"
    >
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl text-encre focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
      >
        {title}
      </h3>
      <Text size="body" tone="secondary">
        {body}
      </Text>
    </div>
  );
}
