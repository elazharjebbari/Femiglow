/**
 * Server Component qui décide si le widget chat doit être monté.
 *
 * - Si la feature flag est désactivée → render `null` (zéro JS côté
 *   client, donc aucun impact LCP/CLS).
 * - Sinon → import dynamique du widget.
 *
 * À placer dans `app/layout.tsx` près de la fin du `<body>`.
 */
import { isChatEnabled } from '@/lib/chat/feature-flag';

import { ChatWidget } from './ChatWidget';

interface ChatWidgetMountProps {
  page?: string;
}

export function ChatWidgetMount({ page }: ChatWidgetMountProps) {
  if (!isChatEnabled()) return null;
  return <ChatWidget page={page} />;
}
