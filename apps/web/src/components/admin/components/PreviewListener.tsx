/**
 * PreviewListener — installé dans la route iframe de preview.
 *
 * Côté iframe :
 *   - À l'hydratation, postMessage `PREVIEW_READY` au parent.
 *   - Sur réception de `FIELDS_CHANGED` → `router.refresh()` debounced
 *     (l'iframe est non-cachée, le RSC relit les drafts frais).
 *   - Sur réception de `SCROLL_TO_FIELD` → scrollIntoView du noeud
 *     `[data-field-key]` correspondant.
 *
 * Cf. docs/components-cms/frontend/04-live-preview.md (F4).
 */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { parsePreviewMessage, type PreviewMessage } from './preview-protocol';

/**
 * Délai mini entre deux `router.refresh()`. Évite de saturer le serveur
 * RSC quand l'admin tape vite.
 */
const REFRESH_DEBOUNCE_MS = 150;

interface Props {
  componentKey: string;
}

export function PreviewListener({ componentKey }: Props): JSX.Element | null {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Annonce le ready au parent dès l'hydratation.
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const msg: PreviewMessage = { type: 'PREVIEW_READY', componentKey };
      window.parent.postMessage(msg, window.location.origin);
    }

    function onMessage(e: MessageEvent): void {
      if (e.origin !== window.location.origin) return;
      const msg = parsePreviewMessage(e.data);
      if (!msg) return;
      if (msg.componentKey !== componentKey) return;

      if (msg.type === 'FIELDS_CHANGED') {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          router.refresh();
        }, REFRESH_DEBOUNCE_MS);
        return;
      }

      if (msg.type === 'SCROLL_TO_FIELD') {
        const el = document.querySelector(
          `[data-field-key="${CSS.escape(msg.fieldKey)}"]`,
        );
        if (el && 'scrollIntoView' in el) {
          (el as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
        return;
      }
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [componentKey, router]);

  return null;
}
