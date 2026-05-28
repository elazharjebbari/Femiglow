/**
 * `CompositionCard` — card individuelle d'un sous-produit dans la section
 * « La composition » du `/kit`.
 *
 * Refonte Kolenda §4.3 — couvre les principes :
 *  - Pastille numérotée en couleur d'accent (NumberBadge),
 *  - Titre + volume inline avec tabular-nums (`buildCardHeader`),
 *  - Continuité d'image dans `shortDescription` (data CMS),
 *  - Mention de sensation italique (SensationLine),
 *  - Lien éditorial « Lire le détail ↓ » vers l'ancre INCI.
 *
 * Phase 2 — Pas encore d'animation Framer Motion (phase 4) ni de
 * crossfade image isolated ↔ contextual (phase 3). Le slot `mediaSlot`
 * accepte une `ReactNode` qui peut être :
 *  - un `<Image>` static résolu côté server,
 *  - en phase 3, un `<MediaCrossfade>` wrapper.
 *
 * cf. docs/composition-reveal-optim-2026-05/05-frontend-public-design.md
 */
import type { ReactNode } from 'react';

import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/Text';
import {
  formatIndex,
  formatSensation,
  resolveAccentHex,
} from '@/lib/composition/copy';
import type { SubProduct } from '@/lib/schemas';

import { MediaCrossfade } from './MediaCrossfade';
import { NumberBadge } from './NumberBadge';
import { SensationLine } from './SensationLine';

export interface CompositionCardProps {
  subProduct: SubProduct;
  /** 0-based index → pastille « 01 », « 02 », « 03 ». */
  index: number;
  /** Ancre éditoriale vers la fiche INCI du sous-produit. */
  detailsHref?: string;
  /**
   * Slot media isolated (Component-Media résolu côté server). Si absent,
   * fallback `subProduct.image`.
   */
  mediaSlot?: ReactNode;
  /**
   * Slot media contextual (main/table). Si fourni, active le crossfade
   * isolated ↔ contextual au hover/tap. Si absent et que
   * `subProduct.contextualImage` est posé côté schema, le caller peut le
   * passer directement ici (le composant ne fait pas la résolution).
   */
  contextualSlot?: ReactNode;
}

export function CompositionCard({
  subProduct,
  index,
  detailsHref,
  mediaSlot,
  contextualSlot,
}: CompositionCardProps): JSX.Element {
  const sensation = formatSensation(subProduct);
  const number = formatIndex(index);
  const accentHex = resolveAccentHex(subProduct.accentColor);

  // Le slot isolated : on privilégie le slot serveur (`mediaSlot`),
  // sinon l'image issue du schéma (CMS / mock).
  const isolated = mediaSlot ?? (
    <Image
      src={subProduct.image.src}
      alt={subProduct.image.alt}
      width={subProduct.image.width}
      height={subProduct.image.height}
      ratio="1:1"
      sizes="(min-width: 1024px) 28vw, (min-width: 720px) 45vw, 90vw"
    />
  );

  // Le slot contextual provient soit du caller (Component-Media), soit
  // du `subProduct.contextualImage` (schéma). Si aucun n'est défini, le
  // crossfade n'expose pas d'interaction (cf. MediaCrossfade behavior).
  const contextual =
    contextualSlot ??
    (subProduct.contextualImage ? (
      <Image
        src={subProduct.contextualImage.src}
        alt={subProduct.contextualImage.alt}
        width={subProduct.contextualImage.width}
        height={subProduct.contextualImage.height}
        ratio="1:1"
        sizes="(min-width: 1024px) 28vw, (min-width: 720px) 45vw, 90vw"
      />
    ) : undefined);

  return (
    <article
      className="relative flex flex-col gap-4 rounded-md border border-[#C7CCC2] bg-[#FBFAF6] p-4 sm:p-5"
      data-testid={`composition-card-${subProduct.id}`}
    >
      <NumberBadge label={number} hex={accentHex} />

      <MediaCrossfade
        isolated={isolated}
        contextual={contextual}
        alt={subProduct.image.alt}
      />

      <div className="space-y-2">
        <Heading as="h3" size="sm">
          {subProduct.name}
          <span className="ms-2 align-baseline font-body text-base text-stone-500 [font-variant-numeric:tabular-nums]">
            · {subProduct.volume.toLowerCase()}
          </span>
        </Heading>

        <Text size="body" tone="secondary" prose>
          {subProduct.shortDescription}
        </Text>

        {sensation ? <SensationLine text={sensation} /> : null}

        {detailsHref ? (
          <a
            href={detailsHref}
            className="inline-flex items-center gap-1 pt-1 text-xs uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876]/40"
            data-testid={`composition-card-link-${subProduct.id}`}
          >
            Lire le détail <span aria-hidden="true">↓</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
