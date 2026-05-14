import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';
import {
  GOOGLE_ADS_CATEGORIES,
  getEventCategoryDefault,
  type GoogleAdsCategory,
} from '@/lib/tracking/categorization';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tracking/events/categorization
 *
 * Liste tous les events conversion avec leur catégorie Google Ads :
 * default (code) + override (DB) si présent. La résolution finale =
 * override ?? default. T28 + C3.F.1 + D-005.
 */
export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const drizzle = db();
    const overrides = drizzle
      ? await drizzle
          .select({
            eventName: schema.trackingEventOverrides.eventName,
            category: schema.trackingEventOverrides.googleAdsCategory,
            updatedAt: schema.trackingEventOverrides.updatedAt,
            updatedBy: schema.trackingEventOverrides.updatedBy,
            note: schema.trackingEventOverrides.note,
          })
          .from(schema.trackingEventOverrides)
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.eventName, o]));

    const items = EVENT_CATALOG.filter((e) => e.isConversion).map((entry) => {
      const override = overrideMap.get(entry.name);
      const defaultCategory = getEventCategoryDefault(entry.name);
      return {
        name: entry.name,
        category: entry.category,
        description: entry.description,
        defaultCategory,
        overrideCategory: (override?.category as GoogleAdsCategory | undefined) ?? null,
        resolvedCategory: (override?.category as GoogleAdsCategory | undefined) ?? defaultCategory,
        overrideUpdatedAt: override?.updatedAt
          ? new Date(override.updatedAt).toISOString()
          : null,
        overrideUpdatedBy: override?.updatedBy ?? null,
        overrideNote: override?.note ?? null,
      };
    });

    return NextResponse.json(
      {
        events: items,
        availableCategories: GOOGLE_ADS_CATEGORIES,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const putSchema = z
  .object({
    eventName: z.string().min(1).max(80),
    /** `null` ou absent ⇒ delete l'override (reset au default). */
    googleAdsCategory: z.enum(GOOGLE_ADS_CATEGORIES).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

/**
 * PUT /api/admin/tracking/events/categorization
 *
 * Upsert (ou delete si googleAdsCategory=null) d'un override de catégorie.
 * Cf. C3.F.3 + C3.F.4.
 */
export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }

    // Garde-fou : l'event doit exister dans le catalog.
    const entry = EVENT_CATALOG.find((e) => e.name === parsed.data.eventName);
    if (!entry) {
      throw new HttpError('not_found', `Event inconnu : ${parsed.data.eventName}`);
    }

    const drizzle = db();
    if (!drizzle) {
      throw new HttpError('internal_error', 'DB indisponible');
    }

    const resetToDefault =
      parsed.data.googleAdsCategory === null ||
      parsed.data.googleAdsCategory === undefined;

    if (resetToDefault) {
      await drizzle
        .delete(schema.trackingEventOverrides)
        .where(eq(schema.trackingEventOverrides.eventName, parsed.data.eventName));
      await auditTrackingChange({
        action: 'delete',
        resource: 'tracking_event_override',
        resourceId: parsed.data.eventName,
        actorId: session.adminId,
        meta: { reset: true },
      });
      return NextResponse.json({
        eventName: parsed.data.eventName,
        overrideCategory: null,
        resolvedCategory: getEventCategoryDefault(parsed.data.eventName),
      });
    }

    // Narrowing : `resetToDefault === false` ⇒ category est défini et non null.
    const category = parsed.data.googleAdsCategory as GoogleAdsCategory;
    const now = new Date();
    // Upsert manuel (drizzle onConflictDoUpdate disponible mais on garde
    // une logique explicite pour clarté).
    const existing = await drizzle
      .select({ id: schema.trackingEventOverrides.id })
      .from(schema.trackingEventOverrides)
      .where(eq(schema.trackingEventOverrides.eventName, parsed.data.eventName))
      .limit(1);

    if (existing[0]) {
      await drizzle
        .update(schema.trackingEventOverrides)
        .set({
          googleAdsCategory: category,
          updatedBy: session.adminId,
          updatedAt: now,
          note: parsed.data.note ?? null,
        })
        .where(eq(schema.trackingEventOverrides.id, existing[0].id));
    } else {
      await drizzle.insert(schema.trackingEventOverrides).values({
        id: createId('teo'),
        eventName: parsed.data.eventName,
        googleAdsCategory: category,
        updatedBy: session.adminId,
        updatedAt: now,
        note: parsed.data.note ?? null,
      });
    }

    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_event_override',
      resourceId: parsed.data.eventName,
      actorId: session.adminId,
      meta: { category, default: getEventCategoryDefault(parsed.data.eventName) },
    });

    return NextResponse.json({
      eventName: parsed.data.eventName,
      overrideCategory: category,
      resolvedCategory: category,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
