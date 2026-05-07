import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listTrackingProviders,
  upsertTrackingProvider,
} from '@/lib/db/queries/tracking/providers';
import { auditTrackingChange } from '@/lib/tracking/server/audit';
import { validateCustomCode } from '@/lib/tracking/providers/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_KINDS = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
] as const;

const upsertSchema = z
  .object({
    kind: z.enum(PROVIDER_KINDS),
    status: z.enum(['enabled', 'disabled', 'error']).optional(),
    pixelId: z.string().max(255).nullable().optional(),
    capiToken: z.string().max(8192).nullable().optional(),
    testEventCode: z.string().max(64).nullable().optional(),
    customHead: z.string().max(50_000).nullable().optional(),
    customBody: z.string().max(50_000).nullable().optional(),
    config: z.record(z.unknown()).optional(),
    enabledEvents: z.array(z.string()).optional(),
  })
  .strict();

function redact(provider: Awaited<ReturnType<typeof upsertTrackingProvider>>): Record<string, unknown> {
  return {
    id: provider.id,
    kind: provider.kind,
    status: provider.status,
    pixelId: provider.pixelId,
    hasCapiToken: !!provider.capiToken,
    testEventCode: provider.testEventCode,
    customHead: provider.customHead,
    customBody: provider.customBody,
    config: provider.config,
    enabledEvents: provider.enabledEvents,
    lastEventAt: provider.lastEventAt,
    errorCount24h: provider.errorCount24h,
    lastError: provider.lastError,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const providers = await listTrackingProviders();
    return NextResponse.json({ providers: providers.map(redact) });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    if (parsed.data.kind === 'custom') {
      for (const code of [parsed.data.customHead, parsed.data.customBody]) {
        if (code && code.trim().length > 0) {
          const validation = validateCustomCode(code);
          if (!validation.ok) {
            throw new HttpError('invalid_input', 'Custom code refusé', {
              errors: validation.errors,
            });
          }
        }
      }
    }
    const provider = await upsertTrackingProvider(parsed.data);
    await auditTrackingChange({
      action: parsed.data.status === 'enabled' ? 'enable' : parsed.data.status === 'disabled' ? 'disable' : 'update',
      resource: 'tracking_provider',
      resourceId: provider.id,
      actorId: session.adminId,
      meta: { kind: provider.kind, status: provider.status },
    });
    return NextResponse.json({ provider: redact(provider) });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
