/**
 * Email templates catalog — single source of truth.
 *
 * Adding a new template:
 *  1. Create `templates/<slug>.tsx`
 *  2. Define a Zod schema for its payload
 *  3. Register it here with `displayName`, `category`, `version`, `subjectFn`
 *  4. Add a seed entry in `email_template_meta` (migration M2-001)
 *  5. Cover it with snapshot tests in `__tests__/templates.test.ts`
 *
 * Cf. docs/emailing/07-templates-system.md §2.
 */
import { z } from 'zod';
import type { ComponentType } from 'react';

import ContactAcknowledgement from './templates/contact-acknowledgement';
import OrderConfirmation from './templates/order-confirmation';
import NewsletterConfirm from './templates/newsletter-confirm';
import LeadNotification from './templates/lead-notification';
import PasswordReset from './templates/password-reset';

// — Variable spec (drives wizard UI + validation) — — — — — — — — — — — — — —

export type VariableType = 'text' | 'url' | 'image-url' | 'number' | 'date' | 'dynamic';

export type VariableSpec = {
  name: string;
  type: VariableType;
  required: boolean;
  label: string;
  hint?: string;
  sample: string;
};

export type TemplateCategory = 'transactional' | 'broadcast' | 'automation';

export type TemplateMeta<TPayload extends Record<string, unknown>> = {
  slug: string;
  displayName: string;
  category: TemplateCategory;
  description: string;
  version: number;
  component: ComponentType<TPayload>;
  schema: z.ZodType<TPayload>;
  subjectFn: (p: TPayload) => string;
  preheaderFn?: (p: TPayload) => string;
  sampleData: TPayload;
  variables: VariableSpec[];
};

// — Schemas — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

const ContactAckPayload = z.object({
  firstName: z.string().min(1).max(80),
  messageExcerpt: z.string().min(1).max(500),
});

const OrderConfirmationPayload = z.object({
  firstName: z.string().min(1).max(80),
  orderId: z.string().min(1),
  orderTotal: z.string().min(1), // formatted MAD
  itemsCount: z.number().int().positive(),
  deliveryEstimate: z.string().min(1),
});

const NewsletterConfirmPayload = z.object({
  confirmUrl: z.string().url(),
});

const LeadNotificationPayload = z.object({
  leadName: z.string().min(1).max(80),
  leadPhone: z.string().min(1).max(40),
  leadEmail: z.string().email().nullable(),
  intent: z.string().min(1).max(80),
  outcomeContext: z.string().min(1).max(2000),
  adminUrl: z.string().url(),
});

const PasswordResetPayload = z.object({
  firstName: z.string().min(1).max(80),
  resetUrl: z.string().url(),
  expiresInMinutes: z.number().int().positive(),
});

