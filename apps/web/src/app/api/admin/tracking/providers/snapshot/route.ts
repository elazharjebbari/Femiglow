import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tracking/providers/snapshot
 *
 * Retourne un snapshot **non sensible** (jamais de `capiToken`) de l'état
 * courant de chaque Provider, utilisé par `GtmConfigForm` pour pré-remplir
 * les versions GTM ("Importer depuis Providers" — D-002).
 *
 * Format stable typé : un objet `providers` indexé par `kind`, plus un
 * `generatedAt` ISO. Les Providers absents en DB sont remontés avec
 * `status: 'disabled'` et champs `null` pour rester déterministe côté UI.
 *
 * Cf. docs/tracking-improvement/40-frontend/ + 90-plan/dev-plan.csv (T21).
 */

const ALL_KINDS = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
] as const;

export interface ProvidersSnapshotEntry {
  kind: (typeof ALL_KINDS)[number];
  status: 'enabled' | 'disabled' | 'error';
  pixelId: string | null;
  enabledEvents: string[];
  hasCapiToken: boolean;
  customHead: string | null;
  customBody: string | null;
  config: Record<string, unknown>;
  lastEventAt: string | null;
  lastError: string | null;
}

export interface ProvidersSnapshot {
  generatedAt: string;
  providers: Record<(typeof ALL_KINDS)[number], ProvidersSnapshotEntry>;
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const rows = await listTrackingProviders();
    const byKind = new Map(rows.map((p) => [p.kind, p]));

    const providers = ALL_KINDS.reduce<Record<string, ProvidersSnapshotEntry>>(
      (acc, kind) => {
        const row = byKind.get(kind);
        acc[kind] = row
          ? {
              kind,
              status: row.status,
              pixelId: row.pixelId,
              enabledEvents: row.enabledEvents,
              hasCapiToken: !!row.capiToken,
              customHead: row.customHead,
              customBody: row.customBody,
              config: row.config as Record<string, unknown>,
              lastEventAt: row.lastEventAt
                ? new Date(row.lastEventAt).toISOString()
                : null,
              lastError: row.lastError,
            }
          : {
              kind,
              status: 'disabled',
              pixelId: null,
              enabledEvents: [],
              hasCapiToken: false,
              customHead: null,
              customBody: null,
              config: {},
              lastEventAt: null,
              lastError: null,
            };
        return acc;
      },
      {},
    ) as ProvidersSnapshot['providers'];

    const snapshot: ProvidersSnapshot = {
      generatedAt: new Date().toISOString(),
      providers,
    };
    return NextResponse.json(snapshot, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
