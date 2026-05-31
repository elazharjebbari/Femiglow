# Content translation — CMS multilingue

> Comment gérer la traduction du **contenu dynamique** (CMS), en distinction des strings UI statiques. Couvre l'extension de `component_field_bindings`, l'UI admin pour saisir par langue, le fallback locale par champ, la validation Drizzle, et le workflow founder → traducteur → admin.

## 1. Périmètre du content translation

### 1.1 Contenu CMS vs strings UI

| Type | Stockage | Édition | Exemples |
|---|---|---|---|
| **Strings UI** | `messages/[locale].json` | Dev + traducteur via PR | `common.back`, `marketing.hero.cta`, `errors.404.title` |
| **Content CMS** | `component_field_bindings` | Admin via `/admin/cms` (no deploy) | Hero title, kit bullets, testimonials, sections marketing |
| **Pages légales** | `legal_pages` | Admin via `/admin/legal` | CGV, mentions, confidentialité (markdown long) |
| **SEO overrides** | `seo_overrides` | Admin via `/admin/seo` | Override d'un `<title>` ou `<meta>` ponctuel |
| **Articles journal** | `journal_articles` (à confirmer) | Admin via `/admin/journal` | Articles éditoriaux |
| **Wizard checkout** | `WizardDictionary` (CHA-231) | Dev | Labels, hints, validation |

### 1.2 Pourquoi cette séparation

- Les **strings UI** changent rarement (cycles dev). Stockage code-as-config en JSON, contrôlé par PR.
- Le **contenu CMS** change quotidiennement (campagnes, A/B test, mise à jour produit). Stockage DB, édité sans deploy.
- Les **pages légales** sont longues, markdown, avec versioning fort (CGV peuvent évoluer trimestriellement).

## 2. Schema `component_field_bindings` (déjà multilingue-ready)

### 2.1 Structure actuelle

```ts
// apps/web/src/lib/db/schema/cms.ts
import { pgTable, uuid, text, jsonb, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const componentFieldBindings = pgTable('component_field_bindings', {
  componentId: uuid('component_id').notNull(),
  fieldKey: text('field_key').notNull(),
  locale: text('locale').notNull().default('fr'),
  value: jsonb('value').notNull(),
  status: text('status').notNull().default('draft').$type<'draft' | 'published' | 'archived'>(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  pk: primaryKey({ columns: [table.componentId, table.fieldKey, table.locale] }),
  idxComponent: index('idx_cfb_component').on(table.componentId, table.locale),
  idxStatus: index('idx_cfb_status').on(table.status),
}));
```

### 2.2 Données exemples

| component_id | field_key | locale | value (jsonb) | status | updated_at |
|---|---|---|---|---|---|
| `hero-page-home` | `title` | `fr` | `"Le rituel ongles, en 5 minutes."` | published | 2026-05-27 |
| `hero-page-home` | `title` | `ar` | `"طقوس الأظافر في خمس دقائق."` | published | 2026-05-26 |
| `hero-page-home` | `title` | `en` | `"Nail ritual, in five minutes."` | published | 2026-05-20 |
| `hero-page-home` | `subtitle` | `fr` | `"Trois gestes, une saison."` | published | 2026-05-27 |
| `hero-page-home` | `subtitle` | `ar` | `null` | — | — |
| `hero-page-home` | `bullets` | `fr` | `["Geste 1", "Geste 2", "Geste 3"]` | published | 2026-05-27 |

→ Pour `subtitle@ar` manquant, on fallback sur FR (cf. § 4).

### 2.3 Migration des bindings existants

```sql
-- Migration : assurer que tous les bindings existants ont locale = 'fr'
UPDATE component_field_bindings
SET locale = 'fr'
WHERE locale IS NULL OR locale = '';

-- Backfill : créer un binding draft AR pour chaque binding FR publié (à traduire)
INSERT INTO component_field_bindings (component_id, field_key, locale, value, status, updated_by, updated_at)
SELECT
  component_id,
  field_key,
  'ar' AS locale,
  value, -- copie de la valeur FR comme placeholder
  'draft' AS status,
  'system-migration' AS updated_by,
  NOW() AS updated_at
FROM component_field_bindings
WHERE locale = 'fr'
  AND status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM component_field_bindings cfb2
    WHERE cfb2.component_id = component_field_bindings.component_id
    AND cfb2.field_key = component_field_bindings.field_key
    AND cfb2.locale = 'ar'
  );

-- Idem pour 'en'
-- ...
```

→ Détaillé dans [`06-data-strategy/migration-data.md`](../06-data-strategy/migration-data.md).

## 3. Repository pattern avec fallback

### 3.1 Repo principal

```ts
// apps/web/src/lib/cms/repos/component-binding.repo.ts
import { db } from '@/lib/db';
import { componentFieldBindings } from '@/lib/db/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getLocaleConfig } from '@/lib/i18n/locales';
import type { Locale } from '@/i18n.config';

export interface CmsBindings {
  [fieldKey: string]: unknown;
}

/**
 * Récupère tous les bindings d'un composant pour une locale donnée,
 * avec fallback automatique sur la locale parent.
 *
 * Cache : 5 min, invalidé sur revalidateTag(`cms-component-${componentId}`)
 */
export function getCmsBindings(componentId: string, locale: Locale): Promise<CmsBindings> {
  return unstable_cache(
    async () => {
      const localeConfig = await getLocaleConfig(locale);
      const fallback = localeConfig.fallbackLocale ?? 'fr';
      const localesToFetch = locale === fallback ? [locale] : [locale, fallback];

      // Une seule query couvrant les 2 locales
      const rows = await db
        .select({
          fieldKey: componentFieldBindings.fieldKey,
          locale: componentFieldBindings.locale,
          value: componentFieldBindings.value,
        })
        .from(componentFieldBindings)
        .where(and(
          eq(componentFieldBindings.componentId, componentId),
          inArray(componentFieldBindings.locale, localesToFetch),
          eq(componentFieldBindings.status, 'published'),
        ));

      // Merge : fallback d'abord, locale demandée écrase
      const result: CmsBindings = {};
      for (const r of rows.filter(r => r.locale === fallback)) {
        result[r.fieldKey] = r.value;
      }
      for (const r of rows.filter(r => r.locale === locale)) {
        result[r.fieldKey] = r.value;
      }

      return result;
    },
    [`cms-bindings`, componentId, locale],
    {
      revalidate: 300,
      tags: [
        `cms-component-${componentId}`,
        `cms-component-${componentId}-${locale}`,
        `i18n-${locale}`,
      ],
    },
  )();
}
```

### 3.2 Repo "per-field" pour fallback granulaire

Si on veut savoir QUEL champ a été fallbackisé (pour afficher un badge admin) :

```ts
export interface CmsBindingWithSource {
  fieldKey: string;
  value: unknown;
  effectiveLocale: Locale;  // 'ar' si trouvé, 'fr' si fallback
  isFallback: boolean;
}

export async function getCmsBindingsWithSource(
  componentId: string,
  locale: Locale,
): Promise<CmsBindingWithSource[]> {
  const localeConfig = await getLocaleConfig(locale);
  const fallback = localeConfig.fallbackLocale ?? 'fr';

  const rows = await db
    .select()
    .from(componentFieldBindings)
    .where(and(
      eq(componentFieldBindings.componentId, componentId),
      inArray(componentFieldBindings.locale, locale === fallback ? [locale] : [locale, fallback]),
      eq(componentFieldBindings.status, 'published'),
    ));

  const byField = new Map<string, typeof rows[number][]>();
  for (const r of rows) {
    const arr = byField.get(r.fieldKey) ?? [];
    arr.push(r);
    byField.set(r.fieldKey, arr);
  }

  const result: CmsBindingWithSource[] = [];
  for (const [fieldKey, versions] of byField) {
    const direct = versions.find(v => v.locale === locale);
    const fb = versions.find(v => v.locale === fallback);

    if (direct) {
      result.push({ fieldKey, value: direct.value, effectiveLocale: locale, isFallback: false });
    } else if (fb) {
      result.push({ fieldKey, value: fb.value, effectiveLocale: fallback as Locale, isFallback: true });
    }
  }

  return result;
}
```

### 3.3 Upsert avec audit

