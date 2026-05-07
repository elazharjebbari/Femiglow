# B2 — Validation Zod et sanitization

## Contrat

> Toute valeur entrant via l'API admin est validée par un schéma Zod
> **typé selon le `FieldType`** du champ et **paramétré par
> `ComponentFieldDefinition.config`**. Aucun code custom de validation,
> aucune trust dans le client.

Les schémas vivent dans `@/lib/schemas/admin/component-fields/`.

## Architecture des schémas

```
lib/schemas/admin/component-fields/
├── envelope.ts            ← payloads des routes (PATCH, schedule, …)
├── values/                ← un schéma par FieldType (la valeur encodée)
│   ├── text.ts
│   ├── multiline.ts
│   ├── rich-text.ts
│   ├── cta.ts
│   ├── link.ts
│   ├── icon.ts
│   ├── color-token.ts
│   ├── number.ts
│   ├── boolean.ts
│   ├── enum.ts
│   ├── list.ts
│   ├── record.ts
│   ├── kicker.ts
│   ├── quote.ts
│   └── breadcrumb-segment.ts
├── primitives.ts          ← hrefSchema, iconKeySchema, colorTokenSchema, …
└── validate-field-value.ts ← entrypoint qui dispatch sur le FieldType
```

## Payload PATCH (envelope)

```ts
// apps/web/src/lib/schemas/admin/component-fields/envelope.ts
import { z } from 'zod';

export const fieldPatchSchema = z.object({
  /** La valeur typée (validée séparément contre fieldDef). */
  value: z.unknown(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('fr'),
});

export const fieldScheduleSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true })
    .refine((s) => new Date(s).getTime() > Date.now() + 60_000, {
      message: 'La date doit être au moins 1 minute dans le futur',
    }),
});

export const fieldRestoreSchema = z.object({
  historyId: z.string().regex(/^cfh_[a-zA-Z0-9_-]+$/),
});
```

## Primitives partagées

```ts
// apps/web/src/lib/schemas/admin/component-fields/primitives.ts
import { z } from 'zod';
import { ALLOWED_HOSTS } from '@/lib/config/allowed-hosts';
import { REGISTERED_ICONS } from '@/lib/icons/registry';
import { COLOR_TOKENS } from '@/lib/tokens/colors';

/** href : relatif (/…), mailto:, tel:, ou https vers un host allowlisté. */
export const hrefSchema = z.string().min(1).max(500).refine((href) => {
  if (href.startsWith('/')) return true;
  if (href.startsWith('#')) return true;
  if (href.startsWith('mailto:')) return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href);
  if (href.startsWith('tel:')) return /^tel:\+?[0-9 ()-]{6,}$/.test(href);
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && ALLOWED_HOSTS.includes(url.host);
  } catch {
    return false;
  }
}, { message: "L'URL doit être relative ou pointer vers un domaine autorisé en HTTPS" });

/** Clé d'icône limitée au registre actuel. */
export const iconKeySchema = z.enum(
  REGISTERED_ICONS as [string, ...string[]],
  { errorMap: () => ({ message: 'Icône inconnue' }) },
);

/** Token couleur défini dans tokens.css. */
export const colorTokenSchema = z.enum(
  COLOR_TOKENS as [string, ...string[]],
  { errorMap: () => ({ message: 'Token couleur inconnu' }) },
);

/** Variantes CTA autorisées globalement (peut être restreint par config). */
export const ctaVariantSchema = z.enum(['primary', 'secondary', 'ghost', 'inline']);
```

## Schémas par `FieldType`

Chaque schéma est exposé sous forme de **factory** qui prend la
`config` du field et renvoie le `ZodType` final.

### text

```ts
// values/text.ts
import { z } from 'zod';
import type { FieldTypeConfig } from '@/lib/components/registry';

export const textValueSchema = (cfg: FieldTypeConfig | undefined): z.ZodType<{ v: string }> => {
  let s = z.string();
  if (cfg?.minLength != null) s = s.min(cfg.minLength, `Minimum ${cfg.minLength} caractères`);
  if (cfg?.maxLength != null) s = s.max(cfg.maxLength, `Maximum ${cfg.maxLength} caractères`);
  return z.object({ v: s });
};
```

### multiline

```ts
// values/multiline.ts (idem text mais sans contrainte « pas de \n »)
export const multilineValueSchema = (cfg: FieldTypeConfig | undefined) => {
  let s = z.string();
  if (cfg?.minLength != null) s = s.min(cfg.minLength);
  if (cfg?.maxLength != null) s = s.max(cfg.maxLength);
  return z.object({ v: s });
};
```

### rich-text (avec sanitization)

```ts
// values/rich-text.ts
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import type { FieldTypeConfig } from '@/lib/components/registry';

const DEFAULT_ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'br'];
const DEFAULT_SCHEMES: Array<'http' | 'https' | 'mailto' | 'tel'> = ['https', 'mailto', 'tel'];

export const richTextValueSchema = (cfg: FieldTypeConfig | undefined) => {
  return z.object({
    v: z.string().min(1).max(cfg?.maxLength ?? 5000),
  }).transform((data, ctx) => {
    // 1. Markdown → HTML
    const rawHtml = marked.parse(data.v, { async: false }) as string;
    // 2. Sanitization stricte
    const cleanHtml = sanitizeHtml(rawHtml, {
      allowedTags: cfg?.allowedTags ?? DEFAULT_ALLOWED_TAGS,
      allowedAttributes: { a: ['href', 'target', 'rel'] },
      allowedSchemes: cfg?.allowedHrefSchemes ?? DEFAULT_SCHEMES,
      transformTags: {
        a: (tag, attribs) => ({
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer',
            ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
          },
        }),
      },
    });
    // 3. Si différence substantielle → tentative XSS
    if (lengthDiff(rawHtml, cleanHtml) > 0.2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le contenu rich-text contient des balises non autorisées',
      });
      return z.NEVER;
    }
    // On stocke le **markdown source** (pas le HTML), le rendu re-sanitize.
    return { v: data.v };
  });
};

function lengthDiff(a: string, b: string): number {
  return Math.abs(a.length - b.length) / Math.max(a.length, 1);
}
```

> On stocke le markdown source, pas le HTML rendu. Le rendu côté RSC
> ré-applique `marked + sanitize-html` (défense en profondeur, cf. A6).

### cta (discriminated par variant)

```ts
// values/cta.ts
import { z } from 'zod';
import { hrefSchema, iconKeySchema, ctaVariantSchema } from '../primitives';
import type { FieldTypeConfig } from '@/lib/components/registry';

export const ctaValueSchema = (cfg: FieldTypeConfig | undefined) => {
  const allowedVariants = cfg?.variants ?? ['primary', 'secondary', 'ghost', 'inline'];
  return z.object({
    label: z.string().min(1, 'Label requis').max(60),
    href: hrefSchema,
    variant: z.enum(allowedVariants as [string, ...string[]]).optional(),
    icon: iconKeySchema.optional(),
  });
};
```

### link

```ts
// values/link.ts
import { z } from 'zod';
import { hrefSchema } from '../primitives';

export const linkValueSchema = () =>
  z.object({
    href: hrefSchema,
    label: z.string().min(1).max(80).optional(),
    external: z.boolean().optional(),
  });
```

### icon

```ts
// values/icon.ts
import { z } from 'zod';
import { iconKeySchema } from '../primitives';

export const iconValueSchema = () => z.object({ v: iconKeySchema });
```

### color-token

```ts
// values/color-token.ts
import { z } from 'zod';
import { colorTokenSchema } from '../primitives';
import type { FieldTypeConfig } from '@/lib/components/registry';

export const colorTokenValueSchema = (cfg: FieldTypeConfig | undefined) => {
  // Si tokenSet est restreint, on filtre l'enum (ex 'background' ne contient que les tokens BG).
  if (cfg?.tokenSet && cfg.tokenSet !== 'all') {
    const filtered = COLOR_TOKENS.filter((t) => /* logique tokenSet */ true);
    return z.object({ v: z.enum(filtered as [string, ...string[]]) });
  }
  return z.object({ v: colorTokenSchema });
};
```

### number

