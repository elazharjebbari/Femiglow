/**
 * `<ComponentMedia>` — composant RSC qui affiche le media actif d'un slot,
 * ou bascule vers le SVG fallback si pas de binding actif.
 *
 *   <ComponentMedia componentKey="home-hero" slot="primary" />
 *
 * Lazy loading et fetch priority sont déterminés par :
 *  1. `binding.loadingStrategy` (admin override),
 *  2. sinon `siteComponent.defaultLoadingStrategy`,
 *  3. fallback : 'viewport'.
 */
import 'server-only';
import type { CSSProperties } from 'react';
import { resolveComponentSlot } from './resolver';
import { resolvePresentation } from './presentation-cascade';
import { MediaImage } from '@/lib/media/components/MediaImage';
import { MediaVideo } from '@/lib/media/components/MediaVideo';
import { MediaPlaceholder } from '@/lib/media/components/MediaPlaceholder';
import type { MediaContextHint } from '@/lib/media/resolve/config';

interface ComponentMediaProps {
  componentKey: string;
  slot: string;
  /** Surcharge le contexte hint (par défaut déduit du component category). */
  context?: MediaContextHint;
  className?: string;
  style?: CSSProperties;
  sizes?: string;
  /** Surcharge l'alt si nécessaire (très rare). */
  altOverride?: string;
  /** Route pour usage tracking. */
  route?: string;
  /** Si true, force priority (au-dessus du défaut). */
  forcePriority?: boolean;
}

function deriveContext(category: string | null | undefined): MediaContextHint {
  if (category === 'hero') return 'hero';
  if (category === 'media-block') return 'hero';
  return 'inline';
}

export async function ComponentMedia({
  componentKey,
  slot,
  context,
  className,
  style,
  sizes,
  altOverride,
  route,
  forcePriority,
}: ComponentMediaProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);

  // Composant introuvable → placeholder muet (silent dev fallback).
  if (!resolved) {
    return (
      <MediaPlaceholder
        label={`composant introuvable: ${componentKey}`}
        className={className}
        style={style}
      />
    );
  }

  const ctx = context ?? deriveContext(resolved.component.category);
  const priority =
    forcePriority ??
    (resolved.fetchPriority === 'high' || resolved.loadingStrategy === 'eager');

  // Pas de binding actif ou pas de media → SVG fallback (path).
  if (!resolved.binding || !resolved.binding.isActive || !resolved.media) {
    if (resolved.fallbackSvg) {
      // SVG inline déjà optimisé : on contourne next/image volontairement
      // (pas de pipeline raster, pas de variants AVIF/WebP).
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved.fallbackSvg}
          alt={altOverride ?? resolved.alt}
          loading={resolved.loadingStrategy === 'eager' ? 'eager' : 'lazy'}
          decoding="async"
          className={className}
          style={style}
        />
      );
    }
    return (
      <MediaPlaceholder
        label={`pas de média actif pour ${componentKey}/${slot}`}
        className={className}
        style={style}
      />
    );
  }

  // Branche image — cascade : binding ▸ media.overrides ▸ slot ▸ défaut codé.
  // Logique extraite dans `presentation-cascade.ts` pour rester pure et
  // testable indépendamment du RSC.
  if (resolved.media.kind === 'image') {
    const presentation = resolvePresentation({
      binding: resolved.binding,
      overrides: resolved.media.overrides,
      slot: resolved.slot,
    });

    return (
      <MediaImage
        id={resolved.media.id}
        context={ctx}
        sizes={sizes}
        priority={priority}
        loading={resolved.loadingStrategy}
        fallback={resolved.fallbackSvg ?? undefined}
        className={className}
        style={style}
        alt={altOverride ?? resolved.alt}
        route={route}
        objectFit={presentation.objectFit}
        objectPosition={presentation.objectPosition}
        focalX={presentation.focalX}
        focalY={presentation.focalY}
        slotAspectRatio={presentation.slotAspectRatio}
        backgroundFill={presentation.backgroundFill}
      />
    );
  }

  // Branche vidéo
  if (resolved.media.kind === 'video') {
    return (
      <MediaVideo
        id={resolved.media.id}
        lazy={resolved.loadingStrategy}
        className={className}
        style={style}
        ariaLabel={altOverride ?? resolved.alt}
        fallback={resolved.fallbackSvg ?? undefined}
        route={route}
      />
    );
  }

  return (
    <MediaPlaceholder
      label={`type non supporté: ${resolved.media.kind}`}
      className={className}
      style={style}
    />
  );
}
