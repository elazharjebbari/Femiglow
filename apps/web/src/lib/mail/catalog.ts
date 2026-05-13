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
