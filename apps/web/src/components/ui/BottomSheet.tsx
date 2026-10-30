'use client';

/**
 * `BottomSheet` — panneau modal qui monte du bas de l'écran (mobile) et
 * s'affiche en panneau centré (desktop, `md+`).
 *
 * Construit sur Radix Dialog (déjà installé) qui fournit l'essentiel de
 * l'accessibilité : `role="dialog"`, nom accessible depuis le titre, piège à
 * focus, Échap, clic sur le fond, verrouillage du défilement de la page
 * (react-remove-scroll, iOS compris). On y ajoute `aria-modal` et le retour
 * du focus à l'élément actif à l'ouverture (Radix ne le fait que pour un
 * `Dialog.Trigger`, or nos déclencheurs sont répartis dans la page).
 *
 * Ajouts :
 *  - **Bouton retour du navigateur** : `history.pushState` à l'ouverture,
 *    `popstate` ferme le panneau. Une fermeture par l'interface (croix, fond,
 *    Échap, `open=false` du parent) appelle `history.back()` UNIQUEMENT si
 *    c'est nous qui avons poussé l'entrée. L'état Next (`__NA`, arbre) est
 *    recopié dans l'entrée poussée : le routeur ne recharge pas la page.
 *    Chaque ouverture marque son entrée d'un jeton unique : le `popstate`
 *    produit par notre propre `back()` après une réouverture immédiate est
 *    ignoré, et le démontage ne recule que si notre entrée est encore la
 *    courante.
 *  - **Échap dans une liste de suggestions** (combobox ouverte, ex. villes) :
 *    seule la liste se ferme, pas le panneau (l'écouteur Échap de Radix, en
 *    capture sur `document`, passe avant celui du champ).
 *  - **Clavier virtuel** : `visualViewport` → `padding-bottom` dynamique
 *    (même logique que `ChatPanel`), plus les zones sûres (`env(safe-area-*)`).
 *  - **Hauteur** : mobile `100dvh` moins une marge haute, défilement interne
 *    (`bodyRef` expose le conteneur qui défile) ; desktop panneau `max-w-2xl`.
 *  - **Mouvement** : montée + fondu via `@keyframes` locales indexées sur
 *    `data-state` (Radix attend la fin de l'animation de sortie avant de
 *    démonter). Aucune animation sous `prefers-reduced-motion`.
 *  - `onExitComplete` : appelé quand le contenu est réellement démonté (après
 *    l'animation de sortie) — permet à l'appelant de ne monter qu'une seule
 *    instance d'un composant à la fois (ex. le wizard en ligne / dans le panneau).
 *
 * z-index : token `--z-modal` (au-dessus des barres sticky et du chat,
 * sous les toasts).
 */

import * as Dialog from '@radix-ui/react-dialog';
import { forwardRef, useEffect, useRef, type ReactNode } from 'react';

import { useVisualViewportKeyboardInset } from '@/components/chat/hooks/use-visual-viewport';
import { cn } from '@/lib/utils/cn';

/** Marqueur posé dans l'entrée d'historique poussée à l'ouverture (valeur : jeton). */
export const BOTTOM_SHEET_HISTORY_FLAG = '__fgBottomSheet';

/** Préfixe propre à ce chargement de page : un jeton d'une visite antérieure
 *  (l'état d'historique survit au rechargement) n'est jamais pris pour le nôtre. */
const PAGE_LOAD_ID = Math.random().toString(36).slice(2, 10);
let historyTokenSeq = 0;

function nextHistoryToken(): string {
  historyTokenSeq += 1;
  return `${PAGE_LOAD_ID}:${historyTokenSeq}`;
}

/** Jeton porté par un état d'historique, ou `null`. */
function historyTokenOf(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const token = (state as Record<string, unknown>)[BOTTOM_SHEET_HISTORY_FLAG];
  return typeof token === 'string' ? token : null;
}

/** Combobox ouverte (`aria-expanded="true"`) ou liste de suggestions. */
const OPEN_POPUP_SELECTOR = [
  '[role="combobox"][aria-expanded="true"]',
  '[aria-haspopup][aria-expanded="true"]:not([aria-haspopup="false"])',
  '[role="listbox"]',
].join(', ');

/**
 * L'Échap vise-t-il une liste ouverte DANS le panneau ? Elle doit alors se
 * fermer seule (le champ gère sa touche), sans fermer le panneau.
 */
export function isEscapeForOpenPopup(
  target: EventTarget | null,
  container: Element | null,
): boolean {
  if (!(target instanceof Element)) return false;
  const popup = target.closest(OPEN_POPUP_SELECTOR);
  return Boolean(popup && (!container || container.contains(popup)));
}

