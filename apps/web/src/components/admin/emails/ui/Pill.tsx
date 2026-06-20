/**
 * Pill — pastille sémantique unique du socle emails (SOC-F06 / TRV-07).
 *
 * Les CINQ tons sémantiques de la section (fin des doublons chromatiques
 * sage/emerald, red/rose, blue/sky relevés par l'audit) dérivent désormais de
 * la SOURCE UNIQUE `ui/tokens.ts` (charte 09 §A.1, gate G10) :
 *   success → emerald · warning → amber · danger → rose · info → sky ·
 *   neutral → stone, en 2 intensités (subtle | solid).
 *
 * Présentationnel pur (RSC ou client). `data-tone`/`data-intensity` exposés
 * pour la traçabilité/debug visuel (charte §A.2). `common/StatusBadge` reste le
 * rendu canonique outbox et s'appuie sur les mêmes tokens.
 */
import type { ReactNode } from 'react';
import { RADIUS, TONE, toneClass, type Tone, type ToneIntensity } from './tokens';

export type { Tone } from './tokens';

/**
 * Rétro-compat : map des classes `subtle` par ton (l'ancien export public).
 * Dérivée de TONE — plus aucune classe de couleur en dur ici.
 */
export const TONE_CLS: Record<Tone, string> = {
  success: TONE.success.subtle,
  warning: TONE.warning.subtle,
  danger: TONE.danger.subtle,
  info: TONE.info.subtle,
  neutral: TONE.neutral.subtle,
};

export function Pill({
  tone = 'neutral',
  intensity = 'subtle',
  children,
  className = '',
  ...rest
}: {
  tone?: Tone;
  intensity?: ToneIntensity;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      role="status"
      data-tone={tone}
      data-intensity={intensity}
      className={`inline-flex items-center gap-1 ${RADIUS.pill} px-2 py-0.5 text-xs font-medium ${toneClass(
        tone,
        intensity,
      )} ${className}`}
    >
      {children}
    </span>
  );
}
