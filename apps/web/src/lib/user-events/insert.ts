/**
 * insertUserEvent — point d'entrée unique pour écrire dans user_event (M5.2.1).
 *
 * Toutes les sources (web tracking, email webhooks, server actions, admin
 * actions) passent par cette fonction pour garantir :
 *  - validation Zod stricte des inputs
 *  - normalisation email (lowercase + trim)
 *  - lookup automatique lead_id si non fourni
 *  - log structuré pour debug pipeline
 *
 * Cf. docs/emailing/admin-evolution/02-backend/00-overview.md
 *    docs/emailing/admin-evolution/01-data/01-tables.md#user_event
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db as getDb } from '@/lib/db/client';
import { leads, userEvent, type UserEventSource } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';

// ── Validation Zod ──────────────────────────────────────────────────────

const SOURCES: readonly UserEventSource[] = ['web', 'server', 'email', 'admin', 'import'] as const;

export const InsertUserEventSchema = z.object({
  /** Adresse email (normalisée lowercase+trim avant validation). */
  email: z
    .string()
    .max(320)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().email()),
  /**
   * Nom canonique de l'event. Convention `<domain>.<action>` en minuscules :
   *   email.delivered, cart.added, order.placed, lead.created, ...
   * Max 80 chars pour rester scannable + indexable.
   */
  eventName: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9._]*$/, 'event_name must be lowercase alphanumeric with . or _'),
  /** Timestamp (default = now côté DB). */
  ts: z.coerce.date().optional(),
  /** Properties JSON arbitraire. Cap 32KB stringified pour protéger l'index GIN. */
  properties: z.record(z.string(), z.unknown()).optional(),
  /** ID de session web si applicable. */
  sessionId: z.string().max(120).nullable().optional(),
  /** Source de l'event. Détermine le bridge d'origine. */
  source: z.enum(SOURCES as unknown as [UserEventSource, ...UserEventSource[]]),
  /**
   * Lead.id si déjà connu côté caller (évite un round-trip de lookup).
   * Si absent, on tente un lookup par email — si rien trouvé, lead_id reste null.
   */
  leadId: z.string().nullable().optional(),
});

export type InsertUserEventInput = z.infer<typeof InsertUserEventSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const PROPERTIES_MAX_BYTES = 32 * 1024;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function clampProperties(properties: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!properties) return {};
  const json = JSON.stringify(properties);
  if (json.length > PROPERTIES_MAX_BYTES) {
    return { _truncated: true, _byteLen: json.length };
  }
  return properties;
}

async function lookupLeadId(email: string): Promise<string | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, email))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── API publique ────────────────────────────────────────────────────────

export type InsertUserEventResult = {
  /** ID auto-généré (bigint Postgres → number JS). */
  id: number;
  /** lead_id résolu (peut être null si email pas connu). */
  leadId: string | null;
};

/**
 * Écrit un événement dans `user_event`. Validation stricte, normalisation,
 * lookup lead_id si non fourni.
 *
 * @throws ZodError si l'input est invalide (caller doit catcher).
 */
export async function insertUserEvent(
  input: InsertUserEventInput,
): Promise<InsertUserEventResult> {
  const parsed = InsertUserEventSchema.parse(input);
  const drizzle = requireDb();

  const email = normalizeEmail(parsed.email);
  const leadId = parsed.leadId ?? (await lookupLeadId(email));
  const properties = clampProperties(parsed.properties);

  const [row] = await drizzle
    .insert(userEvent)
    .values({
      email,
      eventName: parsed.eventName,
      ts: parsed.ts,
      properties,
      sessionId: parsed.sessionId ?? null,
      source: parsed.source,
      leadId,
    })
    .returning();

  if (!row) throw new Error('insertUserEvent: INSERT returned no row');

  logger.info('user_event.inserted', {
    id: row.id,
    eventName: parsed.eventName,
    source: parsed.source,
    hasLeadId: leadId !== null,
  });

  // M5.5 — wake up runs in 'waiting_for_event' status that match this event
  // Fire-and-forget : we don't want event ingestion to be blocked by automation resume.
  void resumeRunsForEventSafe(parsed.eventName, email);

  return { id: row.id, leadId: row.leadId };
}

async function resumeRunsForEventSafe(eventName: string, email: string): Promise<void> {
  try {
    const { resumeRunsForEvent } = await import('@/lib/mail/automation/resume');
    await resumeRunsForEvent(eventName, email);
  } catch (err) {
    logger.error('user_event.resume_failed', {
      error: String(err),
      eventName,
    });
  }
}

/**
 * Variante "fire and forget" — utilisée par les bridges qui ne veulent pas
 * bloquer leur workflow principal (web tracking, server actions).
 * Erreurs loggées mais pas propagées.
 */
export async function insertUserEventSafe(
  input: InsertUserEventInput,
): Promise<InsertUserEventResult | null> {
  try {
    return await insertUserEvent(input);
  } catch (err) {
    logger.error('user_event.insert_failed', {
      error: String(err),
      eventName: (input as { eventName?: string }).eventName,
      source: (input as { source?: string }).source,
    });
    return null;
  }
}
