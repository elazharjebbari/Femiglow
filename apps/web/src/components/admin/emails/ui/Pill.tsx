/**
 * Pill — pastille sémantique unique du socle emails (SOC-F06 / TRV-07).
 *
 * Les CINQ tons sémantiques de la section (fin des doublons chromatiques
 * sage/emerald, red/rose, blue/sky relevés par l'audit — design-system §1) :
 *   success → emerald · warning → amber · danger → rose · info → sky ·
 *   neutral → stone.
 *
 * Présentationnel pur (RSC ou client). Les maps de domaine (statuts outbox,
 * statuts de run, statuts de campagne…) fournissent `{label, tone}` ;
 * `common/StatusBadge` reste le rendu canonique outbox et s'appuie dessus.
 */
import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE_CLS: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-stone-100 text-stone-700',
};

export function Pill({
  tone = 'neutral',
  children,
  className = '',
  ...rest
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
