/**
 * Médias par audience — types côté client (réponses JSON des routes
 * `/api/admin/components/[key]/media-sets/**`, dates en chaînes ISO).
 *
 * Miroir de `AdminMediaSet` (route-helpers), `MediaSetCoverage` (coverage.ts)
 * et des réponses `history`, `resolve`, `bulk-publish`. On ne réimporte pas
 * les types serveur : ils portent des `Date` et des modules `server-only`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import type { MediaVariantPolicy } from '@/lib/components/registry';
import type { MediaSetCoverage } from '@/lib/components/media-variants/coverage';
import type { MediaSlotTrace } from '@/lib/components/media-variants/types';
import type {
  MediaObjectPosition,
  MediaSetItemAlt,
  MediaSetSource,
  MediaSetStatus,
} from '@/lib/db/types';

export type { MediaSetCoverage, MediaSetCoverageCell } from '@/lib/components/media-variants/coverage';

export type AdminMediaState = 'ok' | 'not_ready' | 'deleted' | 'missing';

export interface AdminMediaRefJson {
  id: string;
  state: AdminMediaState;
  thumbUrl: string | null;
  alt: string | null;
}

export interface AdminMediaSetItemJson {
  id: string;
  setId: string;
  position: number;
  mediaId: string;
  mobileMediaId: string | null;
  alt: MediaSetItemAlt;
  objectPosition: MediaObjectPosition | null;
  focalX: number | null;
  focalY: number | null;
  createdAt: string;
  /** Absent dans les réponses de mutation (non enrichies). */
  media?: AdminMediaRefJson;
  mobileMedia?: AdminMediaRefJson | null;
}

export interface AdminMediaSetJson {
  id: string;
  componentId: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  crossLocale: boolean;
  status: MediaSetStatus;
  version: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  source: MediaSetSource;
  notes: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminMediaSetItemJson[];
  /** Présent sur la liste (enrichie). */
  hasUnavailableMedia?: boolean;
}

export interface MediaVariantDimensionJson {
  id: string;
  label: string;
  values: string[] | null;
}

export interface StuckScheduledJson {
  setId: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  scheduledAt: string;
  reason: 'media_unavailable' | 'overdue';
  unavailableMediaIds: string[];
}

export interface MediaSetsListResponse {
  componentKey: string;
  policy: MediaVariantPolicy;
  dimensions: MediaVariantDimensionJson[];
  locales: string[];
  sets: AdminMediaSetJson[];
  page: { limit: number; offset: number; hasMore: boolean } | null;
  stuckScheduled: StuckScheduledJson[];
  coverage: MediaSetCoverage;
}

/** Tuple d'une cellule de la matrice (un slot × une ligne × une langue d'ensemble). */
export interface MediaSetTuple {
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
}

/** Ligne de la matrice : `default` ou une valeur de dimension. */
export interface MatrixRow {
  variantDim: string;
  variantKey: string;
}

/** Item envoyé à `PUT /draft`. */
export interface MediaSetItemPayload {
  mediaId: string;
  mobileMediaId?: string | null;
  alt?: MediaSetItemAlt | null;
  objectPosition?: MediaObjectPosition | null;
  focalX?: number | null;
  focalY?: number | null;
}

export interface MediaSetDraftPayload extends MediaSetTuple {
  crossLocale?: boolean;
  items: MediaSetItemPayload[];
  notes?: string | null;
}

export interface MediaSetIssueJson {
  code: string;
  path: (string | number)[];
  message: string;
}

export interface MediaSetHistoryItemJson {
  position: number;
  mediaId: string;
  mobileMediaId: string | null;
  alt: MediaSetItemAlt;
  objectPosition: MediaObjectPosition | null;
  focalX: number | null;
  focalY: number | null;
  thumbUrl: string | null;
  mobileThumbUrl: string | null;
}

export interface MediaSetHistoryEntryJson {
  id: string;
  setId: string;
  version: number;
  status: MediaSetStatus;
  action: string;
  crossLocale: boolean;
  actorId: string | null;
  notes: string | null;
  createdAt: string;
  items: MediaSetHistoryItemJson[];
}

export interface MediaSetHistoryResponse {
  componentKey: string;
  tuple: MediaSetTuple;
  entries: MediaSetHistoryEntryJson[];
}

export interface MediaSetResolveSlotJson {
  slot: string;
  level: number;
  delegated: boolean;
  trace: MediaSlotTrace | null;
  trackingValue: string;
  images: Array<{
    id: string;
    src: string;
    width: number;
    height: number;
    alt: string;
    mobile: { src: string } | null;
  }> | null;
}

export interface MediaSetResolveResponse {
  componentKey: string;
  context: { locale: string; variants: Record<string, string | null>; draft: boolean };
  trackingValue: string;
  slots: MediaSetResolveSlotJson[];
}

export interface BulkPublishSummaryJson {
  setId: string;
  /** ISO — sert de plan revu (`expected`) pour la publication réelle. */
  updatedAt: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  source: MediaSetSource;
  version: number;
  itemCount: number;
}

export interface BulkPublishDryRunItemJson extends BulkPublishSummaryJson {
  replacesPublished: { setId: string; version: number } | null;
  supersedesScheduled: { setId: string; scheduledAt: string | null } | null;
  warnings: string[];
}

export type BulkPublishResultItemJson = BulkPublishSummaryJson &
  (
    | { ok: true; publishedVersion: number }
    | { ok: false; error: { code: string; message: string; details?: unknown } }
  );

export interface BulkPublishDryRunResponse {
  dryRun: true;
  matched: number;
  truncated: boolean;
  results: BulkPublishDryRunItemJson[];
}

export interface BulkPublishResponse {
  dryRun: false;
  matched: number;
  truncated: boolean;
  published: number;
  failed: number;
  results: BulkPublishResultItemJson[];
}

export interface BulkPublishFilter {
  slot?: string;
  variantDim?: string;
  variantKey?: string;
  locale?: string;
  source?: MediaSetSource;
}
