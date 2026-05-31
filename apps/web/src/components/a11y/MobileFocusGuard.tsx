'use client';

/**
 * MobileFocusGuard — empêche le zoom-on-focus iOS et le rétrécissement de
 * viewport Android quand l'utilisateur tape dans un input/textarea/select.
 *
 * Mécanisme :
 *  - À l'ouverture d'un champ texte (focus), on **ajoute** dynamiquement
 *    `maximum-scale=1` sur la balise `<meta name="viewport">`. Cela empêche
 *    iOS Safari d'auto-zoomer sur les champs (même si le font-size > 16 px).
 *  - Au blur, on **retire** `maximum-scale=1` → l'utilisateur peut à
 *    nouveau pincer pour zoomer manuellement (WCAG SC 1.4.4 préservé hors
 *    contexte saisie).
 *
 * Composant global monté une fois dans le RootLayout. Pas de UI, juste un
 * listener `focusin` / `focusout` sur `document`.
 *
 * Cf. https://stackoverflow.com/q/2989263 + iOS HIG.
 */
import { useEffect } from 'react';

const VIEWPORT_BASE =
  'width=device-width, initial-scale=1';
const VIEWPORT_LOCKED =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

const FOCUSABLE_INPUT_SELECTOR =
  'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]),textarea,select,[contenteditable="true"]';

function getViewportMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
}

function setViewport(content: string): void {
  let meta = getViewportMeta();
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function MobileFocusGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // On capture la valeur initiale (peut différer si l'app la définit autrement).
    const meta = getViewportMeta();
    const initialContent = meta?.getAttribute('content') ?? VIEWPORT_BASE;

    let isLocked = false;

    function onFocusIn(e: FocusEvent) {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.matches(FOCUSABLE_INPUT_SELECTOR)) return;
      if (isLocked) return;
      setViewport(VIEWPORT_LOCKED);
      isLocked = true;
    }

    function onFocusOut(e: FocusEvent) {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (!target.matches(FOCUSABLE_INPUT_SELECTOR)) return;
      // Petit délai pour éviter le yo-yo lorsqu'on saute d'un champ à l'autre.
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active && active instanceof Element && active.matches(FOCUSABLE_INPUT_SELECTOR)) {
          return; // toujours dans un champ → on garde le lock
        }
        setViewport(initialContent);
        isLocked = false;
      }, 50);
    }

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      // Cleanup : remet la viewport d'origine si on est unmount alors qu'un
      // input était focus.
      if (isLocked) setViewport(initialContent);
    };
  }, []);

  return null;
}
