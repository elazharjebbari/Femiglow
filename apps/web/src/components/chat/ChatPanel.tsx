/**
 * CHA-055 / CHA-056 / CHA-244 — `ChatPanel` desktop + mobile.
 *
 * Desktop (≥ sm) : ancré bas-droite, 380×560, bubble.
 * Mobile (< sm)  : sheet full-screen (`inset-0 h-[100dvh]`) — empêche
 *                  le clavier iOS de couvrir le composer et corrige le
 *                  bug d'auto-zoom + perte de visibilité 2026-05-12.
 *
 * CHA-244 — Le panel passe au-dessus du Header et du StickyCartCTA via
 * `--z-chat-overlay: 250`. On verrouille aussi le scroll de la page
 * sous-jacente et on restaure la position au close (cf.
 * docs/admin-config/43-chat-mobile-ux-fix-runbook.md §D).
 *
 * cf. docs/chat-assistant/05-ui-ux-design.md §3.2
 * cf. docs/chat-assistant/21-mobile-ux-plan.md §2 (refactor mobile UX)
 */
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { useChatStore } from './chat-store';
import { MessageList } from './MessageList';
import { useChatSession } from './hooks/use-chat-session';

interface ChatPanelProps {
  page?: string;
}

export function ChatPanel({ page }: ChatPanelProps) {
  const isOpen = useChatStore((s) => s.isOpen);
  const language = useChatStore((s) => s.language);
  const setLanguage = useChatStore((s) => s.setLanguage);
  const close = useChatStore((s) => s.close);
  const panelRef = useRef<HTMLDivElement>(null);
  // CHA-244 — Position scroll de la page sous-jacente, sauvegardée à
  // l'ouverture pour restauration au close (le `overflow: hidden` qu'on
  // pose sur <body> remet le scroll à 0 sur certains navigateurs).
  const savedScrollYRef = useRef<number>(0);

  // Phase 9bis — locale de la page dérivée du 1er segment d'URL. Pilote :
  //  1. la langue de la session chat (pills + greeting + réponses scriptées),
  //  2. la langue du store (rendu RTL + libellés du panel en arabe).
  // Le chat ne gère que fr / ar (ar-MA réservé darija) ; les pages /en
  // retombent sur fr côté chat (pas d'instruction LLM dédiée EN à ce stade).
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const chatLanguage: 'fr' | 'ar' = firstSegment === 'ar' ? 'ar' : 'fr';

  // Phase 9bis — page « dé-localisée » pour le matching des pills (questions
  // prédéfinies). Les canned-pairs ciblent des chemins non préfixés (`/kit`),
  // alors que la page réelle est `/ar/kit` : sans normalisation, `pageMatches`
  // échoue et aucune pill n'apparaît sur /ar. On retire le segment locale.
  const isLocaleSeg =
    firstSegment === 'fr' || firstSegment === 'ar' || firstSegment === 'en';
  const delocalizedPage =
    '/' + (isLocaleSeg ? segments.slice(1) : segments).join('/');

  // Aligne le store dès que la locale change (bascule FR↔AR sans reload).
  useEffect(() => {
    if (language !== chatLanguage) setLanguage(chatLanguage);
  }, [chatLanguage, language, setLanguage]);

  useChatSession(page ?? delocalizedPage, chatLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__chatStore = useChatStore;
    }
  }, []);

  // Esc closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // CHA-244 — Body scroll lock + restauration de la position.
  // À l'ouverture : sauvegarde `scrollY`, pose `overflow: hidden` sur
  // <body>. À la fermeture : retire le lock, restaure `scrollY`.
  // Cleanup au démontage pour ne JAMAIS laisser le body verrouillé si
  // le composant est unmounted pendant `isOpen=true`.
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    savedScrollYRef.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      // `requestAnimationFrame` : on attend que le navigateur ait
      // reflowé sans le lock avant de remettre la position, sinon
      // Safari iOS sauterait au top et ignorerait notre scrollTo.
      window.requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollYRef.current);
      });
    };
  }, [isOpen]);

  /*
    CHA-mobile-focus — Neutralisation radicale du focus iOS dans le chat.

    iOS Safari (et WebViews dérivées) déclenche au focus d'un input deux
    effets parasites qui dégradent l'UX du chat :
      1. **Scroll-into-view automatique** : la page parente et/ou le
         panel sont scrollés pour rendre l'input visible — la
         conversation remonte et disparaît.
      2. **Push du composer hors-écran** : le clavier virtuel s'ouvre
         mais ne resize PAS le `window.innerHeight` (visual ≠ layout
         viewport). Le composer `position: fixed` se retrouve masqué
         par le clavier, bouton d'envoi inclus.

    Mécanique du fix :
      - Sur `focusin` à l'intérieur du panel, on capture `panel.scrollTop`
        et `window.scrollY` AVANT que iOS ait scrollé, puis on les
        restaure après deux rAF (timing du scroll natif iOS).
      - On écoute `visualViewport.resize/scroll` pour exposer le
        décalage clavier en CSS var `--chat-keyboard-inset`. Le panel
        applique `padding-bottom: var(--chat-keyboard-inset)` → le
        composer remonte au-dessus du clavier.

    Scopé au chat : seuls les inputs avec un ancêtre `[data-chat-scope]`
    déclenchent cette logique, le wizard et les autres écrans ne sont
    pas affectés.
  */
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const panel = panelRef.current;
    if (!panel) return;

    const FOCUSABLE = 'input,textarea,select,[contenteditable="true"]';

    function isChatField(target: EventTarget | null): target is HTMLElement {
      return target instanceof HTMLElement && target.matches(FOCUSABLE);
    }

    function onFocusIn(e: FocusEvent) {
      if (!isChatField(e.target)) return;
      const startY = window.scrollY;
      const list = panel!.querySelector<HTMLElement>('[data-chat-scroll]');
      const startScroll = list?.scrollTop ?? 0;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (window.scrollY !== startY) window.scrollTo(0, startY);
          if (list && list.scrollTop !== startScroll) list.scrollTop = startScroll;
        });
      });
    }

    panel.addEventListener('focusin', onFocusIn);

    const vv = window.visualViewport;
    let rafId = 0;
    function syncKeyboardInset() {
      if (!vv) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      panel!.style.setProperty('--chat-keyboard-inset', `${inset}px`);
    }
    function onViewportChange() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncKeyboardInset);
    }
    if (vv) {
      syncKeyboardInset();
      vv.addEventListener('resize', onViewportChange);
      vv.addEventListener('scroll', onViewportChange);
    }

    return () => {
      panel.removeEventListener('focusin', onFocusIn);
      if (vv) {
        vv.removeEventListener('resize', onViewportChange);
        vv.removeEventListener('scroll', onViewportChange);
      }
      cancelAnimationFrame(rafId);
      panel.style.removeProperty('--chat-keyboard-inset');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isRtl = language === 'ar';
  // Position desktop uniquement : en mobile, `inset-0` couvre tout l'écran
  // et neutralise `end-5` / `start-5`. On garde les variantes `sm:` pour
  // que le bubble desktop se positionne correctement.
  // `sm:end-7` est une logical property (= bottom-7 côté end, donc droite
  // en LTR et gauche en RTL).
  const positionClass = 'sm:end-7';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assistant FemiGlow"
      aria-modal="false"
      data-testid="chat-panel"
      // CHA-244 — `data-chat-scope` permet aux styles scopés
      // (polices agrandies) de cibler UNIQUEMENT l'intérieur du chat
      // sans polluer le reste du site. cf. runbook §E.
      data-chat-scope=""
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        zIndex: 'var(--z-chat-overlay)',
        // CHA-mobile-focus — Padding bas dynamique : `--chat-keyboard-inset`
        // est posé par le useEffect visualViewport ci-dessus quand le
        // clavier mobile s'ouvre. Tant qu'il est absent, on retombe sur
        // `env(safe-area-inset-bottom)` (notch). Le composer reste donc
        // toujours visible au-dessus du clavier.
        paddingBottom: 'max(env(safe-area-inset-bottom), var(--chat-keyboard-inset, 0px))',
      }}
      className={[
        // ─── Mobile (base) : sheet full-screen ────────────────────────
        'fixed inset-0 h-[100dvh] w-full',
        'flex flex-col overflow-hidden border-0 bg-white shadow-2xl shadow-stone-900/10',
        'overscroll-contain',
        // ─── Desktop (≥ sm) : bubble bas-droite 380×560 ───────────────
        'sm:inset-auto sm:bottom-28 sm:h-auto sm:w-[380px]',
        'sm:max-h-[min(560px,calc(100vh-9rem))]',
        'sm:rounded-2xl sm:border sm:border-stone-200',
        'sm:pb-0',
        // ─── Anim commune ─────────────────────────────────────────────
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200',
        positionClass,
      ].join(' ')}
    >
      {/*
        Drag-handle visuel (mobile-only). Indique l'idiome « sheet »
        attendu par les utilisateurs iOS. Pas de drag-to-close JS pour
        la v1 — la croix du header reste le moyen de fermer.
      */}
      <div
        aria-hidden="true"
        data-testid="chat-panel-drag-handle"
        className="sm:hidden mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300"
      />
      <ChatHeader />
      <MessageList />
      <ChatComposer />
    </div>
  );
}
