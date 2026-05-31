import type { ContentIdea, ContentDraft, ContentPost, ContentPostizDelivery, ContentPerformanceSnapshot } from '@/lib/content-studio/types';

export function buildContentIdea(overrides?: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'idea_test1',
    campaignId: null,
    pillar: 'rituel',
    objective: 'consideration',
    platform: 'instagram',
    format: 'post',
    prompt: 'Prompt de test pour le rituel FemiGlow',
    sourceType: 'manual',
    sourceRef: null,
    rejectionReason: null,
    status: 'idea',
    createdBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildContentDraft(overrides?: Partial<ContentDraft>): ContentDraft {
  return {
    id: 'draft_test1',
    briefId: 'brief_test1',
    platform: 'instagram',
    format: 'post',
    variantLabel: 'Sobre',
    caption: 'Découvrez le rituel FemiGlow pour une peau lumineuse.',
    hook: 'Votre rituel beauté du soir',
    cta: 'En savoir plus',
    altText: 'Rituel FemiGlow',
    hashtags: ['#femiglow', '#rituel', '#beaute'],
    rejectionReason: null,
    parentDraftId: null,
    status: 'generated',
    scoreTotal: 96,
    editedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildContentPost(overrides?: Partial<ContentPost>): ContentPost {
  return {
    id: 'post_test1',
    draftId: 'draft_test1',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    utm: {},
    approvedBy: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildContentPostizDelivery(overrides?: Partial<ContentPostizDelivery>): ContentPostizDelivery {
  return {
    id: 'delivery_test1',
    postId: 'post_test1',
    integrationId: 'integration_test1',
    postizPostId: null,
    status: 'pending',
    request: {},
    response: {},
    attemptCount: 0,
    lastError: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildContentPerformanceSnapshot(overrides?: Partial<ContentPerformanceSnapshot>): ContentPerformanceSnapshot {
  return {
    id: 'snapshot_test1',
    postId: 'post_test1',
    source: 'postiz',
    metrics: { views: 100, likes: 10, reach: 200 },
    capturedAt: new Date('2026-01-01'),
    ...overrides,
  };
}