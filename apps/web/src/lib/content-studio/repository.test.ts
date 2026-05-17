import { describe, it, expect } from 'vitest';
import type { ContentIdea, ContentDraft, ContentPost } from './types';

function filterIdeas(
  items: ContentIdea[],
  filters?: { status?: string; pillar?: string; platform?: string; limit?: number; offset?: number },
): ContentIdea[] {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  let result = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters?.status) result = result.filter((i) => i.status === filters.status);
  if (filters?.pillar) result = result.filter((i) => i.pillar === filters.pillar);
  if (filters?.platform) result = result.filter((i) => i.platform === filters.platform);
  return result.slice(offset, offset + limit);
}

function filterDrafts(
  items: ContentDraft[],
  filters?: { status?: string; platform?: string; format?: string; limit?: number; offset?: number },
): ContentDraft[] {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  let result = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters?.status) result = result.filter((d) => d.status === filters.status);
  if (filters?.platform) result = result.filter((d) => d.platform === filters.platform);
  if (filters?.format) result = result.filter((d) => d.format === filters.format);
  return result.slice(offset, offset + limit);
}

function filterPosts(
  items: ContentPost[],
  filters?: { status?: string; limit?: number; offset?: number },
): ContentPost[] {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  let result = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters?.status) result = result.filter((p) => p.status === filters.status);
  return result.slice(offset, offset + limit);
}

function makeIdea(overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: `idea_${Math.random().toString(36).slice(2, 8)}`,
    campaignId: null, pillar: 'rituel', objective: 'consideration',
    platform: 'instagram', format: 'post', prompt: 'Test', sourceType: null,
    sourceRef: null, rejectionReason: null, status: 'idea', createdBy: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: `draft_${Math.random().toString(36).slice(2, 8)}`,
    briefId: 'brief_1', platform: 'instagram', format: 'post', variantLabel: 'Sobre',
    caption: 'Test', hook: null, cta: null, altText: null, hashtags: [],
    rejectionReason: null, parentDraftId: null, status: 'generated', scoreTotal: null,
    editedBy: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function makePost(overrides: Partial<ContentPost> = {}): ContentPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 8)}`,
    draftId: 'draft_1', status: 'approved', scheduledAt: null, publishedAt: null,
    utm: {}, approvedBy: null, cancelledBy: null, cancelledAt: null, cancelReason: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

describe('Repository filter logic (memory store)', () => {
  describe('filterIdeas', () => {
    it('filtre par status', () => {
      const items = [makeIdea({ status: 'idea' }), makeIdea({ status: 'archived' }), makeIdea({ status: 'idea' })];
      const result = filterIdeas(items, { status: 'archived' });
      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('archived');
    });

    it('filtre par pillar', () => {
      const items = [makeIdea({ pillar: 'rituel' }), makeIdea({ pillar: 'produit' })];
      const result = filterIdeas(items, { pillar: 'produit' });
      expect(result).toHaveLength(1);
      expect(result[0]!.pillar).toBe('produit');
    });

    it('applique limit et offset', () => {
      const items = Array.from({ length: 10 }, (_, i) => makeIdea({ status: 'idea', createdAt: new Date(1000 - i) }));
      const page1 = filterIdeas(items, { limit: 3, offset: 0 });
      const page2 = filterIdeas(items, { limit: 3, offset: 3 });
      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
      expect(page1[0]!.id).not.toBe(page2[0]!.id);
    });

    it('sans filtre retourne tout (max 100)', () => {
      const items = [makeIdea(), makeIdea()];
      const result = filterIdeas(items);
      expect(result).toHaveLength(2);
    });
  });

  describe('filterDrafts', () => {
    it('filtre par platform', () => {
      const items = [makeDraft({ platform: 'instagram' }), makeDraft({ platform: 'facebook' })];
      const result = filterDrafts(items, { platform: 'facebook' });
      expect(result).toHaveLength(1);
      expect(result[0]!.platform).toBe('facebook');
    });

    it('filtre par status', () => {
      const items = [makeDraft({ status: 'generated' }), makeDraft({ status: 'approved' })];
      const result = filterDrafts(items, { status: 'approved' });
      expect(result).toHaveLength(1);
    });
  });

  describe('filterPosts', () => {
    it('filtre par status', () => {
      const items = [makePost({ status: 'approved' }), makePost({ status: 'scheduled' })];
      const result = filterPosts(items, { status: 'scheduled' });
      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('scheduled');
    });

    it('applique limit', () => {
      const items = Array.from({ length: 5 }, () => makePost());
      const result = filterPosts(items, { limit: 2 });
      expect(result).toHaveLength(2);
    });
  });
});