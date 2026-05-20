import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { TrackingProviderKind, TrackingProviderStatus } from '@/lib/db/types';
import {
  findTrackingProviderByKind,
  listTrackingProviders,
  upsertTrackingProvider,
  updateTrackingProvider,
} from '@/lib/db/queries/tracking/providers';
import { getAdminSession } from '@/lib/auth/require-admin';
import { HttpError, formatErrorResponse } from '@/lib/errors/http-error';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS: TrackingProviderKind[] = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
];

const providerPatchSchema = z.object({
  status: z.enum(['enabled', 'disabled']).optional(),
  pixelId: z.string().trim().max(128).nullable().optional(),
  capiToken: z.string().trim().min(1).max(512).nullable().optional(),
  testEventCode: z.string().trim().max(64).nullable().optional(),
  enabledEvents: z.array(z.string().max(64)).optional(),
}).strict();

type ProviderConfigResponse = {
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
};

function toSafeResponse(p: Awaited<ReturnType<typeof findTrackingProviderByKind>>): ProviderConfigResponse | null {
  if (!p) return null;
  return {
    kind: p.kind,
    status: p.status,
    pixelId: p.pixelId,
    hasCapiToken: p.capiToken != null && p.capiToken !== '',
    testEventCode: p.testEventCode,
    enabledEvents: p.enabledEvents ?? [],
    lastEventAt: p.lastEventAt?.toISOString() ?? null,
    errorCount24h: p.errorCount24h,
    lastError: p.lastError,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Non autorisé');

    const { kind } = await params;
    if (!VALID_KINDS.includes(kind as TrackingProviderKind)) {
      throw new HttpError('invalid_input', `Provider "${kind}" non reconnu`);
    }

    const provider = await findTrackingProviderByKind(kind as TrackingProviderKind);
    if (!provider) {
      return NextResponse.json(
        toSafeResponse({
          id: `tpr_${kind}_default`,
          kind: kind as TrackingProviderKind,
          status: 'disabled' as TrackingProviderStatus,
          pixelId: null,
          capiToken: null,
          capiTokenIv: null,
          capiTokenTag: null,
          testEventCode: null,
          customHead: null,
          customBody: null,
          config: {},
          enabledEvents: [],
          lastEventAt: null,
          errorCount24h: 0,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }

    return NextResponse.json(toSafeResponse(provider));
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Non autorisé');

    const { kind } = await params;
    if (!VALID_KINDS.includes(kind as TrackingProviderKind)) {
      throw new HttpError('invalid_input', `Provider "${kind}" non reconnu`);
    }

    const raw = await request.json();
    const parsed = providerPatchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    const existing = await findTrackingProviderByKind(kind as TrackingProviderKind);

    if (!existing) {
      const created = await upsertTrackingProvider({
        kind: kind as TrackingProviderKind,
        status: parsed.data.status ?? 'disabled',
        pixelId: parsed.data.pixelId ?? null,
        capiToken: parsed.data.capiToken ?? null,
        testEventCode: parsed.data.testEventCode ?? null,
        enabledEvents: parsed.data.enabledEvents ?? [],
      });

      await auditTrackingChange({
        action: 'create',
        resource: 'tracking_provider',
        resourceId: kind,
        actorId: session.adminId,
        meta: {
          status: created.status,
          pixelIdSet: created.pixelId != null,
          capiTokenChanged: parsed.data.capiToken !== undefined,
        },
      });

      return NextResponse.json(toSafeResponse(created), { status: 201 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.pixelId !== undefined) update.pixelId = parsed.data.pixelId;
    if (parsed.data.capiToken !== undefined) update.capiToken = parsed.data.capiToken;
    if (parsed.data.testEventCode !== undefined) update.testEventCode = parsed.data.testEventCode;
    if (parsed.data.enabledEvents !== undefined) update.enabledEvents = parsed.data.enabledEvents;

    const updated = await updateTrackingProvider(existing.id, update);

    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_provider',
      resourceId: kind,
      actorId: session.adminId,
      meta: {
        status: updated?.status,
        pixelIdSet: updated?.pixelId != null,
        capiTokenChanged: parsed.data.capiToken !== undefined,
      },
    });

    return NextResponse.json(toSafeResponse(updated));
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}