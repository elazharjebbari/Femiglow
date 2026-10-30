'use client';

/**
 * Kit CRO v2 §2 — Conteneur qui défile autour du wizard.
 *
 * En ligne (page /kit), c'est la fenêtre. Dans le panneau de commande
 * (`BottomSheet`), c'est le corps du panneau : la page est verrouillée, un
 * `window.scrollTo` n'aurait aucun effet visible. Les steps qui remontent
 * en haut (ex. « Nouvelle commande » du ThankYouStep) passent par
 * `scrollWizardToTop` pour viser le bon conteneur.
 */

import { createContext, useCallback, useContext, type ReactNode } from 'react';

type ContainerGetter = () => HTMLElement | null;

const WizardScrollContainerContext = createContext<ContainerGetter | null>(null);

export function WizardScrollContainerProvider({
  getContainer,
  children,
}: {
  getContainer: ContainerGetter;
  children: ReactNode;
}) {
  return (
    <WizardScrollContainerContext.Provider value={getContainer}>
      {children}
    </WizardScrollContainerContext.Provider>
  );
}

/** Remonte en haut du conteneur du wizard (panneau) ou de la fenêtre. */
export function useScrollWizardToTop(): () => void {
  const getContainer = useContext(WizardScrollContainerContext);
  return useCallback(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    const container = getContainer?.() ?? null;
    if (container) {
      if (typeof container.scrollTo === 'function') container.scrollTo({ top: 0, behavior });
      else container.scrollTop = 0;
      return;
    }
    window.scrollTo({ top: 0, behavior });
  }, [getContainer]);
}
