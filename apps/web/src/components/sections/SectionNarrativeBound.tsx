import 'server-only';
import type { ComponentProps } from 'react';
import { SectionNarrative } from './SectionNarrative';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

type SectionNarrativeBoundProps = Omit<
  ComponentProps<typeof SectionNarrative>,
  'mediaSlot'
> & {
  componentKey: string;
  /** Slot par défaut : 'primary'. Override pour les composants multi-slot. */
  slot?: string;
};

/**
 * RSC wrapper qui résout `componentKey/slot` et délègue à `SectionNarrative`.
 * Si aucun binding actif → fallback vers `image` du CMS.
 */
export async function SectionNarrativeBound({
  componentKey,
  slot = 'primary',
  ...rest
}: SectionNarrativeBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <SectionNarrative {...rest} />;
  }

  return (
    <SectionNarrative
      {...rest}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot={slot}
          context="inline"
          sizes="(min-width: 1024px) 40vw, 100vw"
        />
      }
    />
  );
}
