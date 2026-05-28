/**
 * Helpers Hero ↔ Components-CMS (P12 — pilote `home-hero`).
 *
 * `mergeHeroFields` prend les `HeroData` issus du mock / page et superpose
 * les champs éditoriaux résolus par la cascade Components-CMS quand la
 * source est différente de `'none'`. Les champs `image`, `variant`, et
 * tout ce qui n'est pas géré par le CMS restent inchangés.
 *
 * Phase 7B (2026-05) — Le merge devient `locale-aware` :
 *  - En `defaultLocale` (FR) : comportement historique (binding > default > data).
 *  - En non-default (AR / EN) : on n'accepte QUE `source === 'binding'`. Si
 *    la cascade tombe sur `default` (= valeur FR du registry), on conserve
 *    le `data` localisé (mock AR/EN). Évite l'override FR sur le hero
 *    arabe quand le seed AR/EN n'a pas encore tourné.
 *
 * Cf. docs/components-cms/catalog/home-hero.md §6 — "Garder data.cta en
 * signature : ne pas renommer le shape du prop".
 * Cf. docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A6.
 */
import type { Hero as HeroData } from '@/lib/schemas';
import type { CTA } from '@/lib/schemas/common';
import type { ResolvedFields } from '@/lib/db/types';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

/**
 * Options de merge — toutes optionnelles pour back-compat 100 %.
 *
 * @property locale  Locale active de la page. Si absente, on suppose
 *                   `defaultLocale` (FR) → comportement historique.
 * @property defaultLocale  Locale qui correspond à la valeur du registry
 *                   `defaultValue`. Par défaut `'fr'` (cf. registre actuel).
 */
export interface MergeHeroFieldsOptions {
  locale?: Locale;
  defaultLocale?: Locale;
}

/**
 * Décide si on peut accepter une valeur résolue avec `source === 'default'`.
 *
 * - Si pas de locale (ou locale = defaultLocale) → oui (legacy).
 * - Sinon → non. Les defaults FR du registry ne doivent jamais écraser
 *   un `data` localisé.
 */
function shouldAcceptDefault(options?: MergeHeroFieldsOptions): boolean {
  if (!options?.locale) return true;
  const fallback = options.defaultLocale ?? DEFAULT_LOCALE;
  return options.locale === fallback;
}

function pickString(
  fields: ResolvedFields,
  key: string,
  options?: MergeHeroFieldsOptions,
): string | undefined {
  const f = fields[key];
  if (!f || f.meta.source === 'none') return undefined;
  if (f.meta.source === 'default' && !shouldAcceptDefault(options)) {
    return undefined;
  }
  if (typeof f.value !== 'string') return undefined;
  const trimmed = f.value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickCta(
  fields: ResolvedFields,
  key: string,
  options?: MergeHeroFieldsOptions,
): CTA | undefined {
  const f = fields[key];
  if (!f || f.meta.source === 'none' || f.value == null) return undefined;
  if (f.meta.source === 'default' && !shouldAcceptDefault(options)) {
    return undefined;
  }
  const v = f.value as Record<string, unknown>;
  const label = typeof v.label === 'string' ? v.label : null;
  const href = typeof v.href === 'string' ? v.href : null;
  const variant = typeof v.variant === 'string' ? v.variant : null;
  if (!label || !href) return undefined;
  // CTA variants tolérés par le composant ButtonLink ; on retombe sur 'primary'
  // si la valeur n'est pas reconnue plutôt que de casser le rendu.
  return { label, href, variant: (variant ?? 'primary') as CTA['variant'] };
}

/**
 * Fusionne `HeroData` avec les champs éditoriaux résolus.
 * - `kicker, title, subtitle` : remplacés si la cascade renvoie une valeur
 *   non-vide ET acceptable selon la locale. `'none'` ou `'default'` (hors
 *   defaultLocale) laissent `data` intact.
 * - `cta, ctaSecondary` : pareil, mais on ignore les CTAs invalides
 *   (label/href manquant) plutôt que de propager un objet à moitié rempli.
 * - `image, variant` : jamais touchés par cette fonction (slot system).
 */
export function mergeHeroFields(
  data: HeroData,
  fields: ResolvedFields,
  options?: MergeHeroFieldsOptions,
): HeroData {
  const kicker = pickString(fields, 'kicker', options);
  const title = pickString(fields, 'title', options);
  const subtitle = pickString(fields, 'subtitle', options);
  const cta = pickCta(fields, 'cta', options);
  const ctaSecondary = pickCta(fields, 'ctaSecondary', options);

  return {
    ...data,
    kicker: kicker ?? data.kicker,
    title: title ?? data.title,
    subtitle: subtitle ?? data.subtitle,
    cta: cta ?? data.cta,
    ctaSecondary: ctaSecondary ?? data.ctaSecondary,
  };
}
