/**
 * `InciTooltip` — bouton ⓘ + popover textuel qui affiche la définition
 * d'un terme INCI (Kolenda §4.5 + UX §7 Hide unnecessary).
 *
 * Pattern ARIA tooltip strict :
 *  - `<button>` natif (tab navigable, Enter/Space activable)
 *  - `aria-label` descriptif, `aria-expanded`, `aria-controls`
 *  - Contenu du popover avec `role="tooltip"`
 *  - Esc et click hors zone ferment le popover
 *  - Click sur le bouton émet `composition_inci_tooltip_open` (tracking)
 *
 * Implémentation : state local React + positionnement CSS absolu (pas
 * d'API `popover` HTML5 pour rester compatible JSDOM et < Chrome 114).
 */
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';

export interface InciTooltipProps {
  inciTerm: string;
  definition: string;
  subProductId: string;
}

export function InciTooltip({
  inciTerm,
  definition,
  subProductId,
}: InciTooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const { emit } = useTracking();

  const toggle = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation();
      setOpen((prev) => {
        const next = !prev;
        if (next) {
          emit('composition_inci_tooltip_open', {
            sub_product_id: subProductId,
            inci_term: inciTerm,
          });
        }
        return next;
      });
    },
    [emit, inciTerm, subProductId],
  );

  // Esc ferme.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Click hors zone ferme.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Définition de ${inciTerm}`}
        aria-expanded={open}
        aria-controls={popoverId}
        data-testid={`inci-tooltip-trigger-${subProductId}-${inciTerm}`}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-encre/55 hover:text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open ? (
        <span
          id={popoverId}
          role="tooltip"
          data-testid={`inci-tooltip-popover-${subProductId}-${inciTerm}`}
          className="absolute left-0 top-full z-50 mt-2 block w-64 max-w-xs rounded-md border border-encre/10 bg-creme p-3 shadow-md"
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-encre/55">
            {inciTerm}
          </span>
          <span className="mt-1 block text-sm text-encre">{definition}</span>
        </span>
      ) : null}
    </span>
  );
}
