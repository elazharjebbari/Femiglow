import { http, HttpResponse } from 'msw';
import { SentinelPingInputSchema, ValidatePairInputSchema } from '@/lib/tracking/gtm/sentinel-schemas';
import { validatePair } from '@/lib/tracking/gtm/pair-validator';
import { classifyDrift } from '@/lib/tracking/gtm/drift-detector';

/**
 * MSW handlers — GTM Poka-Yoke endpoints.
 * Stateful in-memory pour tests d'intégration sans DB.
 */

type StoredPing = {
  id: string;
  receivedAt: Date;
  bundleId: string;
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  manifestMismatch: boolean;
  manifestMismatchDetails: string | null;
};

const state: {
  pings: StoredPing[];
  drift: {
    status: 'ok' | 'warning' | 'critical';
    since: Date;
    reasons: Array<Record<string, unknown>>;
  };
  admin: {
    mappingVersion: string;
    configVersion: string;
    bundleId: string;
    containerId: string;
  };
} = {
  pings: [],
  drift: { status: 'ok', since: new Date(), reasons: [] },
  admin: {
    mappingVersion: 'v17',
    configVersion: 'v4',
    bundleId: 'a7c4f2e9b81d',
    containerId: 'GTM-ABCD',
  },
};

export function resetGtmPokaYokeState(opts?: Partial<typeof state>) {
  state.pings = opts?.pings ?? [];
  state.drift = opts?.drift ?? { status: 'ok', since: new Date(), reasons: [] };
  state.admin = opts?.admin ?? {
    mappingVersion: 'v17',
    configVersion: 'v4',
    bundleId: 'a7c4f2e9b81d',
    containerId: 'GTM-ABCD',
  };
}

export function getGtmPokaYokeState() {
  return state;
}

export const gtmPokaYokeHandlers = [
  // POST /api/track/sentinel
  http.post('/api/track/sentinel', async ({ request }) => {
    const origin = request.headers.get('origin');
    if (!origin || (!origin.includes('localhost') && !origin.includes('msw.test'))) {
      return new HttpResponse(null, { status: 403 });
    }
    const json = await request.json().catch(() => null);
    const parsed = SentinelPingInputSchema.safeParse(json);
    if (!parsed.success) {
      return HttpResponse.json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
    }
    const ping: StoredPing = {
      id: `ping_${state.pings.length + 1}`,
      receivedAt: new Date(),
      bundleId: parsed.data.bundleId,
      mappingVersion: parsed.data.mappingVersion,
      configVersion: parsed.data.configVersion,
      containerId: parsed.data.containerId,
      manifestMismatch: parsed.data.manifestMismatch ?? false,
      manifestMismatchDetails: parsed.data.manifestMismatchDetails ?? null,
    };
    state.pings.push(ping);

    const classification = classifyDrift({
      admin: state.admin,
      lastPing: ping,
      lastEditAt: null,
      now: new Date(),
    });
    state.drift = {
      status: classification.status,
      since: classification.since,
      reasons: classification.reasons as unknown as Array<Record<string, unknown>>,
    };
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/admin/tracking/gtm/validate-pair
  http.post('/api/admin/tracking/gtm/validate-pair', async ({ request }) => {
    const json = await request.json().catch(() => null);
    const parsed = ValidatePairInputSchema.safeParse(json);
    if (!parsed.success) {
      return HttpResponse.json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
    }
    const result = validatePair({
      configJson: parsed.data.configJson,
      mappingJson: parsed.data.mappingJson,
    });
    return HttpResponse.json(result);
  }),

  // GET /api/admin/tracking/gtm/sync-status
  http.get('/api/admin/tracking/gtm/sync-status', () => {
    const lastPing = state.pings[state.pings.length - 1] ?? null;
    return HttpResponse.json({
      activeAdmin: state.admin,
      lastPing: lastPing
        ? {
            id: lastPing.id,
            receivedAt: lastPing.receivedAt.toISOString(),
            bundleId: lastPing.bundleId,
            mappingVersion: lastPing.mappingVersion,
            configVersion: lastPing.configVersion,
            containerId: lastPing.containerId,
            manifestMismatch: lastPing.manifestMismatch,
          }
        : null,
      drift: {
        status: state.drift.status,
        since: state.drift.since.toISOString(),
        reasons: state.drift.reasons,
      },
      silence: { ok: !!lastPing, lastPingAgoMs: null, thresholdHours: 6 },
      history: [],
      recentTransitions: [],
      generatedAt: new Date().toISOString(),
    });
  }),
];
