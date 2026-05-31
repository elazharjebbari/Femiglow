/**
 * CHA-058 — `MessageList`.
 *
 * Affiche les messages dans l'ordre chronologique avec auto-scroll
 * en fin lorsque de nouveaux messages arrivent ou pendant un stream.
 */
'use client';

import { Fragment, useEffect, useRef } from 'react';

import { useChatStore } from './chat-store';
import { useCannedPair } from './hooks/use-canned-pair';
import { LeadFormBubble } from './LeadFormBubble';
import { MessageBubble } from './MessageBubble';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const greeting = useChatStore((s) => s.greeting);
  const suggestions = useChatStore((s) => s.suggestions);
  const language = useChatStore((s) => s.language);
  // Phase 9bis — libellés a11y localisés (fuite FR en lecteur d'écran sur /ar).
  const isAr = language === 'ar' || language === 'ar-MA';
  const conversationLabel = isAr ? 'المحادثة' : 'Conversation';
  const quickSuggestionsLabel = isAr ? 'اقتراحات سريعة' : 'Suggestions rapides';
  const error = useChatStore((s) => s.error);
  const leadOfferStatus = useChatStore((s) => s.leadOffer.status);
  const leadOfferMessageId = useChatStore((s) => s.leadOffer.triggeringMessageId);
  const { triggerPill } = useCannedPair();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, leadOfferStatus]);

  // Détermine APRÈS quel message afficher la bulle. Par défaut, on
  // l'insère après le message déclencheur. Si l'id n'est pas trouvé
  // (ex. message déjà sorti de la fenêtre), on l'affiche en queue.
  const triggerIdx = leadOfferMessageId
    ? messages.findIndex((m) => m.id === leadOfferMessageId)
    : -1;
  const showLeadFormInline =
    leadOfferStatus !== 'idle' && (triggerIdx >= 0 || leadOfferStatus === 'success');

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label={conversationLabel}
      data-testid="chat-message-list"
      // CHA-mobile-focus — Marqueur consommé par le useEffect anti-scroll
      // iOS du ChatPanel : c'est CETTE liste dont on doit restaurer le
      // scrollTop si iOS l'a perturbé au focus d'un input.
      data-chat-scroll=""
      // CHA-mobile-ux : `overscroll-contain` empêche le scroll de la
      // liste de bleed-through sur la page sous-jacente en mobile
      // (le sheet `inset-0` couvre toute la viewport, mais sans cette
      // règle, atteindre le top/bottom déclenche un scroll de la page
      // de fond — UX confuse). cf. docs/chat-assistant/21-mobile-ux-plan.md
      className="flex-1 overflow-y-auto overscroll-contain bg-stone-50/40 px-3 py-4"
    >
      {messages.length === 0 && greeting && (
        <p
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          // CHA-244 — Greeting passé en text-base pour cohérence avec les
          // bulles et lisibilité en mobile. cf. runbook §E.
          className="rounded-xl bg-white px-3 py-2.5 text-base text-stone-700 shadow-sm"
        >
          {greeting}
        </p>
      )}
      <ul className="flex flex-col gap-3 mt-3" role="list">
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <MessageBubble message={m} />
            {showLeadFormInline && i === triggerIdx && (
              <LeadFormBubble language={language} />
            )}
          </Fragment>
        ))}
        {showLeadFormInline && triggerIdx === -1 && (
          <LeadFormBubble language={language} />
        )}
      </ul>
      {suggestions.length > 0 && (
        // CHA-310 — Pills conversion-focused. Affichées tant qu'aucun message
        // n'est parti ; dès la première prise de parole (libre ou pill),
        // `clearSuggestions()` retire tout le bloc — la conversation a démarré,
        // les CTAs initiaux n'ont plus leur place.
        <ul
          className="mt-4 flex flex-col gap-2"
          aria-label={quickSuggestionsLabel}
        >
          {suggestions.map((s, idx) => (
            <li key={s.key}>
              <SuggestionPill
                pillKey={s.key}
                label={s.label}
                index={idx}
                onTrigger={triggerPill}
              />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * CHA-310 — Mapping `key` (préfixe) → glyphe.
 *
 * On garde des SVG inline (le projet n'embarque pas `lucide-react`) et on
 * cible par préfixe pour absorber les variantes (`kit-reserve-now` vs
 * `kit-reserve-pack-v2`) sans toucher au code.
 *
 * Sémantique du choix d'icône (neuromarketing) :
 *   - `reserve`  → ShoppingBag : signal "panier prêt", commitment léger
 *   - `zero-risk` → ShieldCheck : levier sécurité / risk reversal
 *   - `similar`  → Users       : preuve sociale personnalisée
 *   - `callback` → Phone       : low-commitment, contact humain immédiat
 *   - `price`    → Tag         : ancrage promotionnel
 *   - `impressive` / `results` → Sparkles : émerveillement / résultat phare
 *   - `fit`      → HeartPulse  : personnalisation, écoute du besoin
 *   - `b2b`      → Briefcase   : pro
 *   - défaut     → MessageCircle : conversation neutre
 */
function PillIcon({ pillKey }: { pillKey: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (pillKey.includes('reserve') || pillKey.includes('price') || pillKey.includes('best-price')) {
    return (
      <svg {...common}>
        <path d="M3 6h18l-2 13H5L3 6Z" />
        <path d="M8 6V4a4 4 0 0 1 8 0v2" />
      </svg>
    );
  }
  if (pillKey.includes('zero-risk') || pillKey.includes('shield')) {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (pillKey.includes('similar') || pillKey.includes('case') || pillKey.includes('result')) {
    return (
      <svg {...common}>
        <path d="m12 3 2.4 5 5.6.8-4 4 1 5.6L12 16l-5 2.4 1-5.6-4-4L9.6 8 12 3Z" />
      </svg>
    );
  }
  if (pillKey.includes('callback') || pillKey.includes('call')) {
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z" />
      </svg>
    );
  }
  if (pillKey.includes('fit')) {
    return (
      <svg {...common}>
        <path d="M3.5 12h3.5l2-6 4 12 2-6h5.5" />
      </svg>
    );
  }
  if (pillKey.includes('b2b') || pillKey.includes('reseller')) {
    return (
      <svg {...common}>
        <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}

function SuggestionPill({
  pillKey,
  label,
  index,
  onTrigger,
}: {
  pillKey: string;
  label: string;
  index: number;
  onTrigger: (key: string, label: string) => void | Promise<void>;
}) {
  // CHA-310 — Design conversion-focused.
  //
  // Choix design (charte FemiGlow) :
  //  • Gradient blanc → rose-50 (rappel discret du rose-400 du Stop) pour
  //    sortir du bruit "stone" tout en restant doux.
  //  • Bordure rose-200 + shadow-sm : pill perçue comme "actionable",
  //    pas comme un simple chip de filtre.
  //  • Layout horizontal full-width avec icône à gauche, label, chevron
  //    droite → augmente la cible tactile mobile (≥ 44 px de hauteur) et
  //    guide le regard vers l'action.
  //  • Animation stagger fade-in slide-from-bottom : signale visuellement
  //    que ces options sont arrivées avec le greeting (pas une UI figée).
  //  • Hover : scale léger + shadow plus marqué → micro-affordance.
  return (
    <button
      type="button"
      data-pill-key={pillKey}
      data-testid={`chat-pill-${pillKey}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className={[
        'group flex w-full items-center gap-3 rounded-2xl',
        'border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/60',
        'px-4 py-3 text-start text-sm font-medium text-stone-800',
        'shadow-sm transition-all duration-150',
        'hover:border-rose-300 hover:shadow-md hover:from-rose-50/80 hover:to-rose-50',
        'active:scale-[0.985]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-1',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
      ].join(' ')}
      onClick={() => {
        void onTrigger(pillKey, label);
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600 transition-colors group-hover:bg-rose-200 group-hover:text-rose-700"
      >
        <PillIcon pillKey={pillKey} />
      </span>
      <span className="flex-1 leading-snug">{label}</span>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-stone-400 transition-colors group-hover:translate-x-0.5 group-hover:text-rose-500"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
