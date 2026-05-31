'use server';

/**
 * Server actions M5.5 — create + update automation (full V2 schema).
 *
 * Existing `automation-actions.ts` keeps toggleAutomationActive / cancel*
 * actions. This file adds the create/update mutations driven by the wizard.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation } from '@/lib/db/schema-emails';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { createId } from '@/lib/ids';
import { AutomationStepSchema } from '@/lib/mail/automation/step-types-v2';
import { RulesGroupSchema } from '@/lib/mail/audiences/rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const AutomationInputSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be kebab-case lowercase'),
  name: z.string().min(1).max(200),
  triggerType: z.enum(['event', 'schedule', 'subscription', 'webhook']),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  triggerConditions: RulesGroupSchema.nullable().optional(),
  steps: z.array(AutomationStepSchema).min(1).max(50),
  cooldownSeconds: z.number().int().min(0).max(2_592_000).default(0),
  quietHoursEnabled: z.boolean().default(true),
  quietHoursStart: z.string().regex(TimeRegex).default('08:00'),
  quietHoursEnd: z.string().regex(TimeRegex).default('22:00'),
  quietHoursTz: z.string().max(80).default('Africa/Casablanca'),
  dailyCap: z.number().int().min(1).max(1_000_000).nullable().optional(),
  active: z.boolean().default(false),
});

export type AutomationInput = z.infer<typeof AutomationInputSchema>;

export async function createAutomation(input: AutomationInput): Promise<{ id: string }> {
  const session = await requireAdmin('/admin/emails/automation/new');
  const parsed = AutomationInputSchema.parse(input);
  const drizzle = requireDb();

  const id = createId('aut');

  // Reject duplicate slug
  const dup = await drizzle
    .select({ id: emailAutomation.id })
    .from(emailAutomation)
    .where(eq(emailAutomation.slug, parsed.slug))
    .limit(1);
  if (dup.length > 0) {
    throw new Error(`Slug already used : ${parsed.slug}`);
  }

  await drizzle.insert(emailAutomation).values({
    id,
    slug: parsed.slug,
    name: parsed.name,
    triggerType: parsed.triggerType,
    triggerConfig: parsed.triggerConfig,
    triggerConditions: parsed.triggerConditions ?? null,
    steps: parsed.steps,
    cooldownSeconds: parsed.cooldownSeconds,
    quietHoursEnabled: parsed.quietHoursEnabled,
    quietHoursStart: parsed.quietHoursStart,
    quietHoursEnd: parsed.quietHoursEnd,
    quietHoursTz: parsed.quietHoursTz,
    dailyCap: parsed.dailyCap ?? null,
    active: parsed.active,
  });

  await logAuditEvent({
    action: 'mail.automation.created',
    actorId: session.email,
    resourceId: id,
    meta: { slug: parsed.slug },
  });
  logger.info('admin.automation.created', { id, slug: parsed.slug, by: session.email });
  revalidatePath('/admin/emails/automation');
  return { id };
}

export async function updateAutomation(input: AutomationInput): Promise<void> {
  const session = await requireAdmin('/admin/emails/automation');
  if (!input.id) throw new Error('id required for update');
  const parsed = AutomationInputSchema.parse(input);
  const drizzle = requireDb();

  await drizzle
    .update(emailAutomation)
    .set({
      name: parsed.name,
      triggerType: parsed.triggerType,
      triggerConfig: parsed.triggerConfig,
      triggerConditions: parsed.triggerConditions ?? null,
      steps: parsed.steps,
      cooldownSeconds: parsed.cooldownSeconds,
      quietHoursEnabled: parsed.quietHoursEnabled,
      quietHoursStart: parsed.quietHoursStart,
      quietHoursEnd: parsed.quietHoursEnd,
      quietHoursTz: parsed.quietHoursTz,
      dailyCap: parsed.dailyCap ?? null,
      active: parsed.active,
      updatedAt: new Date(),
    })
    .where(eq(emailAutomation.id, parsed.id!));

  await logAuditEvent({
    action: 'mail.automation.updated',
    actorId: session.email,
    resourceId: parsed.id!,
  });
  logger.info('admin.automation.updated', { id: parsed.id, by: session.email });
  revalidatePath('/admin/emails/automation');
  revalidatePath(`/admin/emails/automation/${parsed.id}/edit`);
}

export async function deleteAutomation(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/automation');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const drizzle = requireDb();

  await drizzle.delete(emailAutomation).where(eq(emailAutomation.id, id));

  await logAuditEvent({
    action: 'mail.automation.deleted',
    actorId: session.email,
    resourceId: id,
  });
  logger.info('admin.automation.deleted', { id, by: session.email });
  revalidatePath('/admin/emails/automation');
  redirect('/admin/emails/automation');
}
