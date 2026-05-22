/**
 * Shared shape between the server page and the client `LibraryClient`.
 *
 * Le serveur pré-aggrège ce qui est nécessaire pour afficher une vignette de
 * post dans le grid : caption, format, plateforme, statut, et — si un asset
 * primaire existe — la miniature média (image src OU poster vidéo).
 *
 * Aucune logique métier ici, uniquement des types — ils sont safe à
 * importer côté serveur ET côté client.
 */

import type {
  ContentFormat,
  ContentPillar,
  ContentPlatform,
  ContentStatus,
} from '@/lib/content-studio/types';

export type LibraryMediaKind = 'image' | 'video';

export interface LibraryThumbnail {
  /** URL de l'image OU poster vidéo. Peut être null si pas de média. */
  url: string | null;
  /** Si video, on affiche un overlay "play". */
  kind: LibraryMediaKind | null;
  /** Alt utilisé pour la recherche + l'a11y. */
  alt: string;
}

export interface LibraryItem {
  /** Identifiant stable d'affichage — id du post si publié/programmé,
   * sinon id du draft. La navigation pointe vers le draftId. */
  id: string;
  /** Identifiant draft pour l'édition (`/create/[draftId]`). */
  draftId: string;
  /** Identifiant post (si approuvé / programmé / publié). Sert au bulk. */
  postId: string | null;
  caption: string;
  variantLabel: string;
  platform: ContentPlatform;
  format: ContentFormat;
  pillar: ContentPillar;
  status: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  /** Date de tri (post.createdAt sinon draft.createdAt). ISO string. */
  sortAt: string;
  thumbnail: LibraryThumbnail;
}

export interface LibraryFilterState {
  statuses: ContentStatus[];
  platform: ContentPlatform | 'all';
  pillar: ContentPillar | 'all';
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
}

export const EMPTY_FILTERS: LibraryFilterState = {
  statuses: [],
  platform: 'all',
  pillar: 'all',
  dateFrom: null,
  dateTo: null,
  search: '',
};
