/**
 * Pastille typographique numérotée pour les cards de la section
 * « La composition » du `/kit`.
 *
 * Kolenda §4.3 : un numéro en or poudré (ou couleur d'accent) sert de
 * repère visuel du parcours « 01 → 02 → 03 ». La pastille est décorative
 * (`aria-hidden="true"`) — le titre porte déjà le numéro pour l'a11y.
 */
import type { CSSProperties } from 'react';

export interface NumberBadgeProps {
  /** Label déjà formaté 2 digits (« 01 », « 02 »...). */
  label: string;
  /** Couleur en hex de l'accent (cf. `resolveAccentHex`). */
  hex: string;
  /** Optionnel : positionnement absolu (par défaut, top-left de la card). */
  className?: string;
}

export function NumberBadge({ label, hex, className }: NumberBadgeProps): JSX.Element {
  // `boxShadow` simule un ring d'1px à 25 % d'opacité de la couleur d'accent
  // sans avoir besoin d'une class Tailwind dynamique (impossible à purge).
  const style: CSSProperties = {
    color: hex,
    boxShadow: `inset 0 0 0 1px ${hex}40`,
  };
  return (
    <span
      aria-hidden="true"
      data-testid="composition-number-badge"
      className={[
        'absolute -top-3 -left-3 z-10 inline-flex h-9 w-9 items-center justify-center',
        'rounded-full bg-[#FBFAF6] font-display text-base shadow-sm',
        '[font-variant-numeric:tabular-nums]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {label}
    </span>
  );
}
