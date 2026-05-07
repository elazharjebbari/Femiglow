import 'server-only';
import type { Hero as HeroData } from '@/lib/schemas';
import { HeroLifestyle } from './HeroLifestyle';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface HeroLifestyleBoundProps {
  data: HeroData;
  priority?: boolean;
  componentKey: string;
}

/**
 * RSC wrapper qui résout `componentKey/primary` pour `HeroLifestyle`. Le
 * media remplit la section via `aspectRatio: auto` + 100% h/w (override des
 * styles inline de MediaImageClient).
 */
export async function HeroLifestyleBound({
  data,
  priority = true,
  componentKey,
}: HeroLifestyleBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, 'primary');
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <HeroLifestyle data={data} priority={priority} />;
  }

  return (
    <HeroLifestyle
      data={data}
      priority={priority}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="primary"
          context="hero"
          sizes="100vw"
          forcePriority={priority}
          style={{ aspectRatio: 'auto', width: '100%', height: '100%' }}
        />
      }
    />
  );
}
