/**
 * Petites briques visuelles partagées par la matrice et le tiroir
 * (pastilles de statut, vignettes). Palette `stone` de l'admin composants.
 */
'use client';

import type { PillTone, StatusPill } from './model';

const PILL_CLASS: Record<PillTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  neutral: 'border-stone-200 bg-stone-50 text-stone-700',
};

export function Pill({ pill }: { pill: StatusPill }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-medium leading-4 ${PILL_CLASS[pill.tone]}`}
    >
      {pill.label}
    </span>
  );
}

export function Thumb({
  src,
  alt = '',
  size = 'md',
  dimmed = false,
  broken = false,
}: {
  src: string | null | undefined;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dimmed?: boolean;
  broken?: boolean;
}): JSX.Element {
  const dims = {
    xs: 'h-7 w-[22px]',
    sm: 'h-10 w-8',
    md: 'h-14 w-11',
    lg: 'h-28 w-[90px]',
  }[size];
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded border bg-stone-100 ${dims} ${
        broken ? 'border-rose-300' : 'border-stone-200'
      } ${dimmed ? 'opacity-50 grayscale-[40%]' : ''}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-[10px] text-stone-400">
          ∅
        </span>
      )}
    </span>
  );
}

/** Classes communes des boutons de l'éditeur (stone, focus visible). */
export const BTN = {
  base: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'bg-stone-900 text-white hover:bg-stone-700',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
  dangerSolid: 'bg-rose-700 text-white hover:bg-rose-800',
  ghost: 'text-stone-700 hover:bg-stone-100',
} as const;

export function btn(kind: Exclude<keyof typeof BTN, 'base'>, extra = ''): string {
  return `${BTN.base} ${BTN[kind]} ${extra}`.trim();
}
