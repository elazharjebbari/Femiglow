/**
 * `PackVisualBound` — wrapper RSC du packshot section « Le Pack » (§4.6).
 *
 * Délègue à `<ComponentMedia componentKey="kit-pack-visual" slot="primary">` :
 *  - si un binding admin est actif et un media disponible, rend `next/image`
 *    avec variantes AVIF/WebP/JPEG multi-breakpoints + blurhash + sizes ;
 *  - sinon, le `defaultSvgFallback` du registry (`/products/kit-principale.svg`)
 *    est rendu inline.
 *
 * L'admin peut, depuis `/admin/components`, désactiver le binding ou
 * pointer ce slot vers un autre media du catalogue. Un re-seed restaure
 * `kit-pack-shot.png` comme canon (autoActivate dans `seed-mapping.ts`).
 *
 * Le composant `PackVisual` (Server, statique) reste exporté en parallèle
 * comme fallback utilisable hors RSC et pour les tests unitaires.
 */
import 'server-only';

import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { cn } from '@/lib/utils/cn';

export interface PackVisualBoundProps {
  /** Alt text utilisé si le media DB n'en porte pas. */
  alt: string;
  /** Classes additionnelles sur le wrapper `<figure>`. */
  className?: string;
}

export function PackVisualBound({
  alt,
  className,
}: PackVisualBoundProps): JSX.Element {
  return (
    <figure
      data-testid="pack-visual"
      className={cn(
        'mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-md bg-creme-warm/30',
        className,
      )}
    >
      <ComponentMedia
        componentKey="kit-pack-visual"
        slot="primary"
        context="inline"
        altOverride={alt}
        sizes="(min-width: 768px) 40vw, 100vw"
        className="h-full w-full object-contain"
      />
    </figure>
  );
}
