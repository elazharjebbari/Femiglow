import { describe, it, expect } from 'vitest';
import {
  buildFilteredItems,
  buildMonthDays,
  buildWeekDays,
  formatDateKey,
  groupItemsByDay,
  startOfWeek,
} from './calendar-helpers';
import type {
  ContentDraft,
  ContentPillar,
  ContentPost,
  ContentPostizDelivery,
} from '@/lib/content-studio/types';
import type { CalendarMediaEntry } from './types';

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    id: overrides.id ?? 'draft_a',
    briefId: 'brief_x',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'A',
    caption: 'caption',
    hook: 'hook',
    cta: 'cta',
    altText: null,
    hashtags: [],
    rejectionReason: null,
    parentDraftId: null,
    status: 'approved',
    scoreTotal: 90,
    editedBy: null,
    createdAt: new Date('2026-05-01T08:00:00Z'),
    updatedAt: new Date('2026-05-01T08:00:00Z'),
    ...overrides,
  };
}

function makePost(overrides: Partial<ContentPost> = {}): ContentPost {
  return {
    id: overrides.id ?? 'post_a',
    draftId: overrides.draftId ?? 'draft_a',
    status: 'approved',
    scheduledAt: new Date('2026-05-12T10:00:00Z'),
    publishedAt: null,
    utm: {},
    approvedBy: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-05-01T08:00:00Z'),
    updatedAt: new Date('2026-05-01T08:00:00Z'),
    ...overrides,
  };
}

describe('calendar-helpers', () => {
  it('groupItemsByDay regroupe correctement par jour local', () => {
    const draftA = makeDraft({ id: 'draft_a' });
    const draftB = makeDraft({ id: 'draft_b' });
    const postA1 = makePost({
      id: 'p1',
      draftId: 'draft_a',
      scheduledAt: new Date(2026, 4, 12, 9, 0),
    });
    const postA2 = makePost({
      id: 'p2',
      draftId: 'draft_a',
      scheduledAt: new Date(2026, 4, 12, 15, 0),
    });
    const postB = makePost({
      id: 'p3',
      draftId: 'draft_b',
      scheduledAt: new Date(2026, 4, 13, 10, 0),
    });

    const items = buildFilteredItems({
      posts: [postA1, postA2, postB],
      drafts: [draftA, draftB],
      deliveries: [],
      mediaByDraftId: {},
      pillarByDraftId: {},
      platformFilter: 'all',
      statusFilter: 'all',
      pillarFilter: 'all',
    });
    const grouped = groupItemsByDay(items);
    expect(grouped.get(formatDateKey(new Date(2026, 4, 12)))).toHaveLength(2);
    expect(grouped.get(formatDateKey(new Date(2026, 4, 13)))).toHaveLength(1);
  });

  it('buildFilteredItems combine platform + status + pillar', () => {
    const draftA = makeDraft({ id: 'd_ig', platform: 'instagram' });
    const draftB = makeDraft({ id: 'd_fb', platform: 'facebook' });
    const draftC = makeDraft({ id: 'd_ig_other', platform: 'instagram' });
    const postA = makePost({ id: 'p_a', draftId: 'd_ig', status: 'approved' });
    const postB = makePost({ id: 'p_b', draftId: 'd_fb', status: 'scheduled' });
    const postC = makePost({ id: 'p_c', draftId: 'd_ig_other', status: 'scheduled' });
    const pillarByDraftId: Record<string, ContentPillar | undefined> = {
      d_ig: 'rituel',
      d_fb: 'rituel',
      d_ig_other: 'produit',
    };

    // Plateforme = instagram + statut = scheduled → seul postC.
    const items = buildFilteredItems({
      posts: [postA, postB, postC],
      drafts: [draftA, draftB, draftC],
      deliveries: [],
      mediaByDraftId: {},
      pillarByDraftId,
      platformFilter: 'instagram',
      statusFilter: 'scheduled',
      pillarFilter: 'all',
    });
    expect(items.map((i) => i.post.id)).toEqual(['p_c']);

    // Maintenant pilier = rituel → instagram + scheduled + rituel = aucun.
    const items2 = buildFilteredItems({
      posts: [postA, postB, postC],
      drafts: [draftA, draftB, draftC],
      deliveries: [],
      mediaByDraftId: {},
      pillarByDraftId,
      platformFilter: 'instagram',
      statusFilter: 'scheduled',
      pillarFilter: 'rituel',
    });
    expect(items2).toHaveLength(0);
  });

  it('buildFilteredItems trie par scheduledAt croissant', () => {
    const draft = makeDraft();
    const postLate = makePost({ id: 'late', scheduledAt: new Date(2026, 4, 20, 10, 0) });
    const postEarly = makePost({ id: 'early', scheduledAt: new Date(2026, 4, 10, 10, 0) });
    const items = buildFilteredItems({
      posts: [postLate, postEarly],
      drafts: [draft],
      deliveries: [],
      mediaByDraftId: {},
      pillarByDraftId: {},
      platformFilter: 'all',
      statusFilter: 'all',
      pillarFilter: 'all',
    });
    expect(items.map((i) => i.post.id)).toEqual(['early', 'late']);
  });

  it('buildFilteredItems attache média + pilier aux items', () => {
    const draft = makeDraft({ id: 'dm' });
    const post = makePost({ draftId: 'dm' });
    const media: CalendarMediaEntry = { mediaId: 'm1', previewUrl: 'http://x/p.jpg', alt: 'hello' };
    const items = buildFilteredItems({
      posts: [post],
      drafts: [draft],
      deliveries: [],
      mediaByDraftId: { dm: media },
      pillarByDraftId: { dm: 'produit' },
      platformFilter: 'all',
      statusFilter: 'all',
      pillarFilter: 'all',
    });
    expect(items[0]!.media).toEqual(media);
    expect(items[0]!.pillar).toBe('produit');
  });

  it('startOfWeek est un lundi (FR)', () => {
    const sunday = new Date(2026, 4, 17); // dimanche
    const monday = startOfWeek(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(11);
  });

  it('buildWeekDays renvoie 7 jours consécutifs', () => {
    const days = buildWeekDays(startOfWeek(new Date(2026, 4, 12)));
    expect(days).toHaveLength(7);
    expect(days[6]!.getDate() - days[0]!.getDate()).toBe(6);
  });

  it('buildMonthDays renvoie au moins 35 cellules paddées', () => {
    const days = buildMonthDays(new Date(2026, 4, 1));
    expect(days.length).toBeGreaterThanOrEqual(35);
  });

  it('latestDelivery est attaché au bon post', () => {
    const draft = makeDraft({ id: 'd1' });
    const post = makePost({ id: 'p_match', draftId: 'd1' });
    const delivery: ContentPostizDelivery = {
      id: 'del_1',
      postId: 'p_match',
      integrationId: 'int_1',
      postizPostId: null,
      status: 'sent',
      request: {},
      response: {},
      attemptCount: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const items = buildFilteredItems({
      posts: [post],
      drafts: [draft],
      deliveries: [delivery],
      mediaByDraftId: {},
      pillarByDraftId: {},
      platformFilter: 'all',
      statusFilter: 'all',
      pillarFilter: 'all',
    });
    expect(items[0]!.latestDelivery).toBe(delivery);
  });
});
