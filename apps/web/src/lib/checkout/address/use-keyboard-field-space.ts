'use client';

import { useEffect, type RefObject } from 'react';

import { measureWizardTopInset } from '@/lib/checkout/wizard-arrival';

/** En deçà, c'est la barre d'adresse du navigateur, pas le clavier. */
const KEYBOARD_MIN_HEIGHT_PX = 80;
/** Certains navigateurs signalent le clavier en retard, ou pas du tout. */
const KEYBOARD_SETTLE_MS = 320;
/** Libellé au-dessus du champ, à garder visible. */
const FIELD_LABEL_SPACE_PX = 32;

/**
 * Mobile : quand le clavier s'ouvre, le champ actif remonte sous l'en-tête. Il
 * reste alors de la place au-dessus du clavier pour le champ, la liste de villes
 * et la barre d'action. Une seule fois par focus : la cliente garde la main si
 * elle fait défiler ensuite.
 */
export function useKeyboardFieldSpace(
  rootRef: RefObject<HTMLElement>,
  { inPanel = false }: { inPanel?: boolean } = {},
): void {
  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;
    if (!root || !viewport) return;

    let field: HTMLElement | null = null;
    let timer = 0;

    const align = () => {
      if (!field || document.activeElement !== field) return;
      const keyboard = window.innerHeight - viewport.height - viewport.offsetTop;
      if (keyboard < KEYBOARD_MIN_HEIGHT_PX) return;
      const top = inPanel ? 0 : measureWizardTopInset();
      field.style.scrollMarginTop = `${top + FIELD_LABEL_SPACE_PX}px`;
      field.scrollIntoView({ block: 'start', behavior: 'auto' });
      field = null;
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      field = target;
      window.clearTimeout(timer);
      timer = window.setTimeout(align, KEYBOARD_SETTLE_MS);
    };

    root.addEventListener('focusin', onFocusIn);
    viewport.addEventListener('resize', align);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener('focusin', onFocusIn);
      viewport.removeEventListener('resize', align);
    };
  }, [rootRef, inPanel]);
}
