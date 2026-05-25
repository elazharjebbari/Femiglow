/**
 * Caps média par plateforme — règles officielles d'API publishing.
 *
 * Référence : `docs/live-systems-fix-2026-05/07-system-publishing.md` § S3
 *
 * Sources :
 *  - Instagram : https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *  - TikTok : https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *  - Facebook : https://developers.facebook.com/docs/pages-api/posts
 *  - Twitter / X : https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 *  - LinkedIn : https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management
 *  - Pinterest : https://developers.pinterest.com/docs/api/pins
 */

export type Platform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'pinterest';

export interface MediaCaps {
  /** Nombre max d'images dans un post / carrousel. */
  maxImages: number;
  /** Nombre max de vidéos. */
  maxVideos: number;
  /** Plateforme accepte des carrousels (multi-media dans un seul post). */
  acceptsCarousel: boolean;
  /** Plateforme accepte un MIX images + vidéos dans le même post. */
  acceptsMixed: boolean;
  /** Durée max vidéo en secondes (0 = pas de vidéo supportée). */
  maxVideoDurationSec: number;
  /** Taille max fichier en MB (image OR vidéo). */
  maxFileSizeMb: number;
  /** Formats acceptés (mime types). */
  acceptedMimeTypes: string[];
}

export const PLATFORM_CAPS: Record<Platform, MediaCaps> = {
  instagram: {
    maxImages: 10,
    maxVideos: 1,
    acceptsCarousel: true,
    acceptsMixed: true,
    maxVideoDurationSec: 90, // Reels
    maxFileSizeMb: 100,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
    ],
  },
  facebook: {
    maxImages: 10,
    maxVideos: 1,
    acceptsCarousel: true,
    acceptsMixed: false,
    maxVideoDurationSec: 240, // 4 min
    maxFileSizeMb: 1024,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/quicktime',
    ],
  },
  tiktok: {
    maxImages: 35, // Photo Mode
    maxVideos: 1,
    acceptsCarousel: true, // Photo Mode = carousel
    acceptsMixed: false, // soit photos soit vidéo
    maxVideoDurationSec: 600, // 10 min
    maxFileSizeMb: 512,
    acceptedMimeTypes: ['image/jpeg', 'image/webp', 'video/mp4'],
  },
  twitter: {
    maxImages: 4,
    maxVideos: 1,
    // Twitter accepte 4 images dans un même tweet (grid layout) — pas
    // un carrousel swipeable mais multi-media dans un post unique.
    // On considère cela `acceptsCarousel=true` selon notre convention
    // (multi-media autorisé dans un seul post publication).
    acceptsCarousel: true,
    acceptsMixed: false,
    maxVideoDurationSec: 140,
    maxFileSizeMb: 512,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
    ],
  },
  linkedin: {
    maxImages: 9,
    maxVideos: 1,
    acceptsCarousel: true,
    acceptsMixed: false,
    maxVideoDurationSec: 600,
    maxFileSizeMb: 200,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'video/mp4',
    ],
  },
  pinterest: {
    maxImages: 5,
    maxVideos: 1,
    acceptsCarousel: false, // un pin = un média
    acceptsMixed: false,
    maxVideoDurationSec: 300,
    maxFileSizeMb: 1024,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'video/mp4',
    ],
  },
};

export interface MediaItem {
  id: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
  fileSizeBytes?: number;
  alt?: string | null;
}

export interface ApplyCapsResult {
  /** Items qui passent les caps. */
  accepted: MediaItem[];
  /** Items rejetés avec raison (pour log + admin warning). */
  rejected: Array<{ item: MediaItem; reason: string }>;
}

/**
 * Applique les caps plateforme sur une liste de media items.
 *
 * Règles d'application :
 *  1. Filtre les items qui violent mime/size/duration → rejetés
 *  2. Sépare images / vidéos
 *  3. Tronque selon `maxImages` et `maxVideos`
 *  4. Si `acceptsMixed=false` ET les deux présents → choisit videos
 *     (priorité vidéo sur image quand exclusif — convention TikTok)
 *  5. Si pas de `acceptsCarousel` ET > 1 image → garde la première
 *
 * Fonction PURE — pas d'I/O, testable.
 */
export function applyPlatformCaps(
  items: MediaItem[],
  platform: Platform,
): ApplyCapsResult {
  const caps = PLATFORM_CAPS[platform];
  const rejected: ApplyCapsResult['rejected'] = [];
  const validated: MediaItem[] = [];

  // Étape 1 : filtre mime / size / duration
  for (const item of items) {
    if (!caps.acceptedMimeTypes.includes(item.mimeType)) {
      rejected.push({ item, reason: `Mime type non supporté: ${item.mimeType}` });
      continue;
    }
    if (item.fileSizeBytes && item.fileSizeBytes > caps.maxFileSizeMb * 1024 * 1024) {
      rejected.push({ item, reason: `Fichier > ${caps.maxFileSizeMb}MB` });
      continue;
    }
    if (
      item.mimeType.startsWith('video/') &&
      item.durationSec &&
      item.durationSec > caps.maxVideoDurationSec
    ) {
      rejected.push({
        item,
        reason: `Vidéo > ${caps.maxVideoDurationSec}s`,
      });
      continue;
    }
    validated.push(item);
  }

  // Étape 2 : sépare et plafonne
  const images = validated.filter((i) => i.mimeType.startsWith('image/'));
  const videos = validated.filter((i) => i.mimeType.startsWith('video/'));

  let accepted: MediaItem[] = [];

  if (videos.length > 0 && images.length > 0 && !caps.acceptsMixed) {
    // Mode exclusif — priorité vidéo (convention plateforme courte)
    accepted = videos.slice(0, caps.maxVideos);
    for (const img of images) {
      rejected.push({ item: img, reason: 'Plateforme refuse mix images+vidéo' });
    }
  } else {
    const acceptedImages = images.slice(0, caps.maxImages);
    const acceptedVideos = videos.slice(0, caps.maxVideos);

    // Si carousel non supporté ET > 1 image → garde la 1ère
    if (!caps.acceptsCarousel && acceptedImages.length > 1) {
      for (const img of acceptedImages.slice(1)) {
        rejected.push({ item: img, reason: 'Carrousel non supporté' });
      }
      accepted = [acceptedImages[0]!, ...acceptedVideos];
    } else {
      accepted = [...acceptedImages, ...acceptedVideos];
    }

    // Items au-delà des caps
    if (images.length > caps.maxImages) {
      for (const img of images.slice(caps.maxImages)) {
        rejected.push({ item: img, reason: `Plus de ${caps.maxImages} images` });
      }
    }
    if (videos.length > caps.maxVideos) {
      for (const vid of videos.slice(caps.maxVideos)) {
        rejected.push({ item: vid, reason: `Plus de ${caps.maxVideos} vidéos` });
      }
    }
  }

  return { accepted, rejected };
}
