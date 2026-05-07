import 'server-only';
import type { ComponentProps } from 'react';
import { HeroProduit } from './HeroProduit';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

type HeroProduitBoundProps = Omit<ComponentProps<typeof HeroProduit>, 'mediaSlot'> & {
  componentKey: string;
  slot?: string;
};

/**
 * RSC wrapper qui résout `componentKey/primary` et délègue à `HeroProduit`.
 * Si aucun binding actif → fallback vers `product.images[0]`.
 */
export async function HeroProduitBound({
  componentKey,
  slot = 'primary',
  ...rest
}: HeroProduitBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <HeroProduit {...rest} />;
  }

  return (
    <HeroProduit
      {...rest}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot={slot}
          context="hero"
          sizes="(min-width: 1024px) 50vw, 100vw"
          forcePriority
        />
      }
    />
  );
}