/** Feuille de style locale : keyframes + respect de `prefers-reduced-motion`. */
const SHEET_STYLES = `
@keyframes fg-sheet-overlay-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fg-sheet-overlay-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes fg-sheet-up { from { transform: translate3d(0, 100%, 0) } to { transform: translate3d(0, 0, 0) } }
@keyframes fg-sheet-down { from { transform: translate3d(0, 0, 0) } to { transform: translate3d(0, 100%, 0) } }
@keyframes fg-sheet-pop-in { from { opacity: 0; transform: translate3d(0, 16px, 0) scale(.98) } to { opacity: 1; transform: none } }
@keyframes fg-sheet-pop-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translate3d(0, 16px, 0) scale(.98) } }
[data-fg-sheet-overlay][data-state='open'] { animation: fg-sheet-overlay-in 240ms ease-out }
[data-fg-sheet-overlay][data-state='closed'] { animation: fg-sheet-overlay-out 200ms ease-in }
[data-fg-sheet][data-state='open'] { animation: fg-sheet-up 320ms cubic-bezier(.22,1,.36,1) }
[data-fg-sheet][data-state='closed'] { animation: fg-sheet-down 220ms cubic-bezier(.4,0,1,1) }
@media (min-width: 768px) {
  [data-fg-sheet][data-state='open'] { animation: fg-sheet-pop-in 240ms cubic-bezier(.22,1,.36,1) }
  [data-fg-sheet][data-state='closed'] { animation: fg-sheet-pop-out 180ms ease-in }
}
@media (prefers-reduced-motion: reduce) {
  [data-fg-sheet-overlay], [data-fg-sheet] { animation: none !important }
}
`;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titre visible — nom accessible du dialogue. */
  title: ReactNode;
  /** Description courte (optionnelle) reliée via `aria-describedby`. */
  description?: ReactNode;
  /** `aria-label` du bouton de fermeture (localisé par l'appelant). */
  closeLabel: string;
  children: ReactNode;
  /** Sens d'écriture du contenu (`rtl` en arabe). */
  dir?: 'ltr' | 'rtl';
  /** Synchronise l'ouverture avec l'historique (bouton retour). Défaut `true`. */
  syncHistory?: boolean;
  /** Démontage effectif du contenu (fin de l'animation de sortie). */
  onExitComplete?: () => void;
  /**
   * Focus initial. Défaut : le panneau lui-même (le lecteur d'écran annonce
   * le titre ; aucun clavier virtuel n'est ouvert d'office sur mobile).
   */
  onOpenAutoFocus?: (event: Event) => void;
  /** Classes du conteneur qui défile (padding du contenu). */
  bodyClassName?: string;
  'data-testid'?: string;
}

/** Signale le démontage du contenu (Radix le garde monté pendant la sortie). */
function ExitSignal({ onExit }: { onExit?: () => void }) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  useEffect(() => () => onExitRef.current?.(), []);
  return null;
}

