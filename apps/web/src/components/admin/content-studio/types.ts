import type { ContentPostizDelivery, ContentPerformanceSnapshot } from '@/lib/content-studio/types';

export interface Integration {
  id: string;
  provider: string;
  identifier: string | null;
  name: string | null;
  disabled: boolean;
}

export interface StudioMediaItem {
  id: string;
  slug: string;
  kind: string;
  source: string;
  compartment: 'imported' | 'ai_generated';
  status: string;
  alt: string;
  caption: string | null;
  originalUrl: string | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string | Date;
}

export type DraftAssetsByDraftId = Record<
  string,
  {
    mediaId: string;
    media: StudioMediaItem | null;
  }
>;

export type MediaCompartment = StudioMediaItem['compartment'];

export interface AutomationResponse {
  job: 'postiz-sync' | 'retry-deliveries' | 'import-status' | 'import-performance';
  result: Record<string, unknown>;
  deliveries?: ContentPostizDelivery[];
  snapshots?: ContentPerformanceSnapshot[];
}