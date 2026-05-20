/**
 * `MediaCrossfade` — superposition de 2 medias avec transition opacité
 * pour la section « La composition » : image isolated (par défaut) ↔
 * image contextuelle (au hover desktop / tap mobile).
 *
 * Kolenda §4.3 + Ecommerce §6 : la cible féminine bénéficie d'un mix
 * isolated → contextual (≥ 60 % contextuel recommandé), mais on
 * privilégie l'isolated comme "premier état" pour préserver la
 * pédagogie produit (le pot d'abord, la main ensuite).
 *
 * Comportements :
 *  - **Pas de `contextual`** → rend `isolated` seul, sans interaction.
 *  - **Avec `contextual`** :
 *     - desktop : hover déclenche le crossfade ;
 *     - mobile : tap toggle ;
 *     - clavier : Enter/Space sur le wrapper (role="button") ;
 *     - `aria-pressed` reflète l'état actif.
 *  - **`prefers-reduced-motion`** : pas de transition CSS (basculement
 *    immédiat). Le `motion-reduce:` Tailwind permettrait d'aller plus
 *    loin si on veut désactiver visuellement le toggle.
 *
 * Bénéficie d'un `data-testid="composition-card-media"` pour Playwright
 * E2E (cf. docs/.../07-tests-strategy.md §4.4).
 */
'use client';

import { useState, type ReactNode } from 'react';

export interface MediaCrossfadeProps {
  isolated: ReactNode;
  contextual?: ReactNode;
  /** Description courte du média pour l'`aria-label` du wrapper actif. */
  alt: string;
}

export function MediaCrossfade({
  isolated,
  contextual,
  alt,
}: MediaCrossfadeProps): JSX.Element {
  const [active, setActive] = useState(false);
  const hasContextual = Boolean(contextual);

  return (
    <div
      className="relative overflow-hidden rounded-sm"
      onMouseEnter={hasContextual ? () => setActive(true) : undefined}
      onMouseLeave={hasContextual ? () => setActive(false) : undefined}
      onTouchStart={hasContextual ? () => setActive((p) => !p) : undefined}
      role={hasContextual ? 'button' : undefined}
      aria-label={
        hasContextual ? `Voir « ${alt} » en contexte` : undefined
      }
      aria-pressed={hasContextual ? active : undefined}
      tabIndex={hasContextual ? 0 : undefined}
      onKeyDown={
        hasContextual
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActive((prev) => !prev);
              }
            }
          : undefined
      }
      data-testid="composition-card-media"
    >
      <div
        className={[
          'transition-opacity duration-500 motion-reduce:transition-none',
          active ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
        aria-hidden={active ? 'true' : 'false'}
      >
        {isolated}
      </div>
      {hasContextual ? (
        <div
          className={[
            'absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none',
            active ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={active ? 'false' : 'true'}
        >
          {contextual}
        </div>
      ) : null}
    </div>
  );
}
