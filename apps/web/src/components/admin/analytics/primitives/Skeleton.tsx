/**
 * Skeleton — bloc gris animé pour les états de chargement.
 * cf. docs/analytics/04-ui-design.md §3.9 et §7.1
 *
 * Respecte `prefers-reduced-motion` : retire l'animation pulse pour les
 * utilisateurs sensibles aux animations.
 */
import type { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...rest }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`animate-pulse rounded bg-stone-200 motion-reduce:animate-none ${className}`}
      {...rest}
    />
  );
}
