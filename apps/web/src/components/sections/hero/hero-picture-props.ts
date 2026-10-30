/**
 * Galerie hero — attributs d'image pour l'art direction (module partagé,
 * serveur ET client : aucun hook, aucun `'use client'`).
 *
 * Utilisé par :
 *  - `HeroPicture` (rendu `<picture>`) ;
 *  - `HeroProduitBound` (preload serveur de l'image principale).
 *
 * Les deux appellent `getImageProps` avec EXACTEMENT les mêmes entrées
 * (`sizes` constants ci-dessous) : le `srcset` préchargé est celui que le
 * navigateur choisit ensuite, et les arbres mobile et desktop de la galerie
 * produisent un `<picture>` identique (une seule requête par image).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5
 */
import * as React from 'react';
import { getImageProps, type ImageProps } from 'next/image';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

/** Point de bascule de la galerie (Tailwind `lg`). */
export const HERO_PICTURE_MOBILE_MEDIA = '(max-width: 1023px)';
export const HERO_PICTURE_DESKTOP_MEDIA = '(min-width: 1024px)';

/** `sizes` de la source mobile (pleine largeur sous `lg`). */
export const HERO_PICTURE_MOBILE_SIZES = '100vw';
/** `sizes` de l'image desktop (colonne de gauche ≈ 40vw dès `lg`). */
export const HERO_PICTURE_DESKTOP_SIZES = '(min-width: 1024px) 40vw, 100vw';

export type HeroImgProps = ReturnType<typeof getImageProps>['props'];

export interface HeroPictureSources {
  /** Attributs de `<img>` (image desktop 4:5, repli des navigateurs). */
  desktop: HeroImgProps;
  /** Attributs de `<source media="(max-width:1023px)">` (image mobile 3:4). */
  mobile: HeroImgProps;
}

/**
 * Attributs des deux sources d'une image art-dirigée. `null` si l'image n'a
 * pas de version mobile (rendu `next/image` classique).
 *
 * Flou de chargement : seulement pour l'image LCP (`priority`, index 0).
 * Avec `getImageProps`, le flou est un `background-image` posé sur l'`<img>`
 * qui n'est jamais retiré (pas de `onLoad` comme dans `next/image`) : sur les
 * autres slides (lazy) il ne ferait qu'alourdir le HTML d'environ 1 Ko par
 * image. Le flou est celui de l'image desktop, y compris quand le navigateur
 * affiche la source mobile (un `<source>` ne porte pas de placeholder ; même
 * sujet, recadrage voisin) — d'où l'absence de flou mobile dans la galerie.
 */
export function heroPictureSources(
  image: HeroGalleryImage,
  { priority = false }: { priority?: boolean } = {},
): HeroPictureSources | null {
  if (!image.mobile) return null;
  const common: Pick<ImageProps, 'alt' | 'fill' | 'priority'> = {
    alt: image.alt,
    fill: true,
    priority,
  };
  const desktop = getImageProps({
    ...common,
    src: image.src,
    sizes: HERO_PICTURE_DESKTOP_SIZES,
    ...(priority && image.blurDataURL
      ? { placeholder: 'blur' as const, blurDataURL: image.blurDataURL }
      : {}),
  }).props;
  const mobile = getImageProps({
    ...common,
    src: image.mobile.src,
    sizes: HERO_PICTURE_MOBILE_SIZES,
  }).props;
  return { desktop, mobile };
}

/** Attributs d'un `<link rel="preload" as="image">` (cf. `HeroProduitBound`). */
export interface HeroPreloadLink {
  /** Repli pour les navigateurs sans `imagesrcset` (candidat de taille moyenne). */
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
  media: string;
}

/** Largeur visée pour le `href` de repli (≈ largeur affichée × DPR 2). */
const PRELOAD_FALLBACK_WIDTH = { mobile: 828, desktop: 1200 } as const;

/**
 * Plus petit candidat du `srcset` d'au moins `minWidth` pixels (sinon le
 * plus grand) ; `fallback` si le `srcset` est vide ou illisible. Évite que
 * le `href` de repli soit le candidat 3840w de `getImageProps`.
 */
export function pickSrcSetCandidate(
  srcSet: string | undefined,
  minWidth: number,
  fallback: string,
): string {
  if (!srcSet) return fallback;
  const candidates = srcSet
    .split(', ')
    .map((entry) => {
      const match = /^(\S+)\s+(\d+)w$/.exec(entry.trim());
      return match ? { url: match[1]!, width: Number(match[2]) } : null;
    })
    .filter((c): c is { url: string; width: number } => c !== null)
    .sort((a, b) => a.width - b.width);
  if (candidates.length === 0) return fallback;
  return (candidates.find((c) => c.width >= minWidth) ?? candidates[candidates.length - 1]!).url;
}

/**
 * Preloads de l'image principale art-dirigée, un par media query (source
 * mobile sous `lg`, image desktop au-delà) : chaque appareil ne précharge
 * QUE l'image qu'il affichera. `[]` si l'image n'a pas de version mobile —
 * `next/image` (`priority`) émet alors déjà son propre preload.
 *
 * Rendus en `<link>` JSX et non via `ReactDOM.preload` : le React canary de
 * Next 14.2 filtre les options de `preload()` et PERD `media` (les deux
 * images partiraient sur tous les appareils), alors qu'un `<link>` rendu
 * est hissé dans `<head>` avec tous ses attributs.
 */
export function heroPicturePreloads(image: HeroGalleryImage | undefined): HeroPreloadLink[] {
  if (!image) return [];
  const sources = heroPictureSources(image, { priority: true });
  if (!sources) return [];
  const link = (props: HeroImgProps, media: string, targetWidth: number): HeroPreloadLink => ({
    href: pickSrcSetCandidate(props.srcSet, targetWidth, props.src),
    ...(props.srcSet ? { imageSrcSet: props.srcSet } : {}),
    ...(props.sizes ? { imageSizes: props.sizes } : {}),
    media,
  });
  return [
    link(sources.mobile, HERO_PICTURE_MOBILE_MEDIA, PRELOAD_FALLBACK_WIDTH.mobile),
    link(sources.desktop, HERO_PICTURE_DESKTOP_MEDIA, PRELOAD_FALLBACK_WIDTH.desktop),
  ];
}

export type HeroFetchPriority = 'high' | 'low' | 'auto';

/**
 * `fetchPriority` en camelCase n'est reconnu que par React 19 / canary (celui
 * qu'embarque Next pour l'App Router) ; React 18 stable attend l'attribut en
 * minuscules. Même détection que `next/image` (présence de `React.use`).
 */
export function fetchPriorityProps(
  value: HeroFetchPriority | undefined,
): Record<string, HeroFetchPriority> {
  if (!value) return {};
  return typeof (React as { use?: unknown }).use === 'function'
    ? { fetchPriority: value }
    : { fetchpriority: value };
}