```ts
// values/number.ts
import { z } from 'zod';
import type { FieldTypeConfig } from '@/lib/components/registry';

export const numberValueSchema = (cfg: FieldTypeConfig | undefined) => {
  let n = z.number();
  if (cfg?.min != null) n = n.min(cfg.min);
  if (cfg?.max != null) n = n.max(cfg.max);
  if (cfg?.step != null) {
    n = n.refine((v) => Math.abs((v - (cfg.min ?? 0)) % cfg.step!) < 1e-9, {
      message: `Doit être un multiple de ${cfg.step}`,
    });
  }
  return z.object({ v: n });
};
```

### boolean

```ts
// values/boolean.ts
export const booleanValueSchema = () => z.object({ v: z.boolean() });
```

### enum

```ts
// values/enum.ts
import { z } from 'zod';
import type { FieldTypeConfig } from '@/lib/components/registry';

export const enumValueSchema = (cfg: FieldTypeConfig | undefined) => {
  if (!cfg?.options?.length) {
    throw new Error('FieldDefinition enum requires config.options');
  }
  return z.object({
    v: z.enum(cfg.options.map((o) => o.value) as [string, ...string[]]),
  });
};
```

### list (récursif)

```ts
// values/list.ts
import { z } from 'zod';
import type { FieldTypeConfig } from '@/lib/components/registry';
import { schemaForType } from './dispatch';

export const listValueSchema = (cfg: FieldTypeConfig | undefined) => {
  if (!cfg?.itemType) throw new Error('FieldDefinition list requires config.itemType');
  let items = z.array(schemaForType(cfg.itemType, cfg.itemConfig));
  if (cfg.minItems != null) items = items.min(cfg.minItems);
  if (cfg.maxItems != null) items = items.max(cfg.maxItems);
  return z.object({ items });
};
```

### record (z.discriminatedUnion sur les sous-shapes)

```ts
// values/record.ts
import { z } from 'zod';
import type { FieldTypeConfig } from '@/lib/components/registry';
import { schemaForType } from './dispatch';

export const recordValueSchema = (cfg: FieldTypeConfig | undefined) => {
  if (!cfg?.shape) throw new Error('FieldDefinition record requires config.shape');
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, sub] of Object.entries(cfg.shape)) {
    let s = schemaForType(sub.type, sub.config);
    if (!sub.required) s = s.optional();
    shape[key] = s;
  }
  return z.object({ fields: z.object(shape) });
};
```

> Pour les *records polymorphes* (ex un slot qui peut être `cta` OU
> `link`), on utilise `z.discriminatedUnion('kind', [...])`. Convention :
> chaque variant porte une clef `kind` côté `value`.

```ts
const slotSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cta'), data: ctaValueSchema(undefined) }),
  z.object({ kind: z.literal('link'), data: linkValueSchema() }),
]);
```

### kicker / quote / breadcrumb-segment

```ts
// values/kicker.ts — alias text
export const kickerValueSchema = (cfg: FieldTypeConfig | undefined) =>
  textValueSchema({ ...cfg, maxLength: cfg?.maxLength ?? 40 });

// values/quote.ts
export const quoteValueSchema = () =>
  z.object({
    text: z.string().min(1).max(500),
    author: z.string().min(1).max(80),
  });

// values/breadcrumb-segment.ts
export const breadcrumbSegmentValueSchema = () =>
  z.object({
    label: z.string().min(1).max(40),
    href: hrefSchema,
  });
```

## Dispatch

