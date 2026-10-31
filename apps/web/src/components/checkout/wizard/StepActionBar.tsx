'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useVisualViewportKeyboardInset } from '@/components/chat/hooks/use-visual-viewport';
import { useCommanderLauncherStore } from '@/lib/checkout/commander-launcher';
import { useCommanderOnScreen } from '@/lib/checkout/use-commander-on-screen';
import { cn } from '@/lib/utils/cn';

import { useIsWizardInPanel } from './wizard-scroll-container';

/** En deçà, c'est la barre d'adresse du navigateur, pas le clavier. */
const KEYBOARD_MIN_HEIGHT_PX = 80;

export interface StepActionBarProps {
  /** Rendu avec l'état du clavier : la barre se compacte quand il est ouvert. */
  children: (state: { keyboardOpen: boolean }) => ReactNode;
  /** Masquée clavier ouvert : rien à confirmer pendant la recherche de ville. */
  hideWithKeyboard?: boolean;
}

/**
 * Barre d'action de l'étape 2 : toujours à portée de pouce en mobile, dans le
 * flux à partir de `lg`. Dans la page, elle n'existe que formulaire à l'écran :
 * plus haut, c'est `StickyCartCTA` qui ramène la cliente.
 *
 * Pendant qu'elle est là, le bouton de chat s'efface : il recouvrirait le CTA.
 */
export function StepActionBar({ children, hideWithKeyboard }: StepActionBarProps) {
  const inPanel = useIsWizardInPanel();
  const onScreen = useCommanderOnScreen(!inPanel);
  const keyboardInset = useVisualViewportKeyboardInset(true);
  const keyboardOpen = keyboardInset >= KEYBOARD_MIN_HEIGHT_PX;

  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setBarHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const visible = (inPanel || onScreen) && !(hideWithKeyboard && keyboardOpen);

  const setActionBarActive = useCommanderLauncherStore((s) => s.setActionBarActive);
  useEffect(() => {
    if (inPanel) return;
    setActionBarActive(onScreen);
    return () => setActionBarActive(false);
  }, [inPanel, onScreen, setActionBarActive]);

  return (
    <>
      {/* La barre fixe ne doit pas recouvrir la fin du formulaire. */}
      {!inPanel && <div aria-hidden="true" className="lg:hidden" style={{ height: barHeight }} />}
      <div
        ref={barRef}
        data-testid="wizard-action-bar"
        data-visible={visible}
        style={{
          zIndex: 'var(--z-sticky)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          // iOS ne réduit pas la fenêtre : la barre doit remonter avec le
          // clavier. Le panneau, lui, se relève déjà de cette hauteur.
          transform: !inPanel && keyboardInset > 0 ? `translateY(-${keyboardInset}px)` : undefined,
        }}
        className={cn(
          'border-t border-encre/10 bg-creme px-4 pt-3 shadow-[0_-6px_18px_rgb(44_42_40/0.06)]',
          'data-[visible=false]:max-lg:invisible',
          inPanel
            ? 'sticky bottom-0 -mx-6 -mb-10 sm:-mx-8 sm:-mb-8 sm:px-8'
            : 'fixed inset-x-0 bottom-0 lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none',
        )}
      >
        <div className="mx-auto max-w-2xl space-y-2.5">{children({ keyboardOpen })}</div>
      </div>
    </>
  );
}
