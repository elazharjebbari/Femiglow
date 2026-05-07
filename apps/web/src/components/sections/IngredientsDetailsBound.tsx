import 'server-only';
import type { ComponentProps } from 'react';
import { IngredientsDetails } from './IngredientsDetails';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

type IngredientsDetailsBoundProps = Omit<
  ComponentProps<typeof IngredientsDetails>,
  'mediaSlot'
> & {
  componentKey: string;
  slot?: string;
};

/**
 * RSC wrapper qui résout `componentKey/primary` et l'affiche en bandeau
 * au-dessus de la table d'ingrédients. Si aucun binding actif → pas
 * d'illustration (silencieux).
 */
export async function IngredientsDetailsBound({
  componentKey,
  slot = 'primary',
  ...rest
}: IngredientsDetailsBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <IngredientsDetails {...rest} />;
  }

  return (
    <IngredientsDetails
      {...rest}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot={slot}
          context="inline"
          sizes="(min-width: 1280px) 1200px, (min-width: 720px) 90vw, 100vw"
        />
      }
    />
  );
}
