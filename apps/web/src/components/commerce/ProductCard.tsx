import type { ReactNode } from 'react';
import { Image } from '@/components/ui/Image';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { SubProduct } from '@/lib/schemas';

interface ProductCardProps {
  subProduct: SubProduct;
  detailsHref?: string;
  /**
   * Slot media résolu côté serveur (Component-Media). Si présent,
   * remplace l'`<Image src={subProduct.image}>` (SVG fallback du CMS).
   */
  mediaSlot?: ReactNode;
}

export function ProductCard({ subProduct, detailsHref, mediaSlot }: ProductCardProps) {
  return (
    // Card Kolenda §4.3 : bordure gris-sauge `#C7CCC2`, fond ivoire warm
    // `#FBFAF6`, padding interne. Émerge du fond sable de la section.
    // Phase 0 — adaptation a minima ; phase 2 introduit `CompositionCard`
    // dédié avec pastille numérotée, sensation et accentColor.
    <article className="flex flex-col gap-4 rounded-md border border-[#C7CCC2] bg-[#FBFAF6] p-4 sm:p-5">
      {mediaSlot ?? (
        <Image
          src={subProduct.image.src}
          alt={subProduct.image.alt}
          width={subProduct.image.width}
          height={subProduct.image.height}
          ratio="1:1"
          sizes="(min-width: 1024px) 28vw, (min-width: 720px) 45vw, 90vw"
        />
      )}
      <div className="space-y-2">
        {/* Titre + volume inline (Kolenda §2.3 + Pricing §51-56 tabular-nums) */}
        <Heading as="h3" size="sm">
          {subProduct.name}
          <span className="ml-2 align-baseline font-body text-base text-stone-500 [font-variant-numeric:tabular-nums]">
            · {subProduct.volume.toLowerCase()}
          </span>
        </Heading>
        <Text size="body" tone="secondary" prose>
          {subProduct.shortDescription}
        </Text>
        {detailsHref ? (
          <a
            href={detailsHref}
            // Ancre éditoriale : « Lire le détail » > « Voir la composition »
            // qui dupliquait l'eyebrow LA COMPOSITION (UX §3 takeaway clair).
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876]/40"
          >
            Lire le détail <span aria-hidden="true">↓</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