```ts
// apps/web/src/lib/schemas/admin/component-fields/values/dispatch.ts
import type { FieldType, FieldTypeConfig } from '@/lib/components/registry';
import { textValueSchema } from './text';
import { multilineValueSchema } from './multiline';
import { richTextValueSchema } from './rich-text';
import { ctaValueSchema } from './cta';
import { linkValueSchema } from './link';
import { iconValueSchema } from './icon';
import { colorTokenValueSchema } from './color-token';
import { numberValueSchema } from './number';
import { booleanValueSchema } from './boolean';
import { enumValueSchema } from './enum';
import { listValueSchema } from './list';
import { recordValueSchema } from './record';
import { kickerValueSchema } from './kicker';
import { quoteValueSchema } from './quote';
import { breadcrumbSegmentValueSchema } from './breadcrumb-segment';

export function schemaForType(type: FieldType, cfg: FieldTypeConfig | undefined) {
  switch (type) {
    case 'text': return textValueSchema(cfg);
    case 'multiline': return multilineValueSchema(cfg);
    case 'rich-text': return richTextValueSchema(cfg);
    case 'cta': return ctaValueSchema(cfg);
    case 'link': return linkValueSchema();
    case 'icon': return iconValueSchema();
    case 'color-token': return colorTokenValueSchema(cfg);
    case 'number': return numberValueSchema(cfg);
    case 'boolean': return booleanValueSchema();
    case 'enum': return enumValueSchema(cfg);
    case 'list': return listValueSchema(cfg);
    case 'record': return recordValueSchema(cfg);
    case 'kicker': return kickerValueSchema(cfg);
    case 'quote': return quoteValueSchema();
    case 'breadcrumb-segment': return breadcrumbSegmentValueSchema();
  }
}
```

## Entrypoint pour les routes

```ts
// apps/web/src/lib/components/field-validation.ts
import type { ComponentFieldDefinition } from '@/lib/components/registry';
import { schemaForType } from '@/lib/schemas/admin/component-fields/values/dispatch';
import { normalizeZodError } from './zod-error-fr';

export type ValidationResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: { message: string; details: Array<{ path: string; message: string }> } };

export function validateFieldValue(
  raw: unknown,
  fieldDef: ComponentFieldDefinition,
): ValidationResult {
  const schema = schemaForType(fieldDef.type, fieldDef.config);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, error: normalizeZodError(parsed.error, fieldDef) };
}
```

## Normalisation des erreurs (FR)

```ts
// apps/web/src/lib/components/zod-error-fr.ts
import { ZodError, ZodIssueCode } from 'zod';
import type { ComponentFieldDefinition } from '@/lib/components/registry';

const DEFAULT_MESSAGES_FR: Record<string, string> = {
  required: 'Ce champ est requis',
  too_small: 'Valeur trop courte',
  too_big: 'Valeur trop longue',
  invalid_type: 'Type invalide',
  invalid_string: 'Format invalide',
  invalid_enum_value: 'Valeur non autorisée',
};

export function normalizeZodError(err: ZodError, fieldDef: ComponentFieldDefinition) {
  const details = err.issues.map((iss) => ({
    path: iss.path.join('.') || 'value',
    message: iss.message || DEFAULT_MESSAGES_FR[iss.code as string] || 'Valeur invalide',
  }));
  // Premier message FR pour le toast utilisateur.
  const headline = details[0]?.message ?? 'Validation échouée';
  return {
    message: `${fieldDef.label} : ${headline}`,
    details,
  };
}
```

Le serveur renvoie `details` dans la réponse `422` (cf. B1) ; l'UI
(F1/F3) les affiche par champ via la prop `error`.

## Sanitize-html — réglages détaillés

```ts
// apps/web/src/lib/sanitize/rich-text.ts
import sanitizeHtml from 'sanitize-html';

export const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'br'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
  transformTags: {
    a: (tag, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
      },
    }),
  },
};
```

Aucun `img`, `script`, `iframe`, `style`, `class`. Pas de
`data-*`. Pas d'attributs `on*`.

## Tests dédiés

| Test | Sujet |
|---|---|
| `text-value.spec.ts` | minLength/maxLength |
| `cta-value.spec.ts` | href allowlist, variant restriction par config |
| `rich-text.spec.ts` | XSS injection (script, onerror, javascript:), markdown valide |
| `list-record.spec.ts` | récursivité, minItems/maxItems |
| `href.spec.ts` (primitives) | https vs http, allowlist hosts, tel, mailto |
| `icon-key.spec.ts` | enum strict, casse |
| `dispatch.spec.ts` | tous les FieldType ont un schéma |

Cf. T2 (matrice détaillée).

## Cross-références

- A2 : encodage `value` jsonb.
- A6 : sécurité, sanitization, allowlist hosts.
- B1 : routes consommatrices.
- F1 : éditeurs producteurs (mêmes conventions).
