# Gestion admin du formulaire de checkout

> Toute la configuration du wizard (champs visibles, ordre, libellés FR/AR,
> conditions, variantes A/B) est gérée depuis `/admin/checkout/forms` sans
> redéploiement. Cette doc spécifie UI + comportement + sécurité + audit.

---

## Sommaire

1. [Pourquoi un admin form config](#1-pourquoi-un-admin-form-config)
2. [Modèle de données](#2-modèle-de-données)
3. [Workflow draft → published → archived](#3-workflow-draft--published--archived)
4. [Pages admin](#4-pages-admin)
5. [Éditeur de configuration](#5-éditeur-de-configuration)
6. [Stock management `/admin/products/stock`](#6-stock-management-adminproductsstock)
7. [A/B testing](#7-ab-testing)
8. [Live preview](#8-live-preview)
9. [Audit trail & rollback](#9-audit-trail--rollback)
10. [Sécurité](#10-sécurité)
11. [API consommée](#11-api-consommée)
12. [Pourquoi ce format JSON](#12-pourquoi-ce-format-json)
13. [Edge cases](#13-edge-cases)

---

## 1. Pourquoi un admin form config

**Problème actuel** : modifier l'ordre d'un champ ou son label exige un PR, code review, déploiement. Pour une équipe de 1 dev, c'est ~30 min/changement. Pour le marketing, c'est bloquant.

**Solution** : table `form_config` JSON-driven, le wizard lit la config publiée au runtime.

**Cas d'usage** :
- Ajouter "Date de naissance" en optionnel sur Step 1 pour personnalisation future → toggle ON, pas de code
- Tester "Téléphone d'abord" vs "Email d'abord" → variant A/B avec split %
- Désactiver le repère sur Step 2 si ça ralentit → toggle OFF
- Traduire un label si correction urgente → update messages inline

**Garde-fous** :
- L'admin ne peut **PAS** modifier les types de champs ni les règles de validation Zod (sinon risque XSS / data corruption). Seulement : visibilité, ordre, libellés, helper text, requis/optionnel parmi un set de fields prédéfinis dans le code.
- Le code source garde l'autorité : tout field doit exister côté code, l'admin ne peut qu'activer/configurer ce qui existe.

---

## 2. Modèle de données

### 2.1 Tables Drizzle

```ts
// apps/web/src/lib/db/schema.ts (extrait — détail complet dans 08-architecture-data.md)

export const formConfig = pgTable('form_config', {
  id: text('id').primaryKey().$defaultFn(() => createId('cfg')),
  slug: text('slug').notNull(),                  // 'checkout_wizard' (1 slug = 1 form type)
  version: integer('version').notNull(),         // incrémenté à chaque publish
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  name: text('name').notNull(),                  // libellé interne admin: "Wizard MA v3 - test variant"
  description: text('description'),
  config: jsonb('config').$type<FormConfigJSON>().notNull(),
  variantAssignment: jsonb('variant_assignment').$type<VariantAssignment>(),  // {variantKey, weight}[]
  publishedAt: timestamp('published_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),       // admin user id (admin.id)
  updatedBy: text('updated_by').notNull(),
}, (t) => ({
  // Un seul `published` par slug
  uniquePublished: uniqueIndex('form_config_slug_published_unique')
    .on(t.slug, t.status)
    .where(sql`status = 'published'`),
  versionIdx: index('form_config_slug_version_idx').on(t.slug, t.version),
}));

export const formConfigHistory = pgTable('form_config_history', {
  id: text('id').primaryKey().$defaultFn(() => createId('cfh')),
  formConfigId: text('form_config_id').notNull().references(() => formConfig.id),
  version: integer('version').notNull(),
  configSnapshot: jsonb('config_snapshot').$type<FormConfigJSON>().notNull(),
  diff: jsonb('diff').$type<JsonPatchOp[]>().notNull(),  // RFC 6902 JSON Patch
  action: text('action', { enum: ['create', 'update', 'publish', 'archive', 'rollback'] }).notNull(),
  reason: text('reason'),                                 // free text "Ajout champ email"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
});
```

### 2.2 Type `FormConfigJSON`

```ts
// apps/web/src/lib/checkout/form-config/types.ts

export type FormConfigJSON = {
  $schema: 'https://femiglow.com/schemas/form-config/v1';
  meta: {
    name: string;             // copy interne admin "Wizard MA v3"
    locale_default: 'fr';     // langue par défaut si user n'a pas choisi
    locales_enabled: ('fr' | 'ar')[];
  };
  steps: FormStep[];
  layout: {
    show_progress: boolean;
    show_trust_seals: boolean;
    sticky_cta_mobile: boolean;
  };
};

export type FormStep = {
  id: 'lead' | 'address' | 'payment';     // ID fixe, type field préedéfini côté code
  enabled: boolean;
  order: number;
  title_i18n: Record<'fr' | 'ar', string>;
  subtitle_i18n?: Record<'fr' | 'ar', string>;
  fields: FormField[];
};

export type FormField = {
  // Le `key` est strictement contraint côté code (le wizard ne sait afficher que ces fields)
  key: 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'city' | 'postalCode' | 'landmark' | 'paymentMethod' | 'promoCode';
  enabled: boolean;
  required: boolean;
  order: number;
  label_i18n: Record<'fr' | 'ar', string>;
  placeholder_i18n?: Record<'fr' | 'ar', string>;
  helper_i18n?: Record<'fr' | 'ar', string>;
  // Conditions optionnelles
  show_when?: ConditionalRule;
};

export type ConditionalRule = {
  // Très restreint pour éviter le tooling complexe
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value: string | string[];
};

export type VariantAssignment = {
  variants: Array<{
    key: string;              // 'A' | 'B' | 'control'
    weight: number;           // 0-100, somme = 100
    overrides?: Partial<FormConfigJSON>;  // surcharges du config base
  }>;
  assignment_strategy: 'sticky_cookie' | 'sticky_lead_id';
};

export type JsonPatchOp = {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
};
```

### 2.3 Validation Zod du JSON

```ts
// apps/web/src/lib/checkout/form-config/schema.ts

export const formFieldSchema = z.object({
  key: z.enum(['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode', 'landmark', 'paymentMethod', 'promoCode']),
  enabled: z.boolean(),
  required: z.boolean(),
  order: z.number().int().min(0).max(99),
  label_i18n: z.object({
    fr: z.string().min(1).max(100),
    ar: z.string().min(1).max(100),
  }),
  placeholder_i18n: z.object({ fr: z.string().max(100), ar: z.string().max(100) }).optional(),
  helper_i18n: z.object({ fr: z.string().max(200), ar: z.string().max(200) }).optional(),
  show_when: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'in', 'not_in']),
    value: z.union([z.string(), z.array(z.string())]),
  }).optional(),
});

export const formStepSchema = z.object({
  id: z.enum(['lead', 'address', 'payment']),
  enabled: z.boolean(),
  order: z.number().int().min(0).max(9),
  title_i18n: z.object({ fr: z.string().min(1).max(150), ar: z.string().min(1).max(150) }),
  subtitle_i18n: z.object({ fr: z.string().max(200), ar: z.string().max(200) }).optional(),
  fields: z.array(formFieldSchema).min(1).max(20),
});

export const formConfigJsonSchema = z.object({
  $schema: z.literal('https://femiglow.com/schemas/form-config/v1'),
  meta: z.object({
    name: z.string().min(1).max(100),
    locale_default: z.literal('fr'),
    locales_enabled: z.array(z.enum(['fr', 'ar'])).min(1),
  }),
  steps: z.array(formStepSchema).min(1).max(5),
  layout: z.object({
    show_progress: z.boolean(),
    show_trust_seals: z.boolean(),
    sticky_cta_mobile: z.boolean(),
  }),
}).superRefine((data, ctx) => {
  // Assertions cross-fields
  const enabledSteps = data.steps.filter(s => s.enabled);
  if (!enabledSteps.find(s => s.id === 'lead')) {
    ctx.addIssue({ code: 'custom', message: 'Step "lead" doit toujours être enabled' });
  }
  if (!enabledSteps.find(s => s.id === 'payment')) {
    ctx.addIssue({ code: 'custom', message: 'Step "payment" doit toujours être enabled' });
  }
  // Phone toujours requis
  const leadStep = data.steps.find(s => s.id === 'lead');
  const phoneField = leadStep?.fields.find(f => f.key === 'phone');
  if (!phoneField?.enabled || !phoneField?.required) {
    ctx.addIssue({ code: 'custom', message: 'Field "phone" doit être enabled et required dans le step "lead"' });
  }
  // PaymentMethod obligatoire dans payment
  const paymentStep = data.steps.find(s => s.id === 'payment');
  const paymentMethodField = paymentStep?.fields.find(f => f.key === 'paymentMethod');
  if (!paymentMethodField?.enabled || !paymentMethodField?.required) {
    ctx.addIssue({ code: 'custom', message: 'Field "paymentMethod" doit être enabled et required dans le step "payment"' });
  }
});
```

> **Hardcoded business rules** (non modifiables par l'admin) :
> 1. Step "lead" toujours activé
> 2. Step "payment" toujours activé
> 3. Field "phone" toujours obligatoire
> 4. Field "paymentMethod" toujours obligatoire
>
> **Consentement RGPD/loi 09-08** : géré server-side au `POST /finalize` (audit
> trail `chat_lead.consented_at = now()` + `consent_version` + `ip`/UA). Pas de
> checkbox bloquante côté UI — le consentement est implicite à la confirmation
> de commande, avec micro-copy sous le CTA (cf. `06-wizard-ui-specification.md §7.5`).
>
> Si l'admin essaie de désactiver ces fields → validation Zod rejette → toast "Action non autorisée"

---

## 3. Workflow draft → published → archived

```
            ┌─────────────┐
            │   Create    │
            │  (status:   │
            │   draft)    │
            └──────┬──────┘
                   │
                   │ admin edit
                   ▼
            ┌─────────────┐         ┌─────────────┐
            │    Draft    │ ◄────── │   Rollback  │
            │             │         │ (from any)  │
            └──────┬──────┘         └─────────────┘
                   │
                   │ admin click "Publish"
                   │ → previous published auto-archived
                   ▼
            ┌─────────────┐
            │  Published  │ ◄── wizard reads this
            │  (1 max     │
            │  per slug)  │
            └──────┬──────┘
                   │
                   │ admin click "Archive" OR new publish
                   ▼
            ┌─────────────┐
            │  Archived   │
            │  (read-only)│
            └─────────────┘
```

**Règles** :
- Une seule config par slug peut être `published` (contrainte DB unique partielle)
- Publier une nouvelle version archive automatiquement la précédente
- L'archivage est réversible : on peut "Restore as draft" depuis archived
- Rollback → crée un nouveau draft basé sur snapshot d'une version antérieure (n'écrase pas la version actuelle)

---

## 4. Pages admin

### 4.1 Liste `/admin/checkout/forms`

**URL** : `/admin/checkout/forms`
**Auth requise** : `requireAdmin` middleware
**Layout** : standard admin layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Admin > Checkout > Formulaires                                       │
├─────────────────────────────────────────────────────────────────────┤
│ [+ Nouveau formulaire]                              [🔍 Rechercher]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Slug: checkout_wizard                                               │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Wizard MA v3 (test variant)            ● PUBLISHED · v12   │    │
│ │ Publié le 2026-05-10 14:22 par admin@femiglow.com          │    │
│ │ [Modifier] [Voir aperçu] [Voir historique]                 │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Wizard MA v4 (avec nom de famille)     ○ DRAFT · v13       │    │
│ │ Modifié le 2026-05-11 09:15 par admin@femiglow.com         │    │
│ │ [Modifier] [Aperçu] [Publier] [Supprimer]                  │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ─── Anciennes versions ───                                          │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Wizard MA v2                            ⚪ ARCHIVED · v11   │    │
│ │ Archivé le 2026-05-10 14:22                                │    │
│ │ [Voir] [Restaurer en draft]                                │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Sort par défaut** : `status DESC` (Published first), puis `version DESC`.

### 4.2 Détail / Édition `/admin/checkout/forms/[id]`

5 tabs : **Champs** | **Logique** | **Variantes** | **Aperçu** | **Historique**

---

## 5. Éditeur de configuration

### 5.1 Tab "Champs"

```
┌─────────────────────────────────────────────────────────────────┐
│ < Retour    Wizard MA v3                        [Save] [Publier]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ▼ Step 1 — Contact (lead)                       [Activé] [↑↓]  │
│   Titre FR: [Recevez votre kit FemiGlow en 24-48h        ]     │
│   Titre AR: [استلمي طقم FemiGlow في 24-48 ساعة           ]     │
│                                                                 │
│   ⋮⋮ Prénom (firstName)               [Activé] [Obligatoire]   │
│       Label FR: [Prénom              ]                          │
│       Label AR: [الاسم              ]                          │
│                                                                 │
│   ⋮⋮ Téléphone (phone)        [Activé*] [Obligatoire*] [LOCKED]│
│       Label FR: [Téléphone           ]                          │
│       Label AR: [الهاتف             ]                          │
│       Helper FR: [On vous enverra un SMS...]                    │
│       Helper AR: [سنرسل لك...]                                  │
│                                                                 │
│   ⋮⋮ Email (email)                   [Activé] [Optionnel]      │
│       ⚠ Désactivé : moins de friction mais perd l'email backup  │
│                                                                 │
│   ⋮⋮ Nom (lastName)                  [○ Désactivé]              │
│                                                                 │
│ ▼ Step 2 — Adresse (address)                    [Activé] [↑↓]  │
│   ... [même pattern] ...                                        │
│                                                                 │
│ ▼ Step 3 — Paiement (payment)                   [Activé*] LOCKED│
│   ... [même pattern] ...                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Composants UI** :
- `<DragDropContext>` `@dnd-kit/sortable` pour reorder steps et fields
- Toggle obligatoire/optionnel : Switch shadcn
- Locked fields (phone, paymentMethod, lead step, payment step) : badge `LOCKED`, switch disabled avec tooltip "Champ obligatoire selon les règles métier"
- Save autosave debounced 1500ms après dernier change

### 5.2 Tab "Logique"

> **Limite intentionnelle** : on accepte seulement les conditions simples
> (field = value, field ≠ value, field in [list]). Pour des règles complexes,
> on refactore côté code.

```
┌─────────────────────────────────────────────────────────────────┐
│ Logique d'affichage conditionnel                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌───────────────────────────────────────────────────────┐      │
│ │ Champ Repère (Step 2)                                  │      │
│ │ Afficher seulement si...                               │      │
│ │ [Ville ▼] [est ▼] [Casablanca, Rabat, Marrakech ▼]    │      │
│ │ [+ Ajouter une condition]                              │      │
│ │ [🗑 Supprimer la règle]                                │      │
│ └───────────────────────────────────────────────────────┘      │
│                                                                 │
│ [+ Ajouter une règle conditionnelle]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Limites enforced** :
- Max 5 règles conditionnelles par config
- Conditions ne peuvent pas faire référence à des fields d'un step ultérieur
- Pas de `AND`/`OR` en V1 (chaque rule est isolée)

### 5.3 Tab "Variantes" (A/B testing)

```
┌─────────────────────────────────────────────────────────────────┐
│ A/B testing                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Stratégie d'assignation: [Sticky par cookie ▼]                  │
│                                                                 │
│ ┌──────────────────────────────────────┐                       │
│ │ Variant "control" (base config)      │ Weight: [50] %        │
│ └──────────────────────────────────────┘                       │
│                                                                 │
│ ┌──────────────────────────────────────┐                       │
│ │ Variant "B" (avec lastName)          │ Weight: [50] %        │
│ │ Overrides:                           │                       │
│ │   steps[0].fields.lastName.enabled = true                    │
│ │   steps[0].fields.lastName.required = false                  │
│ │ [Éditer overrides]  [🗑 Supprimer]   │                       │
│ └──────────────────────────────────────┘                       │
│                                                                 │
│ [+ Ajouter variant]                                             │
│                                                                 │
│ ⚠ Total weights: 100% ✓                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportement runtime** :
- Au mount du wizard : le serveur génère un `assignment_seed` (hash du lead_id ou cookie `fg_variant_seed`)
- L'API `GET /api/checkout/form-config/active` retourne la config + le variant choisi pour ce seed
- Le merge `base + overrides` est appliqué côté serveur (le client reçoit la config finale, pas les variants)
- Le `variant_key` est inclus dans tous les events `dataLayer.push`

### 5.4 Tab "Aperçu"

```
┌─────────────────────────────────────────────────────────────────┐
│ Aperçu — Wizard MA v3 (draft v13)                               │
├─────────────────────────────────────────────────────────────────┤
│ [📱 Mobile] [💻 Desktop]  [FR] [AR]  Variant: [control ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                                                      │      │
│  │              [iframe preview                         │      │
│  │               src='/preview/checkout?config={id}     │      │
│  │                    &variant=control&locale=fr']      │      │
│  │                                                      │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  💡 Conseil : Testez l'enchainement complet et vérifiez l'AR    │
└─────────────────────────────────────────────────────────────────┘
```

**Iframe** : route `/admin/preview/checkout` (cf. §7) qui rend le wizard avec un mock cart `[1× kit]` et un lead capture désactivé (pas d'écriture DB).

### 5.5 Tab "Historique"

```
┌─────────────────────────────────────────────────────────────────┐
│ Historique des versions                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ v13 · DRAFT · 2026-05-11 09:15 par admin@femiglow.com           │
│   ├─ replace /steps/0/fields/2/required = false                 │
│   └─ add /steps/0/fields/4 (email)                              │
│   [Voir snapshot] [Restaurer en draft]                          │
│                                                                 │
│ v12 · PUBLISHED · 2026-05-10 14:22 par admin@femiglow.com       │
│   ├─ publish action                                             │
│   [Voir snapshot] [Restaurer en draft]                          │
│                                                                 │
│ v11 · ARCHIVED · 2026-05-10 14:22 (auto via publish v12)        │
│   [Voir snapshot] [Restaurer en draft]                          │
│                                                                 │
│ v10 · PUBLISHED · 2026-05-08 11:00 par admin@femiglow.com       │
│   [Voir snapshot] [Restaurer en draft]                          │
│                                                                 │
│ ... (paginated par 20)                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Diff viewer** : JSON Patch ops RFC 6902 rendues lisible :
- Vert : `add`
- Rouge : `remove`
- Bleu : `replace`
- Format `path` : `/steps/0/fields/2/required` au lieu de `steps[0].fields[2].required` (standard)

---

## 6. Stock management `/admin/products/stock`

> Page admin distincte du form editor (séparation responsabilités : forme vs.
> inventaire). Source de vérité = `product_stock` table (cf. `08-architecture-data.md §2.7`).

### 6.1 Page principale `/admin/products/stock`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Stock produits                                              [+ Nouveau]│
├──────────────────────────────────────────────────────────────────────┤
│  Filtres : [Tous ▼] [⚠ Stock limité] [🔴 Rupture]    🔍 [Rechercher] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ 🟢  Kit FemiGlow                              SKU: KIT-FG-001    ││
│ │                                                                  ││
│ │ Stock dispo : 47 unités    Réservées : 3    Seuil bas : 15      ││
│ │ Réappro ETA : 5 jours (15/05/2026)                              ││
│ │ Dernière modif : il y a 2h par admin@femiglow.com                ││
│ │                                                                  ││
│ │  [Ajuster stock]  [Voir historique]  [Configurer seuils]         ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ⚠  Sérum éclat 30 ml                          SKU: SR-EC-030    ││
│ │ Stock dispo : 8 unités    Réservées : 0    Seuil bas : 10       ││
│ │ Réappro ETA : 3 jours                                            ││
│ │  [Ajuster stock]  [Voir historique]                              ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Badges d'état** (rendus dans la liste avec icônes Lucide stroke 1.5) :

| Badge | Condition | Style |
|---|---|---|
| 🟢 En stock | `available > threshold` | `bg-success/15 text-success` + `CheckCircle2` |
| ⚠ Stock limité | `0 < available ≤ threshold` | `bg-warning/15 text-warning` + `AlertTriangle` |
| 🔵 Réappro en cours | `available = 0` + `restockEtaDays != null` | `bg-info/15 text-info` + `Clock` |
| 🔴 Rupture | `available = 0` + `restockEtaDays = null` | `bg-destructive/15 text-destructive` + `XCircle` |

### 6.2 Modale "Ajuster stock"

```
┌──────────────────────────────────────────────────────────┐
│ Ajuster le stock — Kit FemiGlow                    [X]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Stock actuel : 47 unités                                 │
│                                                          │
│ Type d'ajustement                                        │
│ ◉ Réapprovisionnement (+)                                │
│ ○ Inventaire physique (= remplacement)                  │
│ ○ Ajustement manuel (+/-)                                │
│                                                          │
│ Delta : [+50]    →  Nouveau stock : 97 unités            │
│                                                          │
│ Raison (obligatoire)                                     │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Livraison fournisseur du 11/05/2026                │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Note (optionnel)                                         │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Bon de livraison #BL-2026-117                      │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│              [Annuler]  [Confirmer l'ajustement]        │
└──────────────────────────────────────────────────────────┘
```

**Validation** :
- `delta` doit être numérique
- Pour "Ajustement manuel" : delta peut être négatif. Confirmation supplémentaire
  si `available + delta < 0` → "Ce stock deviendrait négatif. Êtes-vous sûr·e ?"
- `reason` obligatoire (min 5 chars)

**API** : `PATCH /api/admin/products/stock/[productStockId]` avec `{ stockUnits, reason, note? }`.

### 6.3 Modale "Configurer seuils"

```
┌──────────────────────────────────────────────────────────┐
│ Configurer les seuils — Kit FemiGlow              [X]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Seuil "stock limité" (déclenche pulse + alerte)          │
│ ┌──────┐    Quand stock ≤ ce nombre, l'UI affiche       │
│ │  15  │    "Plus que X kits disponibles" avec urgence. │
│ └──────┘                                                 │
│                                                          │
│ Délai de réapprovisionnement (jours)                     │
│ ┌──────┐    Affiché en rupture: "Réappro sous X jours". │
│ │   5  │    Laissez vide si inconnu.                    │
│ └──────┘                                                 │
│                                                          │
│ Date estimée de réapprovisionnement (optionnel)          │
│ ┌────────────┐  Plus précis que le délai en jours.      │
│ │ 15/05/2026 │                                          │
│ └────────────┘                                          │
│                                                          │
│              [Annuler]  [Enregistrer]                   │
└──────────────────────────────────────────────────────────┘
```

**Effet immédiat** : `revalidateTag('product-stock-{productId}')` → toutes les sessions Step 2 récupèrent la nouvelle valeur au prochain fetch (TTL 60s).

### 6.4 Page historique `/admin/products/stock/[id]/history`

Liste chronologique inverse des ajustements (`product_stock_adjustment`) :

| Date | Delta | Raison | Par | Note |
|---|---|---|---|---|
| 11/05 14:22 | +50 | restock | admin@femiglow.com | BL-2026-117 |
| 11/05 12:01 | -1 | sale | system | order=ord_8x4c2 |
| 10/05 09:15 | -1 | reservation | system | lead=led_a3b1 |
| 09/05 18:00 | -3 | inventory_count | admin@femiglow.com | écart constaté |

Export CSV : bouton en haut de la liste pour download.

### 6.5 Permissions

- Lecture stock : tout admin (role >= `viewer`)
- Ajustement stock : admin role `editor` ou `owner`
- Configurer seuils : admin role `editor` ou `owner`
- Audit trail toujours en lecture seule

---

## 7. A/B testing

### 7.1 Décision d'assignation (côté serveur)

```ts
// apps/web/src/lib/checkout/form-config/variant-assignment.ts

export function assignVariant(
  variants: VariantAssignment['variants'],
  seed: string,
): { variantKey: string; mergedConfig: FormConfigJSON } {
  // Hash déterministe du seed → uint32
  const hash = hashStringToUint32(seed);
  const bucket = hash % 100;  // 0-99

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return {
        variantKey: variant.key,
        mergedConfig: applyJsonOverrides(baseConfig, variant.overrides ?? {}),
      };
    }
  }
  // Fallback (somme weights < 100 par config invalide)
  return { variantKey: 'control', mergedConfig: baseConfig };
}
```

### 7.2 Persistence

- Cookie `fg_variant_seed` = uuid v4, posé au premier hit du wizard
- Si user a déjà un `lead_id` (cookie `fg_lead`), on utilise `lead_id` comme seed (sticky même cross-device si user revient avec son numéro)
- Sinon : seed du cookie variant_seed
- Le `variant_key` choisi est stocké dans `form_variant_assignment` table → on peut analyser les conversions par variant

### 7.3 Reporting (post-V1)

Pas de dashboard A/B intégré au V1. Au lieu : exports via :
- GTM event `wizard_view` avec `variant_key` → GA4 dashboard
- SQL ad-hoc : `SELECT variant_key, COUNT(*) FROM form_variant_assignment JOIN orders USING (lead_id) GROUP BY variant_key`

---

## 8. Live preview

### 8.1 Route préview

`/admin/preview/checkout?config=<id>&variant=<key>&locale=<fr|ar>`

**Comportement** :
- Requiert admin auth (middleware)
- Charge la config spécifiée (même si `draft`)
- Override le merge variant manuellement (selon param)
- Monte un `<Wizard mode="preview" />` avec :
  - Cart mocké `[{ id: 'kit-mock', name: 'Kit FemiGlow', price: 29 }]`
  - API mocks (`POST /lead` retourne un mock_id, ne touche pas DB)
  - Bandeau top fluo "MODE PRÉVIEW — Aucune donnée n'est enregistrée"
- Pas de `dataLayer.push` réel (no-op handler pour pas polluer GA)

### 8.2 Iframe isolation

Le tab "Aperçu" embed cette route en iframe avec :
- `sandbox="allow-same-origin allow-scripts allow-forms"`
- Pas de `allow-top-navigation` (sécurité)
- Width responsive : 360px ou 1280px selon toggle

---

## 9. Audit trail & rollback

### 9.1 Audit complet

Chaque modification → row dans `form_config_history` avec :
- `version` (incrémenté)
- `configSnapshot` (full JSON après modif)
- `diff` (JSON Patch RFC 6902 op list)
- `action` (`create|update|publish|archive|rollback`)
- `reason` (champ texte facultatif que l'admin peut remplir)
- `createdBy` (admin id)
- `createdAt`

### 9.2 Rollback flow

1. Admin va sur tab "Historique"
2. Click "Restaurer en draft" sur une version v9 (par exemple)
3. UI : confirme "Créer un nouveau draft basé sur v9 ?"
4. POST `/api/admin/form-config/[id]/rollback` body `{ to_version: 9, reason: "Bug observé en v12" }`
5. Serveur :
   - Récupère `configSnapshot` de v9
   - Crée un nouveau row `form_config` `status=draft, version=14, config=snapshot_v9`
   - Insère row history avec `action='rollback'`, `diff=patch(current → snapshot_v9)`
6. UI redirige sur `/admin/checkout/forms/<new_draft_id>`

> **Pas de rollback destructif** : on ne modifie jamais une version existante,
> on crée toujours un nouveau row.

---

## 10. Sécurité

### 10.1 Auth

- Middleware `requireAdmin` (cf. `apps/web/src/middleware.ts`) :
  - Vérifie cookie `femiglow_admin_session` (iron-session)
  - Decode + check expiry (8h TTL)
  - Refresh session sliding window à chaque hit
- Tous les endpoints `/api/admin/*` rejetent 401 si pas authentifié

### 10.2 Authz

- En V1 : un seul rôle `admin` (binaire). Tous les admins peuvent CRUD config.
- En V2 (futur) : roles `admin`, `editor`, `viewer` (cf. doc dédiée future).

### 10.3 CSRF

- Server actions Next.js : same-origin check natif
- API routes : double-submit token via cookie + header `X-CSRF-Token` (`apps/web/src/lib/auth/csrf.ts` à créer si pas existant)

### 10.4 Audit log

- Toute mutation `/api/admin/form-config/*` log :
  - Admin id
  - IP (sans tracking PII)
  - Action
  - Before/after diff
- Stocké dans `form_config_history` (cf. §8)

### 10.5 Validation côté serveur

- Body parsé via `formConfigJsonSchema.safeParse(body)` AVANT toute écriture
- Si erreur Zod → 422 avec détails fields
- Limite taille body : 100 KB (nginx/vercel default)

### 10.6 Rate limiting

- `PUT /api/admin/form-config/[id]` : 30 req/min/admin (anti spam)
- `POST /api/admin/form-config/[id]/publish` : 5 req/min/admin (anti race)

---

## 11. API consommée

> Détail exhaustif dans [`08-architecture-data.md`](./08-architecture-data.md) §3.4.

| Méthode | Endpoint | Usage admin UI |
|---|---|---|
| `GET` | `/api/admin/form-config?slug=checkout_wizard` | List dans page liste |
| `GET` | `/api/admin/form-config/[id]` | Charger éditeur |
| `POST` | `/api/admin/form-config` | Créer draft |
| `PUT` | `/api/admin/form-config/[id]` | Save draft |
| `POST` | `/api/admin/form-config/[id]/publish` | Publier |
| `POST` | `/api/admin/form-config/[id]/archive` | Archiver |
| `POST` | `/api/admin/form-config/[id]/rollback` | Rollback to version |
| `GET` | `/api/admin/form-config/[id]/history` | List historique |
| `GET` | `/api/admin/form-config/[id]/history/[version]` | Snapshot d'une version |

---

## 12. Pourquoi ce format JSON

| Alternative considérée | Pourquoi rejetée |
|---|---|
| **YAML stocké en repo** | Nécessite déploiement à chaque change, perd l'usage non-tech |
| **Drizzle row par champ** | Trop normalisé, jointures coûteuses, hard à versionner |
| **React Builder type Storyblok/Sanity** | Vendor lock-in, overkill pour 11 fields prédéfinis |
| **localStorage côté admin** | Pas multi-utilisateur, pas auditable |

→ **JSON dans `jsonb` Postgres** = compromis :
- Versionnable atomiquement
- Auditable via JSON Patch
- Indexable si besoin (`->`, `->>` Postgres)
- Validé via Zod côté code

---

## 13. Edge cases

### 13.1 Aucune config `published`

→ Le wizard fallback sur la config par défaut hardcoded dans `apps/web/src/lib/checkout/form-config/default.ts`. Sentry alert envoyé à l'équipe.

### 13.2 Admin publie une config invalide

→ Endpoint `/publish` re-valide avec `formConfigJsonSchema.parse()` AVANT de muter le status. 422 si invalid, l'admin voit les erreurs.

### 13.3 Race condition publish

Deux admins clic "Publish" en même temps sur deux drafts :
→ Transaction Postgres `BEGIN; UPDATE ... WHERE status='published' SET status='archived'; UPDATE WHERE id=$new SET status='published'; COMMIT;`. La contrainte unique `(slug, status='published')` rejette le 2e.

### 13.4 Suppression d'un draft en cours d'édition

L'admin A édite v13 (draft), l'admin B le supprime. Quand A save :
→ 404 sur PUT, toast "Cette version a été supprimée. Vos changements sont perdus."

### 13.5 Migration breaking du schema JSON

Si on doit migrer `$schema v1 → v2` :
→ Migration script `apps/web/scripts/migrate-form-config-v2.ts` qui :
- Lit toutes les rows
- Transforme `config` selon mapping v1→v2
- Écrit en `form_config_history` avec `action='migrate'`
- Update les rows existantes

Le code de prod check `if (config.$schema !== 'v1') throw new SchemaVersionError()` pour pas servir une config incompatible.

### 13.6 Aperçu sur un draft avec variant

L'iframe aperçu reçoit `?variant=<key>` directement, pas de seed hashing nécessaire — l'admin choisit explicitement le variant à preview.

### 13.7 Cache invalidation

- `GET /api/checkout/form-config/active` : tag cache `form-config-active`
- À chaque publish : `revalidateTag('form-config-active')`
- TTL fallback : 60s (au cas où revalidate raté)
