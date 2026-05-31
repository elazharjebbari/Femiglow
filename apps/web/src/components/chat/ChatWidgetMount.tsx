/**
 * Server Component qui décide si le widget chat doit être monté.
 *
 * - Si la feature flag est désactivée → render `null` (zéro JS côté
 *   client, donc aucun impact LCP/CLS).
 * - Sinon → branche le wrapper `ChatWidgetDeferred` qui ne montera la
 *   vraie UI qu'après le `window.load`, un idle slot, un délai filet de
 *   sécurité (2.5s) ou la première interaction utilisateur (scroll,
 *   touch, mousemove, keydown). Cela retire ~25-35 KB du chemin critique.
 *
 * À placer dans `app/layout.tsx` près de la fin du `<body>`.
 */
import { isChatEnabled } from '@/lib/chat/feature-flag';

import { ChatWidgetDeferred } from './ChatWidgetDeferred';

interface ChatWidgetMountProps {
  page?: string;
  /**
   * Override du délai (ms) avant mount automatique. Sinon, prend la valeur
   * de `NEXT_PUBLIC_CHAT_DEFER_MS` (sided au build) ou 2500 ms par défaut.
   */
  delayMs?: number;
}

function readDefaultDelayMs(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_DEFER_MS;
  if (!raw) return 2500;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 2500;
  return parsed;
}

export function ChatWidgetMount({ page, delayMs }: ChatWidgetMountProps) {
  if (!isChatEnabled()) return null;
  return <ChatWidgetDeferred page={page} delayMs={delayMs ?? readDefaultDelayMs()} />;
}
