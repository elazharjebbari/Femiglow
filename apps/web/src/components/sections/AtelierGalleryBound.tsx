import 'server-only';
import type { Atelier } from '@/lib/schemas';
import {
  AtelierGallery,
  type AtelierGalleryMediaSlot,
} from './AtelierGallery';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface AtelierGalleryBoundProps {
  data: Atelier;
  componentKey?: string;
  /** Phase 9bis — kicker/titre localisés de la section atelier. */
  kicker?: string;
  title?: string;
}

const SLOT_KEYS = ['atelier-1', 'atelier-2', 'atelier-3'] as const;

/**
 * RSC wrapper qui résout les 3 slots `atelier-1/2/3` du composant
 * `maison-atelier-gallery` et les forwarde au composant client.
 */
export async function AtelierGalleryBound({
  data,
  componentKey = 'maison-atelier-gallery',
  kicker,
  title,
}: AtelierGalleryBoundProps) {
  const resolutions = await Promise.all(
    SLOT_KEYS.map((slot) => resolveComponentSlot(componentKey, slot)),
  );

  // On exige les 3 slots actifs simultanément pour assurer la cohérence
  // visuelle de la galerie (sinon mix svg/photos peu élégant).
  const allActive = resolutions.every(
    (r) => r?.binding?.isActive && r?.media,
  );

  if (!allActive) {
    return <AtelierGallery data={data} kicker={kicker} title={title} />;
  }

  const mediaSlotsByIndex: AtelierGalleryMediaSlot[] = SLOT_KEYS.map((slot) => ({
    thumbnail: (
      <ComponentMedia
        componentKey={componentKey}
        slot={slot}
        context="inline"
        sizes="(min-width: 1024px) 33vw, 100vw"
        style={{ aspectRatio: '3 / 2', width: '100%', height: '100%' }}
      />
    ),
    full: (
      <ComponentMedia
        componentKey={componentKey}
        slot={slot}
        context="inline"
        sizes="100vw"
        style={{ aspectRatio: '3 / 2', width: '100%', height: '100%' }}
      />
    ),
  }));

  return (
    <AtelierGallery
      data={data}
      mediaSlotsByIndex={mediaSlotsByIndex}
      kicker={kicker}
      title={title}
    />
  );
}