/** Ouverture ↔ historique du navigateur (bouton retour = fermeture). */
function useHistorySync(open: boolean, enabled: boolean, onOpenChange: (open: boolean) => void) {
  /** Jeton de l'entrée poussée pour l'ouverture en cours (`null` : aucune). */
  const tokenRef = useRef<string | null>(null);
  /** Entrées que notre `back()` est en train de retirer (popstate attendu). */
  const leavingTokensRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (open && !tokenRef.current) {
      const state: unknown = window.history.state;
      const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
      const token = nextHistoryToken();
      // Même URL (hash compris) : l'entrée ne sert qu'à capter « retour ».
      window.history.pushState({ ...base, [BOTTOM_SHEET_HISTORY_FLAG]: token }, '');
      tokenRef.current = token;
    } else if (!open && tokenRef.current) {
      leavingTokensRef.current.add(tokenRef.current);
      tokenRef.current = null;
      window.history.back();
    }
  }, [open, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const onPopState = (event: PopStateEvent) => {
      const landed = historyTokenOf(event.state);
      // Notre `back()` est arrivé (quelle que soit l'entrée d'arrivée) :
      // plus rien n'est en cours de retrait.
      const echoOfOurBack = landed !== null && leavingTokensRef.current.has(landed);
      leavingTokensRef.current.clear();
      if (!tokenRef.current) return;
      // Fermeture puis réouverture dans la même tâche : l'entrée d'arrivée
      // porte encore notre marqueur (celle que nous quittions, ou celle de la
      // nouvelle ouverture) — ce n'est pas l'utilisateur qui recule.
      if (echoOfOurBack || landed === tokenRef.current) return;
      // L'entrée a déjà été retirée par le navigateur : pas de `back()`.
      tokenRef.current = null;
      onOpenChangeRef.current(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);

  // Démontage panneau ouvert : on retire l'entrée poussée, SEULEMENT si elle
  // est encore la courante (une navigation a pu en pousser une autre entre-
  // temps : reculer annulerait alors cette navigation). Différé d'une tâche
  // pour ignorer le démontage/remontage immédiat du StrictMode.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.setTimeout(() => {
        const token = tokenRef.current;
        if (mountedRef.current || !token) return;
        tokenRef.current = null;
        if (historyTokenOf(window.history.state) === token) window.history.back();
      }, 0);
    };
  }, []);
}

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  {
    open,
    onOpenChange,
    title,
    description,
    closeLabel,
    children,
    dir,
    syncHistory = true,
    onExitComplete,
    onOpenAutoFocus,
    bodyClassName,
    'data-testid': testId = 'bottom-sheet',
  },
  bodyRef,
) {
  useHistorySync(open, syncHistory, onOpenChange);
  const keyboardInset = useVisualViewportKeyboardInset(open);
  const contentRef = useRef<HTMLDivElement>(null);
  // Élément actif à l'ouverture (le bouton « Commander ») : Radix ne rend le
  // focus qu'à un `Dialog.Trigger`, or nos déclencheurs sont ailleurs.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <>
      {/* Hors du portail : Radix enveloppe chaque enfant du portail dans sa
          propre `Presence` — la feuille de style disparaîtrait dès la
          fermeture et l'animation de sortie ne jouerait jamais. */}
      <style>{SHEET_STYLES}</style>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            data-fg-sheet-overlay=""
            data-testid={`${testId}-overlay`}
            className="fixed inset-0 bg-[rgba(44,42,40,0.45)]"
            style={{ zIndex: 'var(--z-modal)' }}
          />
          <Dialog.Content
            ref={contentRef}
            dir={dir}
            data-fg-sheet=""
            data-testid={testId}
            // Pas de description → on retire l'attribut (sinon Radix avertit).
            {...(description ? {} : { 'aria-describedby': undefined })}
            aria-modal="true"
            onOpenAutoFocus={(event) => {
              const active = document.activeElement;
              returnFocusRef.current =
                active instanceof HTMLElement && active !== document.body ? active : null;
              if (onOpenAutoFocus) {
                onOpenAutoFocus(event);
                return;
              }
              event.preventDefault();
              contentRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = returnFocusRef.current;
              returnFocusRef.current = null;
              if (target?.isConnected) target.focus({ preventScroll: true });
            }}
            onEscapeKeyDown={(event) => {
              // Liste de suggestions ouverte (combobox des villes…) : Échap la
              // ferme, elle seule ; le champ reçoit toujours la touche.
              if (isEscapeForOpenPopup(event.target, contentRef.current)) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              // Un clic sur un toast (au-dessus du panneau) ne ferme pas le panneau.
              const target = event.target;
              if (target instanceof Element && target.closest('[data-toast-region]')) {
                event.preventDefault();
              }
            }}
            style={{
              zIndex: 'var(--z-modal)',
              paddingBottom: `max(env(safe-area-inset-bottom), ${keyboardInset}px)`,
            }}
            className={cn(
              'fixed flex flex-col overflow-hidden bg-creme text-encre shadow-2xl outline-none',
              // Mobile : panneau ancré en bas, marge haute (le contexte reste visible).
              'inset-x-0 bottom-0 h-[calc(100dvh-max(1.5rem,env(safe-area-inset-top)))] rounded-t-2xl',
              // Desktop : panneau centré.
              'md:inset-0 md:m-auto md:h-fit md:max-h-[min(90dvh,60rem)] md:w-[calc(100%-3rem)] md:max-w-2xl md:rounded-2xl',
            )}
          >
            <ExitSignal onExit={onExitComplete} />
            {/* Poignée visuelle (idiome « sheet » iOS) — décorative. */}
            <div aria-hidden="true" className="flex justify-center pt-2 md:hidden">
              <span className="h-1 w-10 rounded-full bg-[rgba(44,42,40,0.18)]" />
            </div>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(44,42,40,0.08)] px-5 pb-3 pt-2 md:px-8 md:pt-5">
              <Dialog.Title className="min-w-0 truncate font-display text-xl italic leading-tight rtl:font-body rtl:text-lg rtl:not-italic">
                {title}
              </Dialog.Title>
              <Dialog.Close
                aria-label={closeLabel}
                data-testid={`${testId}-close`}
                className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-encre transition-colors duration-fast hover:bg-[rgba(44,42,40,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </Dialog.Close>
            </header>
            {description ? (
              <Dialog.Description className="sr-only">{description}</Dialog.Description>
            ) : null}
            <div
              ref={bodyRef}
              data-testid={`${testId}-body`}
              data-bottom-sheet-body=""
              className={cn(
                'relative min-h-0 flex-1 overflow-y-auto overscroll-contain',
                bodyClassName,
              )}
            >
              {children}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
});