```ts
// apps/web/src/lib/cms/services/binding.service.ts
import { db } from '@/lib/db';
import { componentFieldBindings } from '@/lib/db/schema';
import { revalidateTag } from 'next/cache';
import { auditLog } from '@/lib/audit/log';

export async function upsertBinding(input: {
  componentId: string;
  fieldKey: string;
  locale: Locale;
  value: unknown;
  status: 'draft' | 'published';
  actor: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Upsert
    await tx
      .insert(componentFieldBindings)
      .values({
        componentId: input.componentId,
        fieldKey: input.fieldKey,
        locale: input.locale,
        value: input.value,
        status: input.status,
        updatedBy: input.actor,
        updatedAt: new Date(),
        publishedAt: input.status === 'published' ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [
          componentFieldBindings.componentId,
          componentFieldBindings.fieldKey,
          componentFieldBindings.locale,
        ],
        set: {
          value: input.value,
          status: input.status,
          updatedBy: input.actor,
          updatedAt: new Date(),
          publishedAt: input.status === 'published' ? new Date() : null,
        },
      });

    // 2. Audit
    await auditLog({
      actor: input.actor,
      action: 'cms.binding.upsert',
      target: `${input.componentId}:${input.fieldKey}@${input.locale}`,
      metadata: { status: input.status, value: input.value },
    });
  });

  // 3. Invalidate caches
  revalidateTag(`cms-component-${input.componentId}`);
  revalidateTag(`i18n-${input.locale}`);
}
```

### 3.4 Bulk operations (copie depuis FR vers AR pour traduire)

```ts
// apps/web/src/lib/cms/services/bulk.service.ts
export async function cloneBindingsForLocale(
  componentId: string,
  sourceLocale: Locale,
  targetLocale: Locale,
  actor: string,
): Promise<{ created: number; skipped: number }> {
  const source = await db
    .select()
    .from(componentFieldBindings)
    .where(and(
      eq(componentFieldBindings.componentId, componentId),
      eq(componentFieldBindings.locale, sourceLocale),
    ));

  let created = 0;
  let skipped = 0;

  for (const row of source) {
    // Vérifier si déjà présent pour la target locale
    const [existing] = await db
      .select()
      .from(componentFieldBindings)
      .where(and(
        eq(componentFieldBindings.componentId, componentId),
        eq(componentFieldBindings.fieldKey, row.fieldKey),
        eq(componentFieldBindings.locale, targetLocale),
      ))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(componentFieldBindings).values({
      componentId: row.componentId,
      fieldKey: row.fieldKey,
      locale: targetLocale,
      value: row.value, // Copie brute, à traduire ensuite
      status: 'draft',  // Toujours draft : nécessite revue traducteur
      updatedBy: actor,
      updatedAt: new Date(),
    });
    created++;
  }

  await auditLog({
    actor,
    action: 'cms.binding.bulk_clone',
    target: `${componentId}:${sourceLocale}->${targetLocale}`,
    metadata: { created, skipped },
  });

  revalidateTag(`cms-component-${componentId}`);

  return { created, skipped };
}
```

## 4. Fallback strategy

### 4.1 Chain configurable

Comportement par défaut :
```
locale demandée (ex: ar)
  ↓ (binding manquant)
i18n_locales.fallback_locale (ex: fr)
  ↓ (binding manquant)
DEFAULT_LOCALE (fr)
  ↓ (binding manquant)
NULL → afficher placeholder ou retourner string vide
```

### 4.2 Surfaces de fallback

| Niveau | Endroit |
|---|---|
| **API repo** | `getCmsBindings` merge silencieusement avec fallback |
| **Page rendering** | Si une key reste `undefined`, fallback string UI via `t('default_xxx')` |
| **Admin UI** | Badge "Traduit depuis FR" si fallback (cf. § 5.4) |

### 4.3 Log + alerts

Quand on sert un fallback en production, logger :

```ts
if (isFallback) {
  logger.info('cms.fallback_served', {
    componentId,
    fieldKey,
    requestedLocale: locale,
    servedLocale: fallback,
  });
}
```

Dashboard `/admin/cms/coverage` :
- Liste les composants × locales avec fallback actif
- Permet à l'admin de prioriser les traductions

## 5. UI Admin — Saisie par langue

### 5.1 Layout `/admin/cms/[componentId]`

