export const CONTENT_PILLARS = [
  'rituel',
  'produit',
  'preuve',
  'journal',
  'maison',
  'reassurance',
  'saison',
  'coulisses',
] as const;

export const CONTENT_OBJECTIVES = [
  'notoriete',
  'consideration',
  'conversion',
  'reassurance',
  'fidelisation',
] as const;

export const CONTENT_PLATFORMS = ['instagram', 'facebook'] as const;
export const CONTENT_FORMATS = ['post', 'story', 'reel', 'carousel'] as const;

export const CONTENT_STATUSES = [
  'idea',
  'brief',
  'generated',
  'needs_review',
  'approved',
  'scheduled',
  'published',
  'failed',
  'cancelled',
  'rejected',
  'archived',
  'measured',
] as const;

export type ContentPillar = (typeof CONTENT_PILLARS)[number];
export type ContentObjective = (typeof CONTENT_OBJECTIVES)[number];
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type BrandReviewStatus = 'pass' | 'warning' | 'blocked';

export interface ContentIdea {
  id: string;
  campaignId: string | null;
  pillar: ContentPillar;
  objective: ContentObjective;
  platform: ContentPlatform;
  format: ContentFormat;
  prompt: string;
  sourceType: string | null;
  sourceRef: string | null;
  status: ContentStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentBrief {
  id: string;
  ideaId: string;
  angle: string;
  proof: string | null;
  cta: string;
  mediaDirection: string | null;
  constraints: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  createdAt: Date;
}

export interface ContentDraft {
  id: string;
  briefId: string;
  platform: ContentPlatform;
  format: ContentFormat;
  variantLabel: string;
  caption: string;
  hook: string | null;
  cta: string | null;
  altText: string | null;
  hashtags: string[];
  status: ContentStatus;
  scoreTotal: number | null;
  editedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentBrandViolation {
  severity: 'warning' | 'blocked';
  rule: string;
  message: string;
}

export interface ContentBrandReview {
  id: string;
  draftId: string;
  status: BrandReviewStatus;
  scoreTotal: number;
  score: Record<string, number>;
  violations: ContentBrandViolation[];
  rulesVersion: string;
  createdAt: Date;
}

export interface ContentAssetBinding {
  id: string;
  draftId: string;
  mediaId: string;
  role: string;
  crop: Record<string, unknown>;
  createdAt: Date;
}

export interface ContentPost {
  id: string;
  draftId: string;
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  utm: Record<string, unknown>;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentPostizDelivery {
  id: string;
  postId: string;
  integrationId: string;
  postizPostId: string | null;
  status: 'pending' | 'sent' | 'failed' | 'auth_failed';
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentGenerationRun {
  id: string;
  ideaId: string | null;
  briefId: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'succeeded' | 'failed' | 'fallback';
  costCents: number;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface ContentPerformanceSnapshot {
  id: string;
  postId: string;
  source: string;
  metrics: Record<string, unknown>;
  capturedAt: Date;
}

export interface ContentStudioOverview {
  ideas: ContentIdea[];
  drafts: ContentDraft[];
  posts: ContentPost[];
}
