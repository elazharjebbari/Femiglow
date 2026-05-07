import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { auditTrackingChange } from '@/lib/tracking/server/audit';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { uuidv7 } from '@/lib/tracking/uuid';
import type { TrackingConsentState } from '@/lib/db/types';

const GRANTED_CONSENT: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testSchema = z
  .object({
    eventName: z.string().min(1).max(64),
    pageRoute: z.string().min(1).max(255).default('/admin/tracking/test'),
    pageUrl: z.string().url().optional(),
    pageTitle: z.string().max(255).optional(),
    params: z.record(z.unknown()).optional(),
    identity: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .partial()
      .optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = testSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }

    const ctx: DispatchContext = {
      eventName: parsed.data.eventName,
      eventId: uuidv7(),
      receivedAt: new Date(),
      pageRoute: parsed.data.pageRoute,
      pageUrl: parsed.data.pageUrl ?? `https://femiglow.ma${parsed.data.pageRoute}`,
      pageTitle: parsed.data.pageTitle ?? 'Admin Test',
      referrer: '',
      anonymousId: 'aid_test_admin',
      sessionId: 'sid_test_admin',
      userId: null,
      consent: { ...GRANTED_CONSENT },
      uaHash: 'a'.repeat(32),
      ipAnonymized: '0.0.0.0',
      device: 'desktop',
      locale: 'fr-MA',
      params: parsed.data.params ?? {},
      identity: parsed.data.identity,
    };

    if (parsed.data.dryRun) {
      await auditTrackingChange({
        action: 'test_event',
        resource: 'tracking_provider',
        actorId: session.adminId,
        meta: { eventName: ctx.eventName, dryRun: true },
      });
      return NextResponse.json({
        dryRun: true,
        ctx: {
          eventName: ctx.eventName,
          eventId: ctx.eventId,
          pageRoute: ctx.pageRoute,
          params: ctx.params,
        },
      });
    }

    const outcome = await dispatchToProviders(ctx);
    await auditTrackingChange({
      action: 'test_event',
      resource: 'tracking_provider',
      actorId: session.adminId,
      meta: {
        eventName: ctx.eventName,
        eventId: ctx.eventId,
        dispatched: outcome.dispatched,
      },
    });
    return NextResponse.json({ outcome, ctx: { eventId: ctx.eventId } });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
