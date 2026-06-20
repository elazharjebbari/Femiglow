/**
 * Card — conteneur de section du socle emails (charte 09 §A.2).
 * Rayon + bordure stone + padding tokenisés ; titre optionnel (TYPO.cardHeading).
 */
import type { ReactNode } from 'react';
import { RADIUS, SPACE, TYPO } from './tokens';

export type CardProps = {
  title?: ReactNode;
  /** Action en tête de carte (lien/bouton) — alignée à droite du titre. */
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({ title, action, compact = false, className = '', children }: CardProps) {
  return (
    <section
      className={`${RADIUS.card} border border-stone-200 bg-white ${
        compact ? SPACE.cardCompact : SPACE.card
      } ${className}`}
    >
      {title || action ? (
        <header className="mb-2 flex items-center justify-between gap-2">
          {title ? <h2 className={TYPO.cardHeading}>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
