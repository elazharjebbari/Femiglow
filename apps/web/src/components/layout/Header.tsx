'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { useChatStore } from '@/components/chat/chat-store';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { SommaireOverlay } from './SommaireOverlay';
import { cn } from '@/lib/utils/cn';
import { useHeaderStrings } from './use-header-strings';

const HINT_DELAY_MS = 8000;
const HINT_STORAGE_KEY = 'femiglow.menu.hinted';

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // La bande indice « ↑ Voir le pack » transparaîtrait sous le fond
  // semi-opaque du menu de langue : on la masque tant que ce menu est ouvert.
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  // CHA-244 — quand le chat est ouvert, le header sticky se replie
  // vers le haut pour libérer la zone d'en-tête du panel chat.
  // cf. docs/admin-config/43-chat-mobile-ux-fix-runbook.md §B.
  const chatOpen = useChatStore((s) => s.isOpen);
  const triggerId = useId();
  const overlayId = `${triggerId}-overlay`;
  // Phase 7C — strings localisés en mode dual : sous provider next-intl
  // (routes `[locale]/*`), on lit `messages/<locale>.json:navigation.*`.
  // Hors provider (routes legacy `(marketing)/*`), fallback FR hardcodé.
  const strings = useHeaderStrings();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (sessionStorage.getItem(HINT_STORAGE_KEY) === '1') return;
    const timer = window.setTimeout(() => {
      if (!sessionStorage.getItem(HINT_STORAGE_KEY)) {
        setShowHint(true);
      }
    }, HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function dismissHint() {
    setShowHint(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(HINT_STORAGE_KEY, '1');
    }
  }

  function handleOpen() {
    setOpen(true);
    dismissHint();
  }

  return (
    <>
      <header
        role="banner"
        data-chat-open={chatOpen ? 'true' : 'false'}
        className={cn(
          'sticky top-0 z-[var(--z-sticky)] transition-[background-color,backdrop-filter,height,border-color,transform,opacity] duration-[280ms] ease-out',
          // CHA-244 — chat ouvert : slide-up + fade-out, pointer-events
          // off pour laisser passer les clics sur le panel chat.
          // `motion-reduce` : on garde le fade mais pas le translate.
          'data-[chat-open=true]:-translate-y-full data-[chat-open=true]:opacity-0 data-[chat-open=true]:pointer-events-none',
          'motion-reduce:data-[chat-open=true]:translate-y-0',
          scrolled
            ? 'border-b border-encre/8 bg-creme/85 backdrop-blur-sm'
            : 'border-b border-transparent bg-transparent',
        )}
        aria-hidden={chatOpen}
      >
        <Container width="page">
          <div
            className={cn(
              'flex items-center justify-between gap-4 transition-[height] duration-[280ms] ease-out',
              scrolled ? 'h-16' : 'h-14 md:h-[72px]',
            )}
          >
            <Link
              href="/"
              aria-label={strings.logoAria}
              className="font-script leading-none text-encre transition-opacity hover:opacity-70"
            >
              <span className="text-[22px] md:text-[26px]">FemiGlow</span>
            </Link>

            <div className="flex items-center gap-2 md:gap-4">
              {/*
                Phase 5 — Switcher de locale public éditorial. Visible sur
                toutes tailles : le dropdown reste compact (endonyme seul) et
                fonctionne en tap sur mobile. Une variante `inline` redondante
                subsiste dans le SommaireOverlay (visible quand le drawer est
                ouvert, qui recouvre le header). cf. PHASE-4-FINAL.md.
              */}
              <LocaleSwitcher
                variant="dropdown"
                className="inline-flex"
                onOpenChange={setLocaleMenuOpen}
              />
              <div className="relative">
                <button
                  id={triggerId}
                  type="button"
                  onClick={handleOpen}
                  aria-expanded={open}
                  aria-controls={overlayId}
                  aria-haspopup="dialog"
                  className="inline-flex h-11 items-center px-2 font-body text-[11px] uppercase tracking-[0.2em] text-encre underline decoration-encre/40 underline-offset-[6px] transition-colors hover:decoration-encre md:px-1 md:text-xs md:underline-offset-4"
                >
                  {strings.menuLabel}
                </button>
                {showHint && !localeMenuOpen && (
                  <span
                    aria-hidden="true"
                    onClick={dismissHint}
                    className="pointer-events-auto absolute end-0 top-full mt-2 inline-flex items-center gap-2 whitespace-nowrap bg-encre px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-creme shadow-md motion-safe:animate-[hint-pulse_1.6s_ease-out_2]"
                  >
                    <span aria-hidden="true">↑</span>
                    {strings.menuHintArrow}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Container>
      </header>

      <div id={overlayId}>
        <SommaireOverlay open={open} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
