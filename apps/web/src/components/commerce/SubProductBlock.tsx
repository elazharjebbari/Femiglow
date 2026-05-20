/**
 * `SubProductBlock` — bloc complet pour un sous-produit dans la section
 * « Le détail » de `/kit`. Encapsule :
 *  - pastille numérotée (NumberBadge réutilisé)
 *  - titre + volume + usageHint inline
 *  - intro narrative italique (à venir Phase 4 — slot prévu)
 *  - liste responsive (cards mobile / tableau desktop)
 *  - certifications chips
 *  - lien retour « Voir le pack ↓ »
 *
 * Sur mobile (< 640 px), le bloc est un accordéon `<details>` contrôlé :
 * `defaultOpen` détermine l'état initial, l'utilisateur peut ouvrir/fermer.
 * Sur desktop (≥ 640 px), tout est ouvert en permanence via état `open=true`
 * appliqué après hydratation (hook `useIsDesktop`).
 *
 * cf. docs/ingredients-detail-optim-2026-05/05-frontend-public-design.md §3
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { NumberBadge } from '@/components/kit/NumberBadge';
import { NarrativeIntro } from './NarrativeIntro';
import { PostCtaLink } from './PostCtaLink';
import { ResponsiveIngredientList } from './ResponsiveIngredientList';
import { resolveAccentHex } from '@/lib/composition/copy';
import { useTracking } from '@/lib/tracking/use-tracking';
import type { SubProduct } from '@/lib/schemas';

export interface SubProductBlockProps {
  subProduct: SubProduct;
  index: number;
  anchor: string;
  defaultOpen?: boolean;
}

/**
 * Hook léger qui retourne `true` quand la viewport dépasse 640 px (Tailwind
 * `sm` breakpoint). Côté SSR, retourne `false` (mobile-first).
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

export function SubProductBlock({
  subProduct,
  index,
  anchor,
  defaultOpen = false,
}: SubProductBlockProps): JSX.Element {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(defaultOpen);
  const titleId = useId();
  const accent = resolveAccentHex(subProduct.accentColor);
  const { emit } = useTracking();
  const accordionTracked = useRef(false);

  // Sur desktop, on force toujours ouvert. Sur mobile, l'utilisateur pilote.
  const effectiveOpen = isDesktop || open;

  return (
    <article
      id={`${anchor}-${subProduct.id}`}
      aria-labelledby={titleId}
      data-testid={`sub-product-block-${subProduct.id}`}
    >
      <details
        open={effectiveOpen}
        onToggle={(e) => {
          const nextOpen = e.currentTarget.open;
          // Synchronise l'état local quand l'utilisateur clique sur summary.
          if (!isDesktop) setOpen(nextOpen);
          // Émet `composition_accordion_open` uniquement à la première
          // ouverture utilisateur (mobile) — pas au mount, pas en fermeture.
          if (nextOpen && !accordionTracked.current && !isDesktop) {
            accordionTracked.current = true;
            emit('composition_accordion_open', {
              sub_product_id: subProduct.id,
              sub_product_name: subProduct.name,
            });
          }
        }}
        className="group [&[open]_.chevron]:rotate-180"
      >
        <summary
          id={titleId}
          className="cursor-pointer list-none flex items-baseline gap-4 py-3 [&::-webkit-details-marker]:hidden sm:cursor-default sm:pointer-events-none"
        >
          <NumberBadge
            label={String(index + 1).padStart(2, '0')}
            hex={accent}
            className="!relative !top-0 !left-0 shrink-0"
          />
          <h3 className="flex-1 font-display text-2xl text-encre">
            {subProduct.name} — {subProduct.volume}
            {subProduct.usageHint ? (
              <span className="ml-2 font-body italic text-base text-encre/55">
                · {subProduct.usageHint}
              </span>
            ) : null}
          </h3>
          <span
            aria-hidden="true"
            className="chevron sm:hidden transition-transform text-encre/60"
          >
            ▾
          </span>
        </summary>

        <div className="mt-4 space-y-6">
          {subProduct.narrative ? (
            <NarrativeIntro
              text={subProduct.narrative}
              subProductId={subProduct.id}
            />
          ) : null}

          <ResponsiveIngredientList
            ingredients={subProduct.ingredients}
            subProductId={subProduct.id}
            accentColor={subProduct.accentColor}
          />

          {subProduct.certifications.length > 0 ? (
            <ul
              className="flex flex-wrap gap-2"
              aria-label={`Certifications de ${subProduct.name}`}
              data-testid={`certifications-${subProduct.id}`}
            >
              {subProduct.certifications.map((cert) => (
                <li
                  key={`${subProduct.id}-${cert.label}`}
                  className="rounded-full border border-champagne-dark/40 bg-champagne-soft px-3 py-1 text-xs text-encre/80"
                >
                  {cert.label} — {cert.body}
                </li>
              ))}
            </ul>
          ) : null}

          <PostCtaLink subProductId={subProduct.id} />
        </div>
      </details>
    </article>
  );
}
