/**
 * tokens.ts — SOURCE UNIQUE des classes de design du sous-système admin/emails
 * (charte `docs/emailing/audit-ux-interfaces-2026-06/technique/09-charte-ux-qualite.md`,
 * gate G10).
 *
 * Pourquoi des constantes TS et PAS des alias `tailwind.config` : la config
 * Tailwind est PARTAGÉE avec le site public éditorial (refonte = risque de
 * débordement). On centralise donc ici les *chaînes de classes Tailwind* déjà
 * employées, pour qu'une seule édition propage le changement à tout le
 * sous-système — sans toucher la config globale.
 *
 * Invariant (verrou cliquet `ui/__qa__/verrous.test.ts`) : aucune classe
 * `bg-`/`text-`/`border-` de COULEUR (hors `stone-` neutre) ne doit apparaître
 * AILLEURS que dans ce fichier, dans `components/admin/emails/**` et
 * `app/admin/emails/**`. La whitelist du verrou ne peut que décroître.
 *
 * Positionnement assumé : admin emails = sous-système « utilitaire dense »,
 * palette stone-neutre + 5 tons sémantiques, 2 intensités (subtle | solid).
 */

// ── Tons sémantiques × intensité ───────────────────────────────────────────
//
// `subtle` = fond clair + encre tonale (badge calme, l'écrasante majorité).
// `solid`  = fond plein + encre blanche (état TERMINAL/urgent qui doit accrocher
//            l'œil : DLQ, bounce permanent…). On bannit les nuances ad hoc
//            50/100/200 dispersées au profit de ces 2 paliers nommés.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ToneIntensity = 'subtle' | 'solid';

export const TONE: Record<Tone, Record<ToneIntensity, string>> = {
  success: { subtle: 'bg-emerald-50 text-emerald-700', solid: 'bg-emerald-700 text-white' },
  warning: { subtle: 'bg-amber-50 text-amber-800', solid: 'bg-amber-600 text-white' },
  danger: { subtle: 'bg-rose-50 text-rose-700', solid: 'bg-rose-700 text-white' },
  info: { subtle: 'bg-sky-50 text-sky-700', solid: 'bg-sky-700 text-white' },
  neutral: { subtle: 'bg-stone-100 text-stone-700', solid: 'bg-stone-800 text-white' },
};

/** Bordures tonales (bannières, encadrés) — dérivées des mêmes tons. */
export const TONE_BORDER: Record<Tone, string> = {
  success: 'border-emerald-200',
  warning: 'border-amber-200',
  danger: 'border-rose-200',
  info: 'border-sky-200',
  neutral: 'border-stone-200',
};

/** Encre sémantique (texte/icône seuls : messages inline, aides d'erreur). */
export const INK: Record<Tone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  info: 'text-sky-700',
  neutral: 'text-stone-600',
};

// ── Boutons (variantes de couleur/état — la primitive Button ajoute la taille) ─
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-stone-900 text-white hover:bg-stone-700',
  secondary: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
  danger: 'bg-rose-700 text-white hover:bg-rose-800',
  ghost: 'text-stone-700 hover:bg-stone-100',
};

/** Classes d'un ton à une intensité donnée (helper unique). */
export function toneClass(tone: Tone, intensity: ToneIntensity = 'subtle'): string {
  return TONE[tone][intensity];
}

// ── Échelle typographique nommée (rôles, pas de pas littéraux dispersés) ─────
export const TYPO = {
  pageTitle: 'text-2xl font-semibold tracking-tight text-stone-900',
  sectionTitle: 'text-lg font-semibold text-stone-900',
  cardHeading: 'text-sm font-medium text-stone-700',
  label: 'text-xs font-medium text-stone-600',
  meta: 'text-xs text-stone-500',
  mono: 'font-mono text-xs tabular-nums text-stone-700',
} as const;

// ── Échelle d'espacement / rythme (multiples cohérents) ──────────────────────
export const SPACE = {
  page: 'max-w-6xl',
  section: 'space-y-6',
  card: 'p-4',
  cardCompact: 'p-3',
  field: 'space-y-1.5',
  inlineGap: 'gap-2',
} as const;

// ── Rayons ───────────────────────────────────────────────────────────────────
export const RADIUS = {
  card: 'rounded-md',
  control: 'rounded',
  pill: 'rounded-full',
} as const;

// ── Anneau de focus UNIQUE (a11y — un seul endroit) ──────────────────────────
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-1' as const;

// ── Mouvement (toujours motion-safe : prefers-reduced-motion respecté) ───────
export const MOTION = {
  enter: 'motion-safe:transition motion-safe:duration-150 motion-safe:ease-out',
  fade: 'motion-safe:transition-opacity motion-safe:duration-150',
} as const;
