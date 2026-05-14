/**
 * Schema for automation `steps` JSON column.
 *
 * Each step is one of :
 *   { kind: 'wait', durationMs: number }     — pause before next step
 *   { kind: 'send', template: TemplateSlug,  — send a transactional mail
 *     payloadFromContext: string[] }           (vars picked from contextJson)
 *   { kind: 'stop_if', condition: ... }      — bail out conditionally (V2)
 *
 * The runner executes steps in order, advancing currentStep after each.
 * Wait steps are non-blocking : they set nextActionAt and the cron picks
 * up later.
 */
import { z } from 'zod';
import type { TemplateSlug } from '@/lib/mail/catalog';

export const waitStepSchema = z.object({
  kind: z.literal('wait'),
  durationMs: z.number().int().positive(),
  label: z.string().optional(),
});

export const sendStepSchema = z.object({
  kind: z.literal('send'),
  template: z.string() as z.ZodType<TemplateSlug>,
  // Which context keys map to template payload variables.
  // e.g. ['firstName', 'cartTotalMad'] → payload = { firstName: ctx.firstName, ... }
  payloadKeys: z.array(z.string()),
  label: z.string().optional(),
});

export const automationStepSchema = z.discriminatedUnion('kind', [
  waitStepSchema,
  sendStepSchema,
]);

export const automationStepsSchema = z.array(automationStepSchema);

export type AutomationStep = z.infer<typeof automationStepSchema>;
export type AutomationSteps = z.infer<typeof automationStepsSchema>;

export type AutomationContext = Record<string, unknown> & {
  recipientEmail: string;
};
