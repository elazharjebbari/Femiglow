import 'server-only';
import { ComparatifSection } from './ComparatifSection';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import type { KitComparatif } from '@/lib/schemas';

interface ComparatifSectionBoundProps {
  data: KitComparatif;
  componentKey?: string;
}

const SLOTS = ['kit-base', 'kit-fortifiant', 'kit-lime'] as const;

/**
 * RSC wrapper qui résout les 3 slots produit (`kit-base`, `kit-fortifiant`,
 * `kit-lime`) et les affiche en triptyque au-dessus de la table comparatif.
 */
export async function ComparatifSectionBound({
  data,
  componentKey = 'kit-comparatif',
}: ComparatifSectionBoundProps) {
  const resolutions = await Promise.all(
    SLOTS.map((slot) => resolveComponentSlot(componentKey, slot)),
  );
  const allActive = resolutions.every(
    (r) => r?.binding?.isActive && r?.media,
  );

  if (!allActive) {
    return <ComparatifSection data={data} />;
  }

  return (
    <ComparatifSection
      data={data}
      productMediaSlots={SLOTS.map((slot) => (
        <ComponentMedia
          key={slot}
          componentKey={componentKey}
          slot={slot}
          context="inline"
          sizes="(min-width: 1024px) 25vw, 33vw"
          style={{ aspectRatio: '1 / 1', width: '100%', height: '100%' }}
        />
      ))}
    />
  );
}
