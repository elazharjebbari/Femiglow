import type { TrackingProviderKind } from '@/lib/db/types';
import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import type { ProviderAdapter } from './types';
import { metaAdapter } from './meta';
import { googleAdapter } from './google';
import { googleAdsAdapter } from './google-ads';
import { tiktokAdapter } from './tiktok';
import { snapAdapter } from './snap';
import { pinterestAdapter } from './pinterest';
import { gtmAdapter } from './gtm';
import { customAdapter } from './custom';

const REGISTRY: Partial<Record<TrackingProviderKind, ProviderAdapter>> = {
  meta: metaAdapter,
  google_ga4: googleAdapter,
  google_ads: googleAdsAdapter,
  tiktok: tiktokAdapter,
  snap: snapAdapter,
  pinterest: pinterestAdapter,
  gtm: gtmAdapter,
  custom: customAdapter,
};

export function registerAdapter(kind: TrackingProviderKind, adapter: ProviderAdapter): void {
  REGISTRY[kind] = adapter;
}

export function getAdapter(kind: TrackingProviderKind): ProviderAdapter | null {
  return REGISTRY[kind] ?? null;
}

export function listAdapters(): ProviderAdapter[] {
  return Object.values(REGISTRY).filter((a): a is ProviderAdapter => a !== undefined);
}

export async function listEnabledProviderKinds(): Promise<TrackingProviderKind[]> {
  const enabled = await listEnabledTrackingProviders();
  return enabled.map((p) => p.kind);
}