```tsx
// apps/web/src/app/admin/cms/[componentId]/page.tsx
import { getCmsBindingsAdmin } from '@/lib/cms/repos/admin-binding.repo';
import { BindingEditorByLocale } from '@/components/admin/cms/binding-editor-by-locale';
import { LOCALES } from '@/i18n.config';

export default async function CmsComponentPage({
  params: { componentId },
}: {
  params: { componentId: string };
}) {
  // Récupère TOUS les bindings, draft + published, toutes locales
  const all = await getCmsBindingsAdmin(componentId);

  return (
    <main>
      <h1>Edit component {componentId}</h1>

      <BindingEditorByLocale
        componentId={componentId}
        bindings={all}
        locales={LOCALES}
      />
    </main>
  );
}
```

### 5.2 Composant éditeur

```tsx
// apps/web/src/components/admin/cms/binding-editor-by-locale.tsx
'use client';

import { useState, useTransition } from 'react';
import { upsertBindingAction } from '@/lib/cms/actions';

interface Props {
  componentId: string;
  bindings: Record<string, Record<Locale, BindingValue>>;
  locales: readonly Locale[];
}

export function BindingEditorByLocale({ componentId, bindings, locales }: Props) {
  const [activeLocale, setActiveLocale] = useState<Locale>('fr');
  const [pending, startTransition] = useTransition();

  return (
    <div className="cms-editor">
      <nav className="locale-tabs">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => setActiveLocale(loc)}
            data-active={loc === activeLocale}
          >
            {loc.toUpperCase()} ({computeFillRate(bindings, loc)}%)
          </button>
        ))}
      </nav>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>FR (source)</th>
            <th>{activeLocale.toUpperCase()}</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(bindings).map(([fieldKey, perLocale]) => (
            <BindingRow
              key={fieldKey}
              fieldKey={fieldKey}
              sourceValue={perLocale.fr?.value}
              currentValue={perLocale[activeLocale]?.value}
              status={perLocale[activeLocale]?.status}
              onSave={(newValue, newStatus) => {
                startTransition(async () => {
                  await upsertBindingAction({
                    componentId,
                    fieldKey,
                    locale: activeLocale,
                    value: newValue,
                    status: newStatus,
                  });
                });
              }}
              disabled={pending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 5.3 Row éditeur

```tsx
// apps/web/src/components/admin/cms/binding-row.tsx
'use client';

import { useState } from 'react';

interface Props {
  fieldKey: string;
  sourceValue: unknown;
  currentValue: unknown;
  status: 'draft' | 'published' | undefined;
  onSave: (value: unknown, status: 'draft' | 'published') => Promise<void>;
  disabled?: boolean;
}

export function BindingRow({ fieldKey, sourceValue, currentValue, status, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>(
    typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue ?? '', null, 2)
  );
  const [dirty, setDirty] = useState(false);

  const isFallback = !currentValue && Boolean(sourceValue);

  return (
    <tr data-fallback={isFallback}>
      <td>{fieldKey}</td>
      <td className="source">
        <pre>{typeof sourceValue === 'string' ? sourceValue : JSON.stringify(sourceValue)}</pre>
      </td>
      <td>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          disabled={disabled}
        />
        {isFallback && (
          <small className="badge-fallback">Non traduit — fallback FR actif</small>
        )}
      </td>
      <td>{status ?? '—'}</td>
      <td>
        <button
          disabled={!dirty || disabled}
          onClick={() => onSave(tryParse(value), 'draft')}
        >
          Save draft
        </button>
        <button
          disabled={!dirty || disabled}
          onClick={() => onSave(tryParse(value), 'published')}
        >
          Publish
        </button>
      </td>
    </tr>
  );
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s; // Plain string
  }
}
```

### 5.4 Indication visuelle de fallback

| État | Badge | Couleur |
|---|---|---|
| Traduit + publié | "OK" | vert |
| Traduit + draft | "Brouillon" | orange |
| Pas traduit (fallback FR actif) | "Fallback FR" | rouge |
| Vide (pas de FR ni de locale) | "Aucune valeur" | gris |

## 6. Server Actions admin

### 6.1 Action upsert

```ts
// apps/web/src/lib/cms/actions.ts
'use server';

import { z } from 'zod';
import { upsertBinding } from './services/binding.service';
import { requireAdmin } from '@/lib/api/auth-admin';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  componentId: z.string().uuid(),
  fieldKey: z.string().min(1).max(80),
  locale: z.enum(['fr', 'ar', 'en']),
  value: z.unknown(),
  status: z.enum(['draft', 'published']),
});

