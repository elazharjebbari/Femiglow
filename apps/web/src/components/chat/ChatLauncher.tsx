/**
 * CHA-054 — `ChatLauncher`.
 *
 * Bouton flottant discret mais visible, persistant en bas-droite
 * (RTL : bas-gauche). Toggle l'ouverture du panel. A11y : focus
 * visible, raccourci Esc à la fermeture (géré par ChatPanel).
 *
 * cf. docs/chat-assistant/05-ui-ux-design.md §3.1
 */
'use client';

import { usePathname } from 'next/navigation';
import { useChatStore } from './chat-store';
import { useTracking } from '@/lib/tracking/use-tracking';

interface ChatLauncherProps {
  unreadCount?: number;
}

export function ChatLauncher({ unreadCount = 0 }: ChatLauncherProps) {
  const isOpen = useChatStore((s) => s.isOpen);
  const language = useChatStore((s) => s.language);
  const toggle = useChatStore((s) => s.toggle);
  const sessionId = useChatStore((s) => s.sessionId);
  const messagesCount = useChatStore((s) => s.messages.length);
  const pathname = usePathname();
  const { emit } = useTracking();

  // CHA-rtl : on utilise les classes logiques (`end-*`) pour que le
  // launcher se positionne côté « end » (right en LTR, left en RTL)
  // automatiquement.
  // Sur `/kit`, la `StickyCartCTA` occupe la bande basse en mobile (bar
  // pleine largeur ~80px) et le coin bas-end en desktop (boîte 340px).
  // On remonte le launcher (mobile) et on le décale du côté `start` de la
  // boîte sticky (desktop) pour ne pas recouvrir le bouton « Commander ».
  const hasStickyCta = pathname === '/kit';
  const verticalClass = hasStickyCta
    ? 'bottom-24 sm:bottom-7'
    : 'bottom-5 sm:bottom-7';
  // Mobile : on reste à `end-5` (le décalage vertical suffit) ; sm+ :
  // 372px = 24px (end-6 du sticky) + 340px (largeur sticky) + 8px de marge.
  const positionClass = hasStickyCta
    ? 'end-5 sm:end-[372px]'
    : 'end-5 sm:end-7';

  const handleToggle = (): void => {
    if (isOpen) {
      emit('chat_widget_close', {
        session_id: sessionId,
        messages_count: messagesCount,
      });
    } else {
      emit('chat_widget_open', {
        session_id: sessionId,
        page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        language,
        trigger: 'user',
      });
    }
    toggle();
  };

  // CHA-mobile-ux : en mobile, quand le panel est ouvert il prend tout
  // l'écran (`inset-0`) ; le FAB serait recouvert et son rôle « ouvrir »
  // devient redondant (la croix du header sert à fermer). On le masque
  // donc en mobile uniquement. En desktop, le FAB et la bubble cohabitent.
  const displayClass = isOpen ? 'hidden sm:flex' : 'flex';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat'}
      aria-expanded={isOpen}
      data-testid="chat-launcher"
      // CHA-244 — Le launcher partage le même token que le panel
      // (`--z-chat-overlay: 250`) pour passer au-dessus du Header /
      // StickyCartCTA quand il est visible (mobile : caché si
      // isOpen ; desktop : visible aux côtés de la bubble).
      style={{ zIndex: 'var(--z-chat-overlay)' }}
      className={[
        'fixed h-14 w-14 items-center justify-center rounded-full',
        displayClass,
        'bg-stone-900 text-white shadow-lg shadow-stone-900/15 transition-all',
        'hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        verticalClass,
        positionClass,
      ].join(' ')}
    >
      <ChatIcon isOpen={isOpen} />
      {unreadCount > 0 && (
        <span
          aria-label={`${unreadCount} nouveau messages`}
          className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

function ChatIcon({ isOpen }: { isOpen: boolean }) {
  return isOpen ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-12.9 6.3L3 19l.7-5.1A8 8 0 1 1 21 12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
