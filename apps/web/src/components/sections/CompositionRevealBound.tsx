import 'server-only';
import type { ReactNode } from 'react';
import type { SubProduct } from '@/lib/schemas';
import { CompositionReveal } from './CompositionReveal';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface CompositionRevealBoundProps {
  items: SubProduct[];
  ingredientsAnchor?: string;
}

/**
 * Mapping `subProduct.id` (CMS) → slot Component-Media (sous `kit-comparatif`).
 * Les bindings `kit-comparatif/kit-base|kit-fortifiant|kit-lime` sont déjà seedés
 * (cf. `seed-mapping.ts`) et utilisés également par `ComparatifSectionBound`.
 * On les réutilise ici pour éviter de dupliquer la déclaration de slots.
 *
 * IMPORTANT — les clés correspondent aux `subProduct.id` du contenu Kit
 * (cf. `apps/web/src/data/mock/kit.ts`). Lors du refactor audit 08/09, les
 * sous-produits ont été renommés `1-paste / 2-powder / polissoir-step-4`
 * mais ce mapping pointait encore sur les anciens ids — résultat : aucun
 * binding ne matchait, la CompositionReveal retombait sur le SVG fallback
 * (`/products/kit-base.svg` etc.) alors que les bindings DB étaient bien actifs.
 */
const SUB_PRODUCT_ID_TO_SLOT: Record<string, string> = {
  '1-paste': 'kit-base',
  '2-powder': 'kit-fortifiant',
  'polissoir-step-4': 'kit-lime',
};

const COMPONENT_KEY = 'kit-comparatif';

/**
 * RSC wrapper qui résout les bindings produit du `kit-comparatif` pour les
 * trois `ProductCard` de `CompositionReveal`. Réutilise les slots déjà
 * exploités par `ComparatifSectionBound` (un seul jeu de bindings éditoriaux
 * pour les visuels produits du kit).
 */
export async function CompositionRevealBound({
  items,
  ingredientsAnchor,
}: CompositionRevealBoundProps) {
  const resolutions = await Promise.all(
    items.map(async (item) => {
      const slot = SUB_PRODUCT_ID_TO_SLOT[item.id];
      if (!slot) return { item, slot: null, useBinding: false };
      const resolved = await resolveComponentSlot(COMPONENT_KEY, slot);
      const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
      return { item, slot, useBinding };
    }),
  );

  const mediaSlots: Record<string, ReactNode> = {};
  for (const { item, slot, useBinding } of resolutions) {
    if (!slot || !useBinding) continue;
    mediaSlots[item.id] = (
      <ComponentMedia
        componentKey={COMPONENT_KEY}
        slot={slot}
        context="inline"
        sizes="(min-width: 1024px) 28vw, (min-width: 720px) 45vw, 90vw"
        altOverride={item.image.alt}
      />
    );
  }

  return (
    <CompositionReveal
      items={items}
      ingredientsAnchor={ingredientsAnchor}
      mediaSlots={mediaSlots}
    />
  );
}
