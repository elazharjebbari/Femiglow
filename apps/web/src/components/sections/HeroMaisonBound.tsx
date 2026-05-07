import 'server-only';
import type { Hero as HeroData } from '@/lib/schemas';
import { HeroMaison } from './HeroMaison';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface HeroMaisonBoundProps {
  data: HeroData;
  componentKey: string;
  slot?: string;
}

/**
 * RSC wrapper qui résout `componentKey/primary` et l'affiche en fond du hero
 * maison (sous voile crème pour préserver la typo).
 */
export async function HeroMaisonBound({
  data,
  componentKey,
  slot = 'primary',
}: HeroMaisonBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <HeroMaison data={data} />;
  }

  return (
    <HeroMaison
      data={data}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot={slot}
          context="hero"
          sizes="100vw"
          forcePriority
          style={{ aspectRatio: 'auto', width: '100%', height: '100%' }}
        />
      }
    />
  );
}
