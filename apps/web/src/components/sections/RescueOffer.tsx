/**
 * `RescueOffer` — offre de SAUVETAGE (Phase 2), client-only.
 *
 * Déclencheur DISCRET (pas de pop-up agressif) : intention de sortie
 * (mouseleave vers le haut, desktop) OU scroll profond (≥ 65 %). Au signal,
 * on demande au serveur (autoritaire) si l'offre doit s'afficher — le serveur
 * décide le bucket (holdout 20 %) et journalise l'exposition. L'avantage est
 * NON MONÉTAIRE (cadeau) : aucun impact prix, aucun risque de mismatch caisse.
 *
 * Une seule sollicitation par session (sessionStorage). Charte : note crème,
 * filet sauge, encre — pas de rouge, pas de countdown, pas d'emoji.
 * cf. docs/coupons-qa-2026-06-02 + Phase 2.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'fg_rescue_seen';
const SCROLL_THRESHOLD = 0.65;

export interface RescueOfferProps {
  isArabic?: boolean;
}

const COPY = {
  fr: {
    title: 'Avant de partir — un petit geste de la maison.',
    body: 'Un cadeau d’accompagnement est ajouté à votre première commande aujourd’hui.',
    dismiss: 'Fermer',
  },
  ar: {
    // D-5 : copie arabe indicative, à valider par la rédaction maison.
    title: 'قبل أن تغادري — لفتة صغيرة من الدار.',
    body: 'هدية مرافقة تُضاف إلى طلبك الأول اليوم.',
    dismiss: 'إغلاق',
  },
} as const;

export function RescueOffer({ isArabic = false }: RescueOfferProps): JSX.Element | null {
  const [show, setShow] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(SESSION_KEY)) return;

    let cancelled = false;

    async function trigger() {
      if (requested.current) return;
      requested.current = true;
      window.sessionStorage.setItem(SESSION_KEY, '1');
      cleanup();
      try {
        const res = await fetch('/api/coupons/rescue', {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { show?: boolean };
        if (!cancelled && json.show) setShow(true);
      } catch {
        /* silencieux */
      }
    }

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const ratio = scrolled / document.documentElement.scrollHeight;
      if (ratio >= SCROLL_THRESHOLD) void trigger();
    }
    function onMouseOut(e: MouseEvent) {
      if (e.clientY <= 0) void trigger();
    }
    function cleanup() {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onMouseOut);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onMouseOut);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  if (!show) return null;
  const t = isArabic ? COPY.ar : COPY.fr;

  return (
    <aside
      data-testid="rescue-offer"
      dir={isArabic ? 'rtl' : undefined}
      role="status"
      aria-live="polite"
      className="mx-auto mt-6 max-w-md rounded-md border border-sauge/40 bg-creme/70 px-4 py-3 text-center"
    >
      <p className="text-sm font-medium text-encre">{t.title}</p>
      <p className="mt-1 text-sm text-encre/80">{t.body}</p>
      <button
        type="button"
        data-testid="rescue-offer-dismiss"
        onClick={() => setShow(false)}
        className="mt-2 text-xs text-encre/55 underline decoration-encre/25 underline-offset-2"
      >
        {t.dismiss}
      </button>
    </aside>
  );
}