export async function upsertBindingAction(input: z.infer<typeof schema>) {
  const admin = await requireAdmin();
  const parsed = schema.parse(input);

  await upsertBinding({
    ...parsed,
    actor: admin.email,
  });

  revalidatePath(`/admin/cms/${parsed.componentId}`);
  revalidatePath(`/${parsed.locale}`); // refresh la page publique localisée

  return { ok: true };
}
```

### 6.2 Action clone (copier FR vers AR pour traduction)

```ts
'use server';

import { z } from 'zod';
import { cloneBindingsForLocale } from './services/bulk.service';

const cloneSchema = z.object({
  componentId: z.string().uuid(),
  sourceLocale: z.enum(['fr', 'ar', 'en']),
  targetLocale: z.enum(['fr', 'ar', 'en']),
});

export async function cloneBindingsAction(input: z.infer<typeof cloneSchema>) {
  const admin = await requireAdmin();
  const parsed = cloneSchema.parse(input);

  const result = await cloneBindingsForLocale(
    parsed.componentId,
    parsed.sourceLocale,
    parsed.targetLocale,
    admin.email,
  );

  revalidatePath(`/admin/cms/${parsed.componentId}`);

  return result;
}
```

## 7. Validation Drizzle + Zod

### 7.1 Schema typé par fieldKey

Si on veut valider la structure du `value` selon le type de champ (text, rich, array) :

```ts
// apps/web/src/lib/cms/schemas/field-types.ts
import { z } from 'zod';

export const fieldSchemas = {
  // Text simple
  'hero.title': z.string().min(1).max(120),
  'hero.subtitle': z.string().min(1).max(240),
  'hero.cta': z.string().min(1).max(40),

  // Array of strings (bullets)
  'kit.bullets': z.array(z.string().min(1).max(160)).min(1).max(10),

  // Rich text (markdown)
  'manifest.body': z.string().min(1).max(5000),

  // Object structuré
  'pricing.tiers': z.array(z.object({
    label: z.string(),
    price: z.number().positive(),
    features: z.array(z.string()),
  })),
} as const satisfies Record<string, z.ZodTypeAny>;

