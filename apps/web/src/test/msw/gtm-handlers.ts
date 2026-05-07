/**
 * Handlers MSW pour `/api/admin/tracking/gtm/container`.
 *
 * Cf. docs/gtm/14-admin-export.md §5 (signatures route API).
 */
import { http, HttpResponse } from 'msw';
import type { GtmStats, GtmMeta } from '@/lib/tracking/gtm/exporter';

export interface FakeContainerResponse {
  pretty: string;
  stats: GtmStats;
  meta: GtmMeta;
  env: 'production' | 'stage' | 'preview' | 'dev';
}

export function makeStats(overrides: Partial<GtmStats> = {}): GtmStats {
  return {
    tags: 75,
    triggers: 67,
    variables: 39,
    folders: 9,
    conversions: 4,
    chatTriggers: 18,
    chatDims: 9,
    byCategory: {},
    ...overrides,
  };
}

export function makeMeta(overrides: Partial<GtmMeta> = {}): GtmMeta {
  return {
    generatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
    version: '1.4.0',
    sizeBytes: 97516,
    lineCount: 4034,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

export function makePayload(env: FakeContainerResponse['env']): FakeContainerResponse {
  return {
    pretty: `{\n  "env": "${env}",\n  "tag": []\n}\n`,
    stats: makeStats(env === 'dev' ? { tags: 0 } : {}),
    meta: makeMeta(),
    env,
  };
}

export function gtmContainerHandler(payload?: Partial<FakeContainerResponse>) {
  return http.get('/api/admin/tracking/gtm/container', ({ request }) => {
    const url = new URL(request.url);
    const env = (url.searchParams.get('env') ?? 'production') as FakeContainerResponse['env'];
    const base = makePayload(env);
    return HttpResponse.json({ ...base, ...payload, env: payload?.env ?? env });
  });
}

export function gtmContainerErrorHandler(status = 500) {
  return http.get('/api/admin/tracking/gtm/container', () =>
    HttpResponse.json({ error: { message: 'oops' } }, { status }),
  );
}
