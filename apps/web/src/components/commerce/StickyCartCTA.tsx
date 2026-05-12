'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PriceDisplay } from '@/components/commerce/PriceDisplay';
import { useChatStore } from '@/components/chat/chat-store';
import type { Currency } from '@/lib/products/currency';

interface StickyCartCTAProps {
  productName: string;
  priceCents: number;
  /**
   * Prix promotionnel optionnel — si fourni et `< priceCents`, la sticky
   * affiche le couple actif/barré via <PriceDisplay layout="inline" size="md">
   * pour rester compact sur mobile.
   */
  promoPriceCents?: number | null;
  currency: Currency;
  observeId: string;
  children: ReactNode;
}

export function StickyCartCTA({
  productName,
  priceCents,
  promoPriceCents = null,
  currency,
  observeId,
  children,
}: StickyCartCTAProps) {
  const [visible, setVisible] = useState(false);
  // CHA-244 — Le sticky CTA se cache (slide-down + fade) quand le chat
  // est ouvert pour libérer la zone composer/clavier du panel chat.
  // cf. docs/admin-config/43-chat-mobile-ux-fix-runbook.md §B.
  const chatOpen = useChatStore((s) => s.isOpen);

  useEffect(() => {
    const sentinel = document.getElementById(observeId);
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [observeId]);

  // Quand le chat est ouvert, on force `data-visible=false` pour
  // déclencher l'animation `translate-y-full` même si la CTA était
  // visible. À la fermeture du chat, l'IntersectionObserver remettra
  // `visible` à sa vraie valeur.
  const dataVisible = chatOpen ? false : visible;

  return (
    <div
      role="region"
      aria-label="Achat rapide"
      data-visible={dataVisible}
      data-chat-open={chatOpen ? 'true' : 'false'}
      aria-hidden={chatOpen}
      style={{ zIndex: 'var(--z-sticky)' }}
      className="fixed inset-x-0 bottom-0 border-t border-encre/10 bg-creme/95 px-4 py-3 backdrop-blur transition-[transform,opacity] duration-base ease-out-soft data-[visible=false]:translate-y-full data-[chat-open=true]:opacity-0 data-[chat-open=true]:pointer-events-none motion-reduce:transition-none motion-reduce:data-[visible=false]:opacity-0 motion-reduce:data-[visible=false]:translate-y-0 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[340px] lg:rounded-md lg:border"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-encre/70">
            {productName}
          </p>
          {/*
            Sticky compacte → on désactive le label « Économisez » (Kolenda
            #11 : la zone payment doit rester serrée pour rester lisible
            sur mobile). Le contraste actif vs barré reste visible.
          */}
          <PriceDisplay
            priceCents={priceCents}
            promoPriceCents={promoPriceCents}
            currency={currency}
            size="md"
            layout="inline"
            showSavings={false}
          />
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}