export type FieldKey = keyof typeof fieldSchemas;
```

### 7.2 Validation au save

```ts
// dans upsertBinding service
const fieldSchema = fieldSchemas[input.fieldKey as FieldKey];
if (fieldSchema) {
  const parsed = fieldSchema.safeParse(input.value);
  if (!parsed.success) {
    throw new ApiError('VALIDATION_ERROR',
      `Invalid value for field ${input.fieldKey}`,
      parsed.error.flatten()
    );
  }
}
```

### 7.3 Inférence Drizzle

```ts
// Type inféré du select
type ComponentBindingRow = typeof componentFieldBindings.$inferSelect;
type ComponentBindingInsert = typeof componentFieldBindings.$inferInsert;
```

## 8. Workflow founder → traducteur → admin

### 8.1 Personae

| Rôle | Accès | Action |
|---|---|---|
| **Founder** | Admin total | Crée/édite tout en FR, valide les traductions |
| **Traducteur externe** | Export CSV / Lokalise | Reçoit le FR + sa langue, retourne traduit |
| **Admin technique** | Import CSV / API | Importe les retours traducteur, met en draft |

### 8.2 Workflow step-by-step

**Étape 1 — Founder crée du contenu FR**
```
Founder → /admin/cms/hero-home → ajoute "title" en FR → publish
DB: component_field_bindings (locale=fr, status=published)
```

**Étape 2 — Founder déclenche la traduction**
```
Founder → onglet AR → bouton "Cloner depuis FR"
Server action : cloneBindingsForLocale('hero-home', 'fr', 'ar', founder@email)
DB: component_field_bindings (locale=ar, status=draft, value=copy_of_fr)
```

**Étape 3 — Founder exporte pour traducteur**
```
Founder → /admin/i18n/export?scope=cms&componentId=hero-home&locale=ar
→ Télécharge CSV avec colonnes : field_key, source_fr, current_ar, status
```

**Étape 4 — Traducteur travaille**
```
Traducteur externe ouvre CSV dans son outil (Lokalise, Excel)
Remplit colonne current_ar
Renvoie le CSV
```

**Étape 5 — Founder importe**
```
Founder → /admin/cms/import → upload CSV
Server action : importCmsBindings(file, locale, componentId)
DB : update component_field_bindings (status=draft jusqu'à validation)
```

**Étape 6 — Founder revoit + publie**
```
Founder → /admin/cms/hero-home → onglet AR → vérifie
Clic "Publier tous les drafts AR" → status=published
revalidateTag('cms-component-hero-home')
```

**Étape 7 — Le visiteur voit le contenu**
```
Visiteur /ar/ → RSC fetch getCmsBindings('hero-home', 'ar')
→ retourne le contenu AR publié
```

### 8.3 Diagram

```
┌──────────┐         ┌────────────────┐         ┌─────────────┐         ┌───────────┐
│ Founder  │─create─▶│ /admin/cms FR  │─clone──▶│ Draft AR    │─export─▶│ CSV file  │
└──────────┘         └────────────────┘         └─────────────┘         └─────┬─────┘
                                                                              │
                                                                              ▼
┌──────────┐         ┌─────────────────┐         ┌──────────────┐       ┌────────────┐
│ Visiteur │◀─serve──│ Published AR    │◀─publish│ /admin/cms AR│◀─edit─│ Traducteur │
│  /ar/    │         │   in DB         │         │  (revoit)    │       │ externe    │
└──────────┘         └─────────────────┘         └──────────────┘       └────────────┘
```

### 8.4 Outils externes optionnels

| Outil | Usage | Pros | Cons |
|---|---|---|---|
| **CSV manuel** | V1 minimum | Simple, 0 dépendance | Pas de TM, pas collaboratif |
| **Lokalise** | V2+ | TM, glossaire, QA automatique | Paid, mais API solide |
| **Crowdin** | V2+ | Communautaire possible | UX moins fluide |
| **Phrase** | V2+ | Workflow approval | Enterprise-y |

→ V1 FemiGlow : CSV manuel. V2 : intégration Lokalise possible (cf. [`06-data-strategy/translation-management.md`](../06-data-strategy/translation-management.md)).

## 9. Cas particuliers

### 9.1 Page `/maison`

Bindings :
```
component_id: maison-hero
fields:
  - title (text)
  - subtitle (text)
  - bullets (array)
  - cta_primary (text)
component_id: maison-manifesto
fields:
  - statement_1 (text)
  - statement_2 (text)
  - statement_3 (text)
```

### 9.2 Page `/kit`

Bindings :
```
component_id: kit-hero
fields:
  - title (text)
  - price_label (text avec ICU)
  - bullets (array)
component_id: kit-features
fields:
  - feature_1 (object: {icon, title, description})
  - feature_2
  - feature_3
component_id: kit-faq
fields:
  - faq_items (array of {question, answer})
```

### 9.3 Pages légales (`/legal/[slug]`)

Comme déjà couvert : utiliser `legal_pages` (pas `component_field_bindings`).

```ts
// Lecture
const page = await getLegalPage(slug, locale);
// → utilise fallback FR si AR manque

// Admin
await db.update(legalPages)
  .set({ title, bodyMd, status: 'published', updatedAt: new Date() })
  .where(and(eq(legalPages.slug, slug), eq(legalPages.locale, locale)));
```

### 9.4 SEO overrides

Table `seo_overrides` (existante) :
```ts
{
  pageRoute: '/kit',
  locale: 'ar',
  title: 'override',
  description: 'override',
  status: 'published',
}
```

Service de lookup :
```ts
export async function getSeoOverride(pageRoute: string, locale: Locale) {
  const [override] = await db
    .select()
    .from(seoOverrides)
    .where(and(
      eq(seoOverrides.pageRoute, pageRoute),
      eq(seoOverrides.locale, locale),
      eq(seoOverrides.status, 'published'),
    ))
    .limit(1);
  return override ?? null;
}
```

Utilisé dans `generateMetadata` pour override les `messages/[locale].json`.

## 10. Cache invalidation

### 10.1 Tags

| Tag | Quand invalider |
|---|---|
| `cms-component-${id}` | Update d'un binding du composant |
| `cms-component-${id}-${locale}` | Update d'un binding d'une locale spécifique |
| `i18n-${locale}` | Update large d'une locale (import CSV) |
| `legal-${slug}-${locale}` | Update d'une page légale |
| `seo-overrides` | Update SEO override |

### 10.2 revalidatePath patterns

```ts
// Update d'un binding hero homepage en AR
revalidateTag(`cms-component-hero-home`);
revalidatePath(`/ar`);
revalidatePath(`/ar/maison`); // si le composant est sur plusieurs pages

// Update locale entière (import)
revalidateTag(`i18n-${locale}`);
revalidatePath('/', 'layout'); // refresh tous les layouts localisés
```

## 11. Anti-patterns

1. **Pas de fallback** : ne JAMAIS retourner `undefined` ou `null` pour une string visible. Toujours fallback FR avec log.

2. **Edit synchrone sans transaction** : si l'admin update 2 bindings, utiliser `db.transaction` pour atomicité (sinon état incohérent en cas d'erreur).

3. **Pas d'audit log sur write** : impossible de tracer qui a changé quoi → impossible de débugger.

4. **Cache trop long** : si TTL = 1h, l'admin doit attendre 1h après publish. Toujours `revalidateTag` immédiat.

5. **Publier directement sans draft** : pas de relecture, risque de typos qui partent en prod. Toujours forcer `status=draft` après import.

6. **Renvoyer le `value` brut en jsonb** : si un champ contient du HTML, sanitize côté server (`DOMPurify` ou similaire) avant render.

7. **Pas de validation Zod sur le `value`** : un admin pourrait coller un objet malformé → crash render. Toujours valider via `fieldSchemas`.

## 12. Métriques à tracker

| Métrique | Outil | Cible |
|---|---|---|
| % de bindings traduits par locale | `/api/i18n/coverage` | 100% (FR), 90%+ (AR), 70%+ (EN) |
| Nombre de fallbacks servis / jour | Log Sentry / Datadog | < 100 / jour |
| Temps moyen entre `create FR` et `publish AR` | Audit log | < 7 jours |
| Bindings draft non publiés depuis > 30j | Query DB | 0 (alerter sinon) |
| Edits admin par jour | Audit log | Variable (baseline mesurable) |

## 13. Checklist à tester / à vérifier

### Schema & migrations
- [ ] `component_field_bindings.locale` est obligatoire (NOT NULL)
- [ ] PK couvre `(componentId, fieldKey, locale)`
- [ ] Backfill FR → AR + EN exécuté avec `status='draft'`
- [ ] Aucune entrée avec `locale = NULL` ou `''`

### Repo & fallback
- [ ] `getCmsBindings('hero-home', 'fr')` retourne les bindings FR
- [ ] `getCmsBindings('hero-home', 'ar')` retourne AR si présent, sinon FR
- [ ] `getCmsBindingsWithSource` indique correctement `isFallback`
- [ ] Cache invalidé après upsert

### Service & action
- [ ] `upsertBinding` valide via Zod
- [ ] `upsertBinding` écrit dans `audit_entries`
- [ ] `cloneBindingsForLocale('fr', 'ar')` ne dupplique pas
- [ ] Server action `upsertBindingAction` exige admin role

### UI admin
- [ ] `/admin/cms/[id]` affiche les onglets FR / AR / EN
- [ ] Onglet AR montre la source FR à côté
- [ ] Badge "Fallback FR" s'affiche si pas de binding AR
- [ ] Boutons "Save draft" et "Publish" fonctionnent
- [ ] Bouton "Cloner depuis FR" crée des drafts AR

### Page publique
- [ ] `/ar/` affiche les bindings AR si présents
- [ ] `/ar/` affiche les bindings FR si AR manque (avec log warning)
- [ ] Update admin → revalidate → page refresh dans les 5 secondes

### Workflow E2E
- [ ] Founder crée binding FR → export AR draft → import retour → publish → visible sur /ar/
- [ ] Pas de fallback faux (admin doit signaler les composants 100% fallback)

## 14. Références croisées

- Schémas DB : [`02-design-conception/data-model.md`](../02-design-conception/data-model.md)
- API endpoints : [`./api-routes.md`](./api-routes.md)
- Translation store : [`./translation-store.md`](./translation-store.md)
- Migration data : [`06-data-strategy/migration-data.md`](../06-data-strategy/migration-data.md)
- Workflow translateur : [`09-runbook/workflow-translateur.md`](../09-runbook/workflow-translateur.md)
- Tests CMS : [`07-tests/cms-tests.md`](../07-tests/cms-tests.md)
