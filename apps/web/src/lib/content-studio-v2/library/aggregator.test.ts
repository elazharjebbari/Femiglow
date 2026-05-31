import { describe, it, expect } from 'vitest';
import { buildLibraryItems } from './aggregator';
import type {
  ContentAssetBinding,
  ContentBrief,
  ContentDraft,
  ContentIdea,
  ContentPost,
} from '@/lib/content-studio/types';
import type { Media } from '@/lib/db/types';

function makeIdea(id: string, overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id,
    campaignId: null,
    pillar: 'rituel',
    objective: 'reassurance',
    platform: 'instagram',
    format: 'post',
    prompt: 'p',
    sourceType: null,
    sourceRef: null,
    rejectionReason: null,
    status: 'idea',
    createdBy: null,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-01T10:00:00.000Z'),
    ...overrides,
  };
}
function makeBrief(id: string, ideaId: string): ContentBrief {
  return {
    id,
    ideaId,
    angle: 'a',
    proof: null,
    cta: 'cta',
    mediaDirection: null,
    constraints: {},
    version: 1,
    createdBy: null,
    createdAt: new Date('2026-05-01T11:00:00.000Z'),
  };
}
function makeDraft(id: string, briefId: string, overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id,
    briefId,
    platform: 'instagram',
    format: 'post',
    variantLabel: 'A',
    caption: 'caption',
    hook: null,
    cta: null,
    altText: null,
    hashtags: [],
    rejectionReason: null,
    parentDraftId: null,
    status: 'needs_review',
    scoreTotal: null,
    editedBy: null,
    createdAt: new Date('2026-05-02T10:00:00.000Z'),
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
    ...overrides,
  };
}
function makePost(id: string, draftId: string, overrides: Partial<ContentPost> = {}): ContentPost {
  return {
    id,
    draftId,
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    utm: {},
    approvedBy: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    updatedAt: new Date('2026-05-03T10:00:00.000Z'),
    ...overrides,
  };
}
function makeBinding(draftId: string, mediaId: string): ContentAssetBinding {
  return {
    id: `cab_${draftId}`,
    draftId,
    mediaId,
    role: 'primary',
    crop: {},
    createdAt: new Date('2026-05-02T11:00:00.000Z'),
  };
}
function makeMedia(id: string, kind: 'image' | 'video' = 'image'): Media {
  return {
    id,
    kind,
    source: 'upload',
    slug: `slug-${id}`,
    originalUrl: `/media/${id}/original.jpg`,
    originalFilename: null,
    originalSizeBytes: null,
    originalMime: null,
    originalWidth: null,
    originalHeight: null,
    originalDurationMs: null,
    phash: null,
    blurhash: null,
    palette: [],
    alt: `alt-${id}`,
    caption: null,
    credit: null,
    status: 'ready',
    failureReason: null,
    qualityProfile: 'inline',
    loadingStrategy: 'viewport',
    isHero: false,
    overrides: {},
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('library/aggregator buildLibraryItems', () => {
  it('produces one LibraryItem per draft, sorted newest-first', () => {
    const ideaA = makeIdea('ci_a', { pillar: 'rituel' });
    const ideaB = makeIdea('ci_b', { pillar: 'produit' });
    const briefA = makeBrief('cb_a', 'ci_a');
    const briefB = makeBrief('cb_b', 'ci_b');
    const draftOld = makeDraft('cd_old', 'cb_a', {
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
    });
    const draftNew = makeDraft('cd_new', 'cb_b', {
      createdAt: new Date('2026-05-10T10:00:00.000Z'),
    });
    const items = buildLibraryItems({
      drafts: [draftOld, draftNew],
      posts: [],
      briefs: [briefA, briefB],
      ideas: [ideaA, ideaB],
      bindings: [],
      mediaById: new Map(),
    });
    expect(items.map((i) => i.draftId)).toEqual(['cd_new', 'cd_old']);
    expect(items[0]?.pillar).toBe('produit');
    expect(items[1]?.pillar).toBe('rituel');
  });

  it('uses the post status when a post exists (state machine downstream)', () => {
    const idea = makeIdea('ci_a');
    const brief = makeBrief('cb_a', 'ci_a');
    const draft = makeDraft('cd_1', 'cb_a', { status: 'needs_review' });
    const post = makePost('cp_1', 'cd_1', { status: 'scheduled' });
    const items = buildLibraryItems({
      drafts: [draft],
      posts: [post],
      briefs: [brief],
      ideas: [idea],
      bindings: [],
      mediaById: new Map(),
    });
    expect(items[0]?.status).toBe('scheduled');
    expect(items[0]?.postId).toBe('cp_1');
  });

  it('picks the primary media binding for the thumbnail (image)', () => {
    const idea = makeIdea('ci_a');
    const brief = makeBrief('cb_a', 'ci_a');
    const draft = makeDraft('cd_1', 'cb_a');
    const binding = makeBinding('cd_1', 'me_1');
    const media = makeMedia('me_1', 'image');
    const items = buildLibraryItems({
      drafts: [draft],
      posts: [],
      briefs: [brief],
      ideas: [idea],
      bindings: [binding],
      mediaById: new Map([['me_1', media]]),
      thumbUrlByMediaId: new Map([['me_1', '/media/me_1/thumb-320.webp']]),
    });
    expect(items[0]?.thumbnail.kind).toBe('image');
    expect(items[0]?.thumbnail.url).toBe('/media/me_1/thumb-320.webp');
    expect(items[0]?.thumbnail.alt).toBe('alt-me_1');
  });

  it('falls back to originalUrl when no thumb variant is provided', () => {
    const idea = makeIdea('ci_a');
    const brief = makeBrief('cb_a', 'ci_a');
    const draft = makeDraft('cd_1', 'cb_a');
    const binding = makeBinding('cd_1', 'me_v');
    const media = makeMedia('me_v', 'video');
    const items = buildLibraryItems({
      drafts: [draft],
      posts: [],
      briefs: [brief],
      ideas: [idea],
      bindings: [binding],
      mediaById: new Map([['me_v', media]]),
    });
    expect(items[0]?.thumbnail.kind).toBe('video');
    expect(items[0]?.thumbnail.url).toBe('/media/me_v/original.jpg');
  });

  it('emits empty thumbnail when no binding exists', () => {
    const idea = makeIdea('ci_a');
    const brief = makeBrief('cb_a', 'ci_a');
    const draft = makeDraft('cd_1', 'cb_a');
    const items = buildLibraryItems({
      drafts: [draft],
      posts: [],
      briefs: [brief],
      ideas: [idea],
      bindings: [],
      mediaById: new Map(),
    });
    expect(items[0]?.thumbnail).toEqual({ url: null, kind: null, alt: '' });
  });
});
