/**
 * Helpers Hero ↔ Components-CMS (P12 — pilote `home-hero`).
 *
 * `mergeHeroFields` prend les `HeroData` issus du mock / page et superpose
 * les champs éditoriaux résolus par la cascade Components-CMS quand la
 * source est différente de `'none'`. Les champs `image`, `variant`, et
 * tout ce qui n'est pas géré par le CMS restent inchangés.
 *
 * Cf. docs/components-cms/catalog/home-hero.md §6 — "Garder data.cta en
 * signature : ne pas renommer le shape du prop".
 */
import type { Hero as HeroData } from '@/lib/schemas';
import type { CTA } from '@/lib/schemas/common';
import type { ResolvedFields } from '@/lib/db/types';

function pickString(fields: ResolvedFields, key: string): string | undefined {
  const f = fields[key];
  if (!f || f.meta.source === 'none') return undefined;
  if (typeof f.value !== 'string') return undefined;
  const trimmed = f.value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickCta(fields: ResolvedFields, key: string): CTA | undefined {
  const f = fields[key];
  if (!f || f.meta.source === 'none' || f.value == null) return undefined;
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
 *   non-vide (binding ou default). `'none'` laisse `data` intact.
 * - `cta, ctaSecondary` : pareil, mais on ignore les CTAs invalides
 *   (label/href manquant) plutôt que de propager un objet à moitié rempli.
 * - `image, variant` : jamais touchés par cette fonction (slot system).
 */
export function mergeHeroFields(data: HeroData, fields: ResolvedFields): HeroData {
  const kicker = pickString(fields, 'kicker');
  const title = pickString(fields, 'title');
  const subtitle = pickString(fields, 'subtitle');
  const cta = pickCta(fields, 'cta');
  const ctaSecondary = pickCta(fields, 'ctaSecondary');

  return {
    ...data,
    kicker: kicker ?? data.kicker,
    title: title ?? data.title,
    subtitle: subtitle ?? data.subtitle,
    cta: cta ?? data.cta,
    ctaSecondary: ctaSecondary ?? data.ctaSecondary,
  };
}
