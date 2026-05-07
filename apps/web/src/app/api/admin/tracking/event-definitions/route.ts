import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listEventDefinitions,
  upsertEventDefinition,
} from '@/lib/db/queries/tracking/event-definitions';
import {
  ensureEventDefinitionsSeeded,
  seedEventDefinitionsFromCatalog,
} from '@/lib/tracking/seed-events';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_CATEGORIES = [
  'page',
  'engagement',
  'ecommerce',
  'lead',
  'media',
  'admin',
  'custom',
] as const;

const upsertSchema = z
  .object({
    name: z.string().min(1).max(120),
    category: z.enum(EVENT_CATEGORIES),
    scope: z.enum(['web', 'server', 'both']).optional(),
    description: z.string().min(1).max(2000),
    isConversion: z.boolean().optional(),
    paramsSchema: z.record(z.unknown()).optional(),
    applicableCategories: z.array(z.string()).optional(),
    defaultProviders: z.array(z.string()).optional(),
  })
  .strict();

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    // Auto-seed silencieux à la première visite : si la BDD est vide,
    // on injecte le catalogue (`EVENT_CATALOG`) pour que l'écran admin
    // ne reste jamais bloqué sur "aucun événement défini".
    const seeded = await ensureEventDefinitionsSeeded();
    const definitions = await listEventDefinitions();
    return NextResponse.json({
      definitions,
      seeded: seeded.alreadySeeded ? null : { upserted: seeded.upserted },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const seedSchema = z
  .object({
    force: z.boolean().optional().default(false),
  })
  .strict();

export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => ({}))) as unknown;
    const parsed = seedSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const result = await seedEventDefinitionsFromCatalog({ force: parsed.data.force });
    await auditTrackingChange({
      action: 'seed',
      resource: 'tracking_event_definition',
      resourceId: 'catalog',
      actorId: session.adminId,
      meta: { force: parsed.data.force, upserted: result.upserted },
    });
    return NextResponse.json({ ok: true, ...result });
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
    const def = await upsertEventDefinition({
      name: parsed.data.name,
      category: parsed.data.category,
      scope: parsed.data.scope,
      description: parsed.data.description,
      isConversion: parsed.data.isConversion,
      paramsSchema: parsed.data.paramsSchema,
      applicableCategories: parsed.data.applicableCategories as never,
      defaultProviders: parsed.data.defaultProviders,
    });
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_event_definition',
      resourceId: def.id,
      actorId: session.adminId,
      meta: { name: def.name },
    });
    return NextResponse.json({ definition: def });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
