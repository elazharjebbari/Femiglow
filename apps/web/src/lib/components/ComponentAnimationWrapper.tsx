'use client';

/**
 * `<ComponentAnimationWrapper>` — wrapper client qui applique le profil
 * d'animation associé à un composant. Respecte `prefers-reduced-motion`
 * quand `respectsReducedMotion=true` (par défaut).
 *
 * Côté serveur : le profil est résolu par `resolveComponentSlot()` puis
 * passé via props. Le wrapper ne fait pas de fetch supplémentaire.
 */
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import type { ReactNode, CSSProperties } from 'react';
import type { AnimationKind } from '@/lib/db/types';

export interface AnimationProfileLite {
  key: string;
  kind: AnimationKind;
  config: Record<string, unknown>;
  respectsReducedMotion: boolean;
}

interface ComponentAnimationWrapperProps {
  profile?: AnimationProfileLite | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** override des params (ex : { delay: 200 }). */
  overrides?: Record<string, unknown>;
}

export function ComponentAnimationWrapper({
  profile,
  children,
  className,
  style,
  overrides,
}: ComponentAnimationWrapperProps) {
  const reduced = useReducedMotion();

  if (!profile || profile.kind === 'none') {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  if (reduced && profile.respectsReducedMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  if (profile.kind === 'framer-motion') {
    const cfg = { ...profile.config, ...(overrides ?? {}) } as Record<string, unknown>;
    // motion props are typed loosely from JSON config — cast pragmatique.
    const motionProps = {
      initial: cfg.initial,
      animate: cfg.animate,
      whileInView: cfg.whileInView,
      whileHover: cfg.whileHover,
      viewport: cfg.viewport,
      transition: cfg.transition,
    } as Record<string, unknown>;
    return (
      <LazyMotion features={domAnimation} strict>
        <m.div className={className} style={style} {...motionProps}>
          {children}
        </m.div>
      </LazyMotion>
    );
  }

  if (profile.kind === 'css') {
    // Les animations CSS sont déclenchées via `data-animate` + classes Tailwind.
    return (
      <div
        className={className}
        style={style}
        data-animate={profile.key}
      >
        {children}
      </div>
    );
  }

  // svg : on délègue le pilotage à l'enfant SVG ; on ajoute juste un data-attr.
  return (
    <div className={className} style={style} data-animate={profile.key}>
      {children}
    </div>
  );
}
