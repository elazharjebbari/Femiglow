import 'server-only';
import type { Hero as HeroData } from '@/lib/schemas';
import { Hero } from './Hero';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import { mergeHeroFields } from './hero-fields';

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
}

/**
 * RSC wrapper qui résout :
 *   1. le slot media `componentKey/primary` (système Component-Media existant) ;
 *   2. les champs éditoriaux `componentKey` (Components-CMS — P12) et les
 *      fusionne dans `data` via `mergeHeroFields`.
 *
 * Le rendu reste assuré par `<Hero>`, qui ignore tout du CMS.
 */
export async function HeroBound({ data, priority = true, componentKey }: HeroBoundProps) {
  const [resolved, fields] = await Promise.all([
    resolveComponentSlot(componentKey, 'primary'),
    resolveComponentFields(componentKey),
  ]);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
  const merged = mergeHeroFields(data, fields);

  if (!useBinding) {
    return <Hero data={merged} priority={priority} />;
  }

  return (
    <Hero
      data={merged}
      priority={priority}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="primary"
          context="hero"
          sizes="(min-width: 1024px) 45vw, 100vw"
          forcePriority={priority}
        />
      }
    />
  );
}
