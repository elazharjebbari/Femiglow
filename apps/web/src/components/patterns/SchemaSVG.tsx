'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

const TRANSITION = { duration: 1.2, ease: [0.65, 0, 0.35, 1] as const };

/**
 * Phase 9 i18n — libellés anatomiques localisés (légendes SVG + aria +
 * figcaption). Défaut FR si absent → préserve les usages legacy.
 */
export interface SchemaSVGLabels {
  matrice: string;
  lit: string;
  plaque: string;
  aria: string;
  caption: string;
}

const DEFAULT_SCHEMA_LABELS: SchemaSVGLabels = {
  matrice: 'Matrice',
  lit: 'Lit unguéal',
  plaque: 'Plaque',
  aria: 'Coupe anatomique simplifiée d’un ongle : matrice, lit unguéal, plaque kératinisée',
  caption:
    'Coupe anatomique simplifiée : la matrice fabrique la kératine, le lit unguéal soutient la plaque, la plaque protège la pulpe du doigt.',
};

export function SchemaSVG({
  className,
  labels = DEFAULT_SCHEMA_LABELS,
}: {
  className?: string;
  labels?: SchemaSVGLabels;
}) {
  const reduced = useReducedMotion();

  const initialPath = reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 };
  const animatePath = { pathLength: 1, opacity: 1 };

  return (
    <LazyMotion features={domAnimation} strict>
      <figure className={className}>
        <svg
          role="img"
          aria-label={labels.aria}
          viewBox="0 0 480 320"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full max-w-[480px]"
        >
          <defs>
            <linearGradient id="schema-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-creme)" />
              <stop offset="100%" stopColor="var(--color-creme-warm)" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="480" height="320" fill="url(#schema-bg)" />

          {/* Calque 1 — Matrice (base de l\u2019ongle) */}
          <m.path
            d="M120 220 Q120 210 130 208 L210 196 Q220 195 220 205 L220 220 Z"
            fill="var(--color-petale-soft)"
            stroke="var(--color-petale-dark)"
            strokeWidth="1.5"
            initial={initialPath}
            whileInView={animatePath}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={TRANSITION}
          />

          {/* Calque 2 — Lit unguéal */}
          <m.path
            d="M130 208 Q130 195 145 192 L370 152 Q390 148 390 168 L390 200 Q390 210 380 211 L150 220 Q130 222 130 208 Z"
            fill="var(--color-petale-soft)"
            stroke="var(--color-encre)"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            initial={initialPath}
            whileInView={animatePath}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ ...TRANSITION, delay: 0.25 }}
          />

          {/* Calque 3 — Plaque kératinisée */}
          <m.path
            d="M150 192 Q150 178 170 174 L370 130 Q400 126 400 150 L400 200 Q400 218 378 218 L160 220 Q150 218 150 192 Z"
            fill="none"
            stroke="var(--color-encre)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            initial={initialPath}
            whileInView={animatePath}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ ...TRANSITION, delay: 0.5 }}
          />

          {/* Lignes de rappel */}
          <m.line
            x1="170" y1="210" x2="170" y2="270"
            stroke="var(--color-encre)" strokeOpacity="0.4" strokeWidth="0.8"
            initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 1 : 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ ...TRANSITION, delay: 0.75 }}
          />
          <m.line
            x1="270" y1="172" x2="270" y2="100"
            stroke="var(--color-encre)" strokeOpacity="0.4" strokeWidth="0.8"
            initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 1 : 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ ...TRANSITION, delay: 0.85 }}
          />
          <m.line
            x1="360" y1="178" x2="360" y2="100"
            stroke="var(--color-encre)" strokeOpacity="0.4" strokeWidth="0.8"
            initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 1 : 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ ...TRANSITION, delay: 0.95 }}
          />

          {/* Légendes */}
          <text x="170" y="288" textAnchor="middle"
                fontFamily="Inter, sans-serif" fontSize="11"
                fill="var(--color-encre)" fillOpacity="0.7">
            {labels.matrice}
          </text>
          <text x="270" y="92" textAnchor="middle"
                fontFamily="Inter, sans-serif" fontSize="11"
                fill="var(--color-encre)" fillOpacity="0.7">
            {labels.lit}
          </text>
          <text x="360" y="92" textAnchor="middle"
                fontFamily="Inter, sans-serif" fontSize="11"
                fill="var(--color-encre)" fillOpacity="0.7">
            {labels.plaque}
          </text>
        </svg>
        <figcaption className="sr-only">{labels.caption}</figcaption>
      </figure>
    </LazyMotion>
  );
}
