/**
 * Server-side aggregator: turns drafts + posts + asset bindings + media
 * lookups into a flat `LibraryItem[]` ready for the client component.
 *
 * Pas de filtrage ici — c'est la couche client qui filtre/search (pour
 * que les URL params soient une vraie source de vérité côté frontend).
 *
 * Marqué pas-`server-only` à dessein : c'est une fonction pure (entrées
 * → sortie), 100% testable en vitest sans mock DB.
 */

import type {
  ContentAssetBinding,
  ContentBrief,
  ContentDraft,
  ContentIdea,
  ContentPost,
} from '@/lib/content-studio/types';
import type { Media } from '@/lib/db/types';
import type { LibraryItem, LibraryMediaKind, LibraryThumbnail } from './types';

interface AggregatorInput {
  drafts: ContentDraft[];
  posts: ContentPost[];
  briefs: ContentBrief[];
  ideas: ContentIdea[];
  bindings: ContentAssetBinding[];
  /** Media object keyed by id (only those referenced by bindings). */
  mediaById: Map<string, Media>;
  /** Optional thumb URL keyed by mediaId (smallest variant) — see
   * `thumbsByMediaId()`. */
  thumbUrlByMediaId?: Map<string, string>;
}

function pickThumbnail(
  draftId: string,
  bindingsByDraft: Map<string, ContentAssetBinding>,
  mediaById: Map<string, Media>,
  thumbUrlByMediaId?: Map<string, string>,
): LibraryThumbnail {
  const binding = bindingsByDraft.get(draftId);
  if (!binding) return { url: null, kind: null, alt: '' };
  const media = mediaById.get(binding.mediaId);
  if (!media) return { url: null, kind: null, alt: '' };
  const kind: LibraryMediaKind | null =
    media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : null;
  const thumb = thumbUrlByMediaId?.get(media.id) ?? null;
  // Fallback: originalUrl pour les vidéos ou si pas de variant pré-cuisinée.
  const url = thumb ?? media.originalUrl ?? null;
  return { url, kind, alt: media.alt ?? '' };
}

/** Builds an indexed `LibraryItem[]` sorted newest-first. */
export function buildLibraryItems(input: AggregatorInput): LibraryItem[] {
  const briefById = new Map(input.briefs.map((b) => [b.id, b]));
  const ideaById = new Map(input.ideas.map((i) => [i.id, i]));
  const draftById = new Map(input.drafts.map((d) => [d.id, d]));
  const postByDraftId = new Map<string, ContentPost>();
  for (const post of input.posts) {
    // Garde le post le plus récent par draftId (le post n'est en théorie
    // qu'unique par draft, on protège quand même).
    const existing = postByDraftId.get(post.draftId);
    if (!existing || existing.createdAt < post.createdAt) {
      postByDraftId.set(post.draftId, post);
    }
  }
  const primaryBindingByDraft = new Map<string, ContentAssetBinding>();
  for (const binding of input.bindings) {
    // MP-AR-003: the legacy single role 'primary' is now the typed visual roles.
    if (binding.role !== 'primary_image' && binding.role !== 'primary_video') continue;
    const existing = primaryBindingByDraft.get(binding.draftId);
    if (!existing || existing.createdAt < binding.createdAt) {
      primaryBindingByDraft.set(binding.draftId, binding);
    }
  }

  const items: LibraryItem[] = [];
  // Tous les drafts apparaissent (qu'ils aient un post ou pas — `needs_review`,
  // `generated`, etc. sont visibles).
  for (const draft of input.drafts) {
    const post = postByDraftId.get(draft.id) ?? null;
    const brief = briefById.get(draft.briefId);
    const idea = brief ? ideaById.get(brief.ideaId) : undefined;
    const pillar = idea?.pillar ?? 'rituel'; // fallback safe
    // Si on a un post, son status prime (il représente la version "en aval"
    // dans la state machine : approved/scheduled/published…). Sinon le draft.
    const effectiveStatus = post?.status ?? draft.status;
    const sortAt = (post?.createdAt ?? draft.createdAt).toISOString();
    items.push({
      id: post?.id ?? draft.id,
      draftId: draft.id,
      postId: post?.id ?? null,
      caption: draft.caption,
      variantLabel: draft.variantLabel,
      platform: draft.platform,
      format: draft.format,
      pillar,
      status: effectiveStatus,
      scheduledAt: post?.scheduledAt ? post.scheduledAt.toISOString() : null,
      publishedAt: post?.publishedAt ? post.publishedAt.toISOString() : null,
      sortAt,
      thumbnail: pickThumbnail(
        draft.id,
        primaryBindingByDraft,
        input.mediaById,
        input.thumbUrlByMediaId,
      ),
    });
  }

  // Pour les posts sans draft connu (cas extrême, donnée orpheline), on
  // ne les expose pas — sans draft on ne pourrait de toute façon pas
  // ouvrir `/create/[draftId]`.
  void draftById;

  items.sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0));
  return items;
}