// — Registry — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const TEMPLATE_REGISTRY = {
  'contact-acknowledgement': {
    slug: 'contact-acknowledgement',
    displayName: 'Accusé de contact',
    category: 'transactional',
    description: 'Envoyé après soumission du formulaire de contact.',
    version: 1,
    component: ContactAcknowledgement,
    schema: ContactAckPayload,
    subjectFn: (p) => `Bonjour ${p.firstName}, on a bien reçu ton message`,
    preheaderFn: (p) => `On revient vers toi sous 24h ouvrées, ${p.firstName}.`,
    sampleData: { firstName: 'Souheila', messageExcerpt: 'Bonjour, je voudrais en savoir plus sur les rituels...' },
    variables: [
      { name: 'firstName', type: 'dynamic', required: true, label: 'Prénom', sample: 'Souheila' },
      { name: 'messageExcerpt', type: 'text', required: true, label: 'Extrait message', sample: '...' },
    ],
  },
  'order-confirmation': {
    slug: 'order-confirmation',
    displayName: 'Confirmation de commande',
    category: 'transactional',
    description: 'Envoyé immédiatement après création d\'une commande validée.',
    version: 1,
    component: OrderConfirmation,
    schema: OrderConfirmationPayload,
    subjectFn: (p) => `Ta commande ${p.orderId} est confirmée ✨`,
    preheaderFn: (p) => `${p.itemsCount} article(s) · livraison ${p.deliveryEstimate}`,
    sampleData: {
      firstName: 'Souheila',
      orderId: 'FG-20260513-001',
      orderTotal: '390 MAD',
      itemsCount: 2,
      deliveryEstimate: '2-4 jours ouvrés',
    },
    variables: [
      { name: 'firstName', type: 'dynamic', required: true, label: 'Prénom', sample: 'Souheila' },
      { name: 'orderId', type: 'text', required: true, label: 'N° commande', sample: 'FG-20260513-001' },
      { name: 'orderTotal', type: 'text', required: true, label: 'Total', sample: '390 MAD' },
      { name: 'itemsCount', type: 'number', required: true, label: 'Nombre d\'articles', sample: '2' },
      { name: 'deliveryEstimate', type: 'text', required: true, label: 'Délai livraison', sample: '2-4 jours' },
    ],
  },
  'newsletter-confirm': {
    slug: 'newsletter-confirm',
    displayName: 'Newsletter — double opt-in',
    category: 'transactional',
    description: 'Confirmation de l\'inscription à la newsletter (RFC RGPD double opt-in).',
    version: 1,
    component: NewsletterConfirm,
    schema: NewsletterConfirmPayload,
    subjectFn: () => 'Confirme ton inscription à la newsletter FemiGlow',
    preheaderFn: () => 'Plus qu\'un clic pour rejoindre la newsletter.',
    sampleData: { confirmUrl: 'https://femiglow-maroc.com/newsletter/confirm?t=…' },
    variables: [
      { name: 'confirmUrl', type: 'url', required: true, label: 'URL de confirmation', sample: 'https://femiglow-maroc.com/newsletter/confirm?t=…' },
    ],
  },
  'lead-notification': {
    slug: 'lead-notification',
    displayName: 'Notification lead chat (admin)',
    category: 'transactional',
    description: 'Notification interne envoyée à l\'équipe quand un visiteur laisse ses coordonnées via le chat.',
    version: 1,
    component: LeadNotification,
    schema: LeadNotificationPayload,
    subjectFn: (p) => `🔥 Nouveau lead chat — ${p.leadName} (${p.leadPhone})`,
    preheaderFn: (p) => `${p.leadName} a laissé son numéro à recontacter.`,
    sampleData: {
      leadName: 'Souheila',
      leadPhone: '+212 6 12 34 56 78',
      leadEmail: 'souheila@example.com',
      intent: 'achat-rituels',
      outcomeContext: 'user: Bonjour\\nassistant: Bonjour ✨ comment puis-je t\'aider ?',
      adminUrl: 'https://admin.femiglow-maroc.com/admin/leads/123',
    },
    variables: [
      { name: 'leadName', type: 'text', required: true, label: 'Prénom lead', sample: 'Souheila' },
      { name: 'leadPhone', type: 'text', required: true, label: 'Téléphone', sample: '+212 6 12 34 56 78' },
      { name: 'leadEmail', type: 'text', required: false, label: 'Email (optionnel)', sample: 'souheila@example.com' },
      { name: 'intent', type: 'text', required: true, label: 'Intent', sample: 'achat-rituels' },
      { name: 'outcomeContext', type: 'text', required: true, label: 'Contexte chat', sample: '...' },
      { name: 'adminUrl', type: 'url', required: true, label: 'URL admin', sample: 'https://admin.femiglow-maroc.com/admin/leads/123' },
    ],
  },
  'password-reset': {
    slug: 'password-reset',
    displayName: 'Réinitialisation mot de passe',
    category: 'transactional',
    description: 'Envoyé sur demande de reset password (admin/user). Lien à durée limitée.',
    version: 1,
    component: PasswordReset,
    schema: PasswordResetPayload,
    subjectFn: () => 'Réinitialise ton mot de passe FemiGlow',
    preheaderFn: (p) => `Lien valable ${p.expiresInMinutes} minutes.`,
    sampleData: {
      firstName: 'Souheila',
      resetUrl: 'https://admin.femiglow-maroc.com/auth/reset?token=abc123',
      expiresInMinutes: 30,
    },
    variables: [
      { name: 'firstName', type: 'dynamic', required: true, label: 'Prénom', sample: 'Souheila' },
      { name: 'resetUrl', type: 'url', required: true, label: 'URL de reset', sample: 'https://admin.femiglow-maroc.com/auth/reset?token=…' },
      { name: 'expiresInMinutes', type: 'number', required: true, label: 'Durée validité (min)', sample: '30' },
    ],
  },
} as const satisfies Record<string, TemplateMeta<any>>;

export type TemplateSlug = keyof typeof TEMPLATE_REGISTRY;

export type TemplateRegistry = {
  [K in TemplateSlug]: z.infer<(typeof TEMPLATE_REGISTRY)[K]['schema']>;
};

export function getTemplateMeta<S extends TemplateSlug>(slug: S): (typeof TEMPLATE_REGISTRY)[S] {
  const meta = TEMPLATE_REGISTRY[slug];
  if (!meta) throw new Error(`Unknown template slug: ${slug}`);
  return meta;
}

export function isKnownTemplate(slug: string): slug is TemplateSlug {
  return slug in TEMPLATE_REGISTRY;
}
