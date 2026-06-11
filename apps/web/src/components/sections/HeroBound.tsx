import 'server-only';
import type { Hero as HeroData } from '@/lib/schemas';
import { Hero } from './Hero';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { buildHeroPreload } from '@/lib/media/preload';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import { mergeHeroFields } from './hero-fields';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface HeroBoundProps {
  data: HeroData;
  priority?: boolean;
  /**
   * Composant du registre dont le slot 'primary' alimente le hero **et** dont
   * les champs éditoriaux (Components-CMS, P12) priment sur `data.{kicker,
   * title, subtitle, cta, ctaSecondary}`. Le `data` reste utilisé en
   * fallback si la cascade tombe sur `none`.
   */
  componentKey: string;
  /**
   * Phase 7B — Locale active de la page courante. Sans valeur, on
   * suppose `DEFAULT_LOCALE` (FR) pour rester back-compat avec le legacy.
   * Avec valeur, les bindings + defaults FR ne peuvent pas écraser un
   * `data` localisé (mock AR/EN) — cf. `mergeHeroFields` §Phase 7B.
   */
  locale?: Locale;
}

/**
 * RSC wrapper qui résout :
 *   1. le slot media `componentKey/primary` (système Component-Media existant) ;
 *   2. les champs éditoriaux `componentKey` (Components-CMS — P12) et les
 *      fusionne dans `data` via `mergeHeroFields`.
 *
 * Le rendu reste assuré par `<Hero>`, qui ignore tout du CMS.
 *
 * Locale-aware (Phase 7B) :
 *   - `resolveComponentFields(key, locale)` → cherche le binding correspondant
 *     à la locale active. Si absent, retombe sur le `defaultValue` du registry
 *     (toujours FR).
 *   - `mergeHeroFields(data, fields, { locale })` → en AR/EN, refuse le
 *     `default` FR pour ne pas écraser la valeur du mock localisé.
 */
export async function HeroBound({
  data,
  priority = true,
  componentKey,
  locale,
}: HeroBoundProps) {
  const effectiveLocale = locale ?? DEFAULT_LOCALE;
  const [resolved, fields] = await Promise.all([
    resolveComponentSlot(componentKey, 'primary'),
    resolveComponentFields(componentKey, effectiveLocale),
  ]);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
  const merged = mergeHeroFields(data, fields, { locale });

  if (!useBinding) {
    return <Hero data={merged} priority={priority} />;
  }

  const heroSizes = '(min-width: 1024px) 45vw, 100vw';
  // Preload LCP : précharge l'image hero dans le MEILLEUR format (avif/webp)
  // via <link rel=preload as=image imagesrcset type=…>. React 18.3 / Next 14
  // hoiste ce <link> dans <head>. Réutilise la MÊME résolution (resolveConfig
  // + pickVariants) que le rendu → preload jamais gaspillé. Audit
  // docs/image-optimization-audit-2026-06-01.
  const heroPreload =
    priority && resolved?.media
      ? await buildHeroPreload(resolved.media.id, 'hero', heroSizes)
      : null;

  return (
    <>
      {heroPreload ? (
        <link
          rel="preload"
          as="image"
          href={heroPreload.href}
          imageSrcSet={heroPreload.imageSrcset}
          imageSizes={heroPreload.imageSizes}
          type={heroPreload.type}
          fetchPriority="high"
        />
      ) : null}
      <Hero
        data={merged}
        priority={priority}
        mediaSlot={
          <ComponentMedia
            componentKey={componentKey}
            slot="primary"
            context="hero"
            sizes={heroSizes}
            forcePriority={priority}
          />
        }
      />
    </>
  );
}
