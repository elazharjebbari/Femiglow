'use client';

import type { TrackingProviderKind, TrackingProviderStatus } from '@/lib/db/types';
import { ProviderConfigCard } from './ProviderConfigCard';

export interface ProviderConfigResponse {
  kind: TrackingProviderKind;
  status: TrackingProviderStatus;
  pixelId: string | null;
  hasCapiToken: boolean;
  testEventCode: string | null;
  enabledEvents: string[];
  lastEventAt: string | null;
  errorCount24h: number;
  lastError: string | null;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<TrackingProviderKind, string> = {
  meta: 'Meta Pixel',
  tiktok: 'TikTok Pixel',
  google_ads: 'Google Ads',
  google_ga4: 'Google Analytics 4',
  snap: 'Snapchat Pixel',
  pinterest: 'Pinterest CAPI',
  gtm: 'Google Tag Manager',
  custom: 'Custom',
};

const CAPI_PROVIDERS: Set<TrackingProviderKind> = new Set(['meta', 'tiktok', 'snap', 'pinterest']);

const PROVIDER_ORDER: TrackingProviderKind[] = [
  'snap',
  'meta',
  'tiktok',
  'google_ga4',
  'google_ads',
  'pinterest',
  'gtm',
  'custom',
];

interface ProviderConfigListProps {
  providers: ProviderConfigResponse[];
  hasEnvSnapToken: boolean;
}

export function ProviderConfigList({ providers, hasEnvSnapToken }: ProviderConfigListProps) {
  const byKind = new Map(providers.map((p) => [p.kind, p]));
  const ordered = PROVIDER_ORDER.filter(
    (kind) => byKind.has(kind) || kind === 'snap' || kind === 'meta',
  );
  // Add any providers not in our order list
  for (const p of providers) {
    if (!ordered.includes(p.kind)) ordered.push(p.kind);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Les tokens CAPI sont chiffrés en base de données (AES-256-GCM).
        Seuls les providers avec API serveur nécessitent un token.
      </p>
      <div className="space-y-4">
        {ordered.map((kind) => {
          const provider = byKind.get(kind);
          return (
            <ProviderConfigCard
              key={kind}
              kind={kind}
              provider={provider ?? null}
              label={PROVIDER_LABELS[kind] ?? kind}
              hasCapi={CAPI_PROVIDERS.has(kind)}
              hasEnvSnapToken={kind === 'snap' ? hasEnvSnapToken : false}
            />
          );
        })}
      </div>
    </div>
  );
}