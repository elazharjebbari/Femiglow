/**
 * `ChatWidget` — point d'entrée client du widget.
 *
 * Mounte launcher + panel. Si la feature flag est désactivée côté
 * serveur, ce composant n'est jamais rendu (cf. `ChatWidgetMount`
 * server component).
 */
'use client';

import { ChatLauncher } from './ChatLauncher';
import { ChatPanel } from './ChatPanel';

interface ChatWidgetProps {
  page?: string;
}

export function ChatWidget({ page }: ChatWidgetProps) {
  return (
    <>
      <ChatLauncher />
      <ChatPanel page={page} />
    </>
  );
}
