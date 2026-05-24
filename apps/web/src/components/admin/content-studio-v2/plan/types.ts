import type {
  ContentDraft,
  ContentPillar,
  ContentPost,
  ContentPostizDelivery,
} from '@/lib/content-studio/types';

/**
 * Subset of `StudioMediaItem` that the /plan calendar actually needs
 * (no DB types leak into client). Built server-side from
 * `listDraftPrimaryAssets()`.
 */
export interface CalendarMediaEntry {
  mediaId: string;
  previewUrl: string | null;
  /** Thumbnail URL (poster for videos). Falls back to previewUrl when absent. */
  thumbnailUrl?: string | null;
  /** Media kind — when 'video', uses thumbnailUrl for the img src. */
  kind?: 'image' | 'video';
  alt: string;
}

export interface CalendarItem {
  post: ContentPost;
  draft: ContentDraft | undefined;
  latestDelivery: ContentPostizDelivery | null;
  media: CalendarMediaEntry | undefined;
  pillar: ContentPillar | undefined;
}

export type CalendarViewMode = 'week' | 'month' | 'list';

export interface PublishJobRow {
  id: string;
  postId: string;
  status:
    | 'draft'
    | 'approved'
    | 'queued'
    | 'publishing'
    | 'published'
    | 'failed'
    | 'cancelled';
  scheduledAt: string | null;
  attemptCount: number;
  lastError: { code: string; message: string; retryable: boolean } | null;
  platform: string;
  format: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}
