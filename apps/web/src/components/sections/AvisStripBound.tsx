import 'server-only';
import type { ReactNode } from 'react';
import type { Testimonial } from '@/lib/schemas';
import { AvisStrip } from './AvisStrip';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface AvisStripBoundProps {
  testimonials: Testimonial[];
  kicker?: string;
  title?: string;
  /**
   * Composant du registre dont les slots `avis-<prenom>` alimentent chaque
   * carte. Si un binding actif existe, il prime sur `testimonial.handImage`.
   */
  componentKey?: string;
}

/**
 * Normalise un prénom en suffixe de slot : « Inès » → "ines", « Yasmine » →
 * "yasmine". Doit rester aligné avec `seed-mapping.ts` (slots `avis-salma`,
 * `avis-yasmine`, `avis-ines`).
 */
function slotForFirstName(firstName: string): string {
  return firstName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * RSC wrapper qui résout, pour chaque testimonial, un slot `avis-<prenom>` du
 * composant `home-avis-strip` et délègue à `AvisStrip`. Si aucun binding
 * actif → fallback vers `handImage` du CMS.
 */
export async function AvisStripBound({
  testimonials,
  kicker,
  title,
  componentKey = 'home-avis-strip',
}: AvisStripBoundProps) {
  const entries = await Promise.all(
    testimonials.map(async (t): Promise<[string, ReactNode] | null> => {
      const slot = `avis-${slotForFirstName(t.authorFirstName)}`;
      const resolved = await resolveComponentSlot(componentKey, slot);
      const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
      if (!useBinding) return null;
      return [
        t.id,
        <ComponentMedia
          key={t.id}
          componentKey={componentKey}
          slot={slot}
          context="inline"
          sizes="(min-width: 1024px) 320px, (min-width: 720px) 40vw, 80vw"
        />,
      ];
    }),
  );

  const mediaSlotsByTestimonialId = Object.fromEntries(
    entries.filter((e): e is [string, ReactNode] => e !== null),
  );

  return (
    <AvisStrip
      testimonials={testimonials}
      kicker={kicker}
      title={title}
      mediaSlotsByTestimonialId={mediaSlotsByTestimonialId}
    />
  );
}
