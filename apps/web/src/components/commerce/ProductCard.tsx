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
    <article className="flex flex-col gap-4">
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
        <Heading as="h3" size="sm">
          {subProduct.name}
        </Heading>
        <Text size="caption" tone="tertiary">
          {subProduct.volume}
        </Text>
        <Text size="body" tone="secondary" prose>
          {subProduct.shortDescription}
        </Text>
        {detailsHref ? (
          <a
            href={detailsHref}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline"
          >
            Voir la composition <span aria-hidden="true">↓</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
