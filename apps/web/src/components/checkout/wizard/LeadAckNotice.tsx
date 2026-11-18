'use client';

import { cn } from '@/lib/utils/cn';

export interface LeadAckNoticeProps {
  /** « C'est noté, Salma. » */
  title: string;
  /** Phrase d'annonce de l'appel, numéro inclus. */
  body: string;
  /** Version sur une ligne, numéro inclus. */
  compactLabel: string;
  /** Numéro tel qu'il figure dans `body` et `compactLabel`. */
  phone: string;
  /** Carte complète à l'arrivée ; une ligne dès que la saisie commence. */
  expanded: boolean;
}

function Check({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Le numéro reste lisible de gauche à droite, en gras, et ne se coupe pas. */
function WithPhone({ text, phone }: { text: string; phone: string }) {
  const at = text.indexOf(phone);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <bdi dir="ltr" className="whitespace-nowrap font-semibold tabular-nums text-encre">
        {phone}
      </bdi>
      {text.slice(at + phone.length)}
    </>
  );
}

/**
 * Accusé de l'étape 1, en tête de l'étape 2 : le numéro est enregistré et
 * l'équipe appellera, que la cliente termine ou non. Elle relit son numéro ;
 * le lien « Modifier » de la ligne de progression est juste au-dessus.
 *
 * Deux états, sans animation de hauteur : le champ ville ne doit pas bouger
 * pendant que le clavier s'ouvre.
 */
export function LeadAckNotice({ title, body, compactLabel, phone, expanded }: LeadAckNoticeProps) {
  return (
    <div role="status" data-testid="wizard-lead-ack" data-expanded={expanded}>
      {expanded ? (
        <div className="fg-ack-in grid grid-cols-[28px_1fr] items-start gap-3 rounded-xl bg-sauge-soft px-3.5 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sauge-dark text-creme">
            <Check size={15} />
          </span>
          <p className="min-w-0 text-[13.5px] leading-snug text-encre-soft">
            <strong className="block text-[15px] font-semibold text-encre">{title}</strong>
            <WithPhone text={body} phone={phone} />
          </p>
        </div>
      ) : (
        <p className={cn('flex items-center gap-1.5 text-[13px] font-medium leading-tight text-sauge-dark')}>
          <span className="shrink-0">
            <Check size={14} />
          </span>
          <span className="min-w-0">
            <WithPhone text={compactLabel} phone={phone} />
          </span>
        </p>
      )}
    </div>
  );
}
