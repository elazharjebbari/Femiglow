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

export function buildStudioMediaItem(overrides?: Partial<{
  id: string; mediaId: string; kind: string; status: string;
  previewUrl: string | null; thumbUrl: string | null; originalUrl: string | null;
  alt: string; width: number; height: number;
}>): Record<string, unknown> {
  return {
    id: 'media_test1',
    mediaId: 'media_raw_test1',
    kind: 'image',
    status: 'ready',
    previewUrl: '/media-files/test/preview.webp',
    thumbUrl: '/media-files/test/thumb.webp',
    originalUrl: '/media-files/test/original.png',
    alt: 'Test image FemiGlow',
    width: 1024,
    height: 1536,
    ...overrides,
  };
}

export function buildLibraryItem(overrides?: Partial<{
  id: string; draftId: string; postId: string | null; status: string;
  caption: string; platform: string; format: string; pillar: string;
  thumbnail: string | null; createdAt: string;
}>): Record<string, unknown> {
  return {
    id: 'lib_test1',
    draftId: 'draft_test1',
    postId: null,
    status: 'generated',
    caption: 'Test caption FemiGlow',
    platform: 'instagram',
    format: 'post',
    pillar: 'rituel',
    thumbnail: '/media-files/test/thumb.webp',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildPublishJobRow(overrides?: Partial<{
  id: string; postId: string; status: string; scheduledAt: string | null;
  platform: string; format: string; provider: string;
  attemptCount: number; lastError: string | null;
  createdAt: string; updatedAt: string;
}>): Record<string, unknown> {
  return {
    id: 'job_test1',
    postId: 'post_test1',
    status: 'queued',
    scheduledAt: null,
    platform: 'instagram',
    format: 'post',
    provider: 'postiz',
    attemptCount: 0,
    lastError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildOpenAIChatResponse(content: string): Record<string, unknown> {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1700000000,
    model: 'gpt-4o-mini',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 200, total_tokens: 250 },
  };
}

export function buildOpenAIImageResponse(b64Json: string = 'iVBORw0KGgoAAAANSUhEUg=='): Record<string, unknown> {
  return {
    created: 1700000000,
    data: [{ b64_json: b64Json, revised_prompt: 'A FemiGlow product image' }],
  };
}

export function buildGenerationOutput(): { brief: Record<string, unknown>; drafts: Record<string, unknown>[] } {
  return {
    brief: {
      angle: 'Relier rituel à un geste simple.',
      proof: 'Le rituel FemiGlow révèle l\'éclat naturel.',
      cta: 'Découvrir le rituel',
      mediaDirection: 'Mains, geste lent, lumière naturelle.',
      constraints: { forbidden: ['emoji'] },
    },
    drafts: [
      { variantLabel: 'sobre', hook: 'Un geste lent.', caption: 'Caption sobre.', cta: 'Découvrir', altText: 'Alt sobre', hashtags: ['femiglow'] },
      { variantLabel: 'sensorielle', hook: 'La lumière revient.', caption: 'Caption sensorielle.', cta: 'Découvrir', altText: 'Alt sensorielle', hashtags: ['femiglow'] },
      { variantLabel: 'conversion', hook: 'Recevoir le rituel.', caption: 'Caption conversion.', cta: 'Découvrir', altText: 'Alt conversion', hashtags: ['femiglow'] },
    ],
  };
}