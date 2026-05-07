# Validation Zod

## Convention

| Aspect | Règle |
|---|---|
| Emplacement | `apps/web/src/lib/schemas/*.ts` |
| Partage front/back | oui — un seul fichier, importé des deux côtés |
| Inférence de types | toujours via `z.infer<typeof schema>` |
| Messages | en français, ponctuation finale |
| Strictness | `.strict()` sur les objets racine |

## Modules

| Fichier | Schémas |
|---|---|
| `admin-auth.ts` | `adminLoginSchema` |
| `leads.ts` | `leadFiltersSchema`, `leadStatusEnum`, `changeStatusSchema`, `addNoteSchema`, `csvExportSchema` |
| `webhooks.ts` | `webhookEndpointInputSchema`, `eventNameEnum`, `customHeadersSchema`, `deliveryFiltersSchema` |
| `public-forms.ts` | `contactFormSchema`, `orderFormSchema`, `newsletterFormSchema`, `b2bFormSchema` |
| `shared.ts` | `cuidSchema`, `paginationSchema`, `dateRangeSchema`, `cityEnum` |

## Exemples

### Schéma partagé : pagination

```ts
// shared.ts
import { z } from 'zod';

export const cuidSchema = z.string().regex(/^[a-z0-9]{24}$/, 'Identifiant invalide.');

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'La date de début doit précéder la date de fin.', path: ['to'] },
);

export const cityEnum = z.enum([
  'casablanca', 'rabat', 'marrakech', 'fes', 'tanger',
  'agadir', 'meknes', 'oujda', 'kenitra', 'tetouan', 'autre',
]);
```

### Schéma de filtres leads

```ts
// leads.ts
import { z } from 'zod';
import { paginationSchema, dateRangeSchema, cityEnum } from './shared';

export const leadStatusEnum = z.enum([
  'new', 'in_progress', 'won', 'lost', 'spam',
]);
export const leadTypeEnum = z.enum([
  'contact', 'order', 'newsletter', 'b2b',
]);

export const leadFiltersSchema = z.object({
  type: leadTypeEnum.optional(),
  status: z.string().transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(leadStatusEnum)).optional(),
  city: cityEnum.optional(),
  q: z.string().max(80).optional(),
  sort: z.enum(['created_at', 'total']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  format: z.enum(['json', 'csv']).default('json'),
}).merge(paginationSchema).merge(dateRangeSchema);

export type LeadFilters = z.infer<typeof leadFiltersSchema>;
```

### Schéma de mutation : changement de statut

```ts
export const changeStatusSchema = z.object({
  status: leadStatusEnum,
  reason: z.string().max(280).optional(),
}).strict();
```

### Schéma webhook

```ts
// webhooks.ts
export const eventNameEnum = z.enum([
  'lead.created', 'order.created', 'order.paid',
  'newsletter.subscribed', 'b2b.requested', 'webhook.test',
]);

export const customHeadersSchema = z.array(
  z.object({
    key: z.string().regex(/^[A-Za-z0-9-]+$/, 'Clé invalide.'),
    value: z.string().max(200),
  }),
).max(5);

const httpsUrl = z.string().url().refine(
  (u) => process.env.NODE_ENV === 'development' || u.startsWith('https://'),
  'URL HTTPS requise.',
);

export const webhookEndpointInputSchema = z.object({
  name: z.string().min(1, 'Nom requis.').max(80),
  url: httpsUrl,
  events: z.array(eventNameEnum).min(1, 'Sélectionnez au moins un événement.'),
  description: z.string().max(500).optional(),
  customHeaders: customHeadersSchema.default([]),
  active: z.boolean().default(true),
}).strict();

export type WebhookEndpointInput = z.infer<typeof webhookEndpointInputSchema>;
```

## Parsing safe

Toujours `safeParse` côté API :

```ts
const parsed = leadFiltersSchema.safeParse(searchParams);
if (!parsed.success) {
  throw new HttpError('validation_failed', 400, parsed.error.issues.map(…));
}
const filters = parsed.data;
```

Côté front (react-hook-form), `zodResolver(schema)` fait le pont.

## Coerce avec discernement

| À utiliser | À éviter |
|---|---|
| `z.coerce.date()` pour params URL | `z.coerce.boolean()` (`'false'` devient `true`) |
| `z.coerce.number().int()` pour query | coercion implicite côté body JSON |

## Versioning des schémas

Pas de versioning v1 — l'API n'est pas publique. Tout breaking change
front/back est synchronisé en un seul commit.

## Tests

| Type | Fichier |
|---|---|
| Unit | `schemas/leads.test.ts`, `schemas/webhooks.test.ts`, `schemas/admin-auth.test.ts` |
