/**
 * Types Zod étendus pour AutomationStep V2 (M5.5).
 *
 * Discriminated union sur kind :
 *   wait, send (existants V1) +
 *   branch, tag, update_lead, webhook, wait_for_event (nouveaux)
 *
 * Cf. docs/emailing/admin-evolution/02-backend/06-automation-runner-v2.md
 */
import { z } from 'zod';
import { RulesGroupSchema } from '@/lib/mail/audiences/rules-types';

// ── Steps de base ────────────────────────────────────────────────────────

const WaitStepSchema = z.object({
  kind: z.literal('wait'),
  durationMs: z.number().int().min(0).max(90 * 86_400_000), // max 90j
  label: z.string().max(80).optional(),
});

const SendStepSchema = z.object({
  kind: z.literal('send'),
  template: z.string().min(1).max(120),
  payloadKeys: z.array(z.string().max(80)).max(50).optional(),
  varMappings: z.record(z.string(), z.string()).optional(),
});

// ── Branch (condition via RulesGroup réutilisé) ──────────────────────────

const BranchStepSchema: z.ZodType<{
  kind: 'branch';
  condition: z.infer<typeof RulesGroupSchema>;
  ifTrue: AutomationStep[];
  ifFalse: AutomationStep[];
}> = z.lazy(() =>
  z.object({
    kind: z.literal('branch'),
    condition: RulesGroupSchema,
    ifTrue: z.array(AutomationStepSchema).max(20),
    ifFalse: z.array(AutomationStepSchema).max(20),
  }),
);

// ── Tag (lead_tag) ───────────────────────────────────────────────────────

const TagStepSchema = z.object({
  kind: z.literal('tag'),
  action: z.enum(['add', 'remove']),
  tag: z.string().min(1).max(80),
});

// ── Update lead ──────────────────────────────────────────────────────────

const UpdateLeadStepSchema = z.object({
  kind: z.literal('update_lead'),
  field: z.enum(['status', 'source']),
  value: z.string().max(120),
});

// ── Webhook ──────────────────────────────────────────────────────────────

const WebhookStepSchema = z.object({
  kind: z.literal('webhook'),
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']),
  body: z.record(z.string(), z.unknown()).optional(),
});

// ── Wait for event ───────────────────────────────────────────────────────

const WaitForEventStepSchema = z.object({
  kind: z.literal('wait_for_event'),
  eventName: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9._]*$/),
  timeoutMs: z.number().int().min(60_000).max(30 * 86_400_000), // 1min - 30j
  onTimeout: z.enum(['continue', 'abort']).optional(),
});

// ── Discriminated union complète ─────────────────────────────────────────

// z.union (vs discriminatedUnion) car BranchStepSchema est ZodLazy
// (récursion via ifTrue/ifFalse[]). discriminatedUnion exige des ZodObjects
// directs avec un littéral 'kind' accessible à la construction.
export const AutomationStepSchema: z.ZodType<AutomationStep> = z.lazy(() =>
  z.union([
    WaitStepSchema,
    SendStepSchema,
    BranchStepSchema,
    TagStepSchema,
    UpdateLeadStepSchema,
    WebhookStepSchema,
    WaitForEventStepSchema,
  ]),
);

// TS types
export type AutomationStep =
  | z.infer<typeof WaitStepSchema>
  | z.infer<typeof SendStepSchema>
  | { kind: 'branch'; condition: z.infer<typeof RulesGroupSchema>; ifTrue: AutomationStep[]; ifFalse: AutomationStep[] }
  | z.infer<typeof TagStepSchema>
  | z.infer<typeof UpdateLeadStepSchema>
  | z.infer<typeof WebhookStepSchema>
  | z.infer<typeof WaitForEventStepSchema>;

export type StepKind = AutomationStep['kind'];

// ── Catalogue d'events disponibles pour wait_for_event + triggers ─────────

export const AUTOMATION_EVENT_CATALOG: ReadonlyArray<{
  name: string;
  category: 'lifecycle' | 'commerce' | 'email' | 'engagement' | 'form';
  description: string;
}> = [
  // Lifecycle
  { name: 'lead.created', category: 'lifecycle', description: 'Nouveau lead créé' },
  { name: 'lead.status_changed', category: 'lifecycle', description: 'Statut lead modifié' },
  // Commerce
  { name: 'cart.added', category: 'commerce', description: 'Ajout au panier' },
  { name: 'cart.abandoned', category: 'commerce', description: 'Panier abandonné' },
  { name: 'order.placed', category: 'commerce', description: 'Commande créée' },
  { name: 'order.delivered', category: 'commerce', description: 'Commande livrée' },
  // Email lifecycle
  { name: 'email.delivered', category: 'email', description: 'Email reçu (delivered)' },
  { name: 'email.opened', category: 'email', description: 'Email ouvert' },
  { name: 'email.clicked', category: 'email', description: 'Lien email cliqué' },
  { name: 'email.bounced_hard', category: 'email', description: 'Hard bounce' },
  { name: 'email.unsubscribed', category: 'email', description: 'Désinscription' },
  // Engagement web
  { name: 'page.viewed', category: 'engagement', description: 'Page vue' },
  { name: 'newsletter.subscribed', category: 'engagement', description: 'Inscription newsletter' },
  // Forms
  { name: 'contact.submitted', category: 'form', description: 'Formulaire contact soumis' },
];

export function isValidEventName(name: string): boolean {
  return AUTOMATION_EVENT_CATALOG.some((e) => e.name === name);
}
