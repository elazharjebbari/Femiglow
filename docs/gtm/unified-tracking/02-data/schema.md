# Schéma de données — Unified Tracking

## 1. Tables Postgres

### 1.1 `trackingPlans`

Table principale. Stocke chaque version du plan complet.

| Colonne | Type | Contraintes | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | Généré côté app (`crypto.randomUUID()`) |
| `name` | `text` | NOT NULL | "Production v8", "Test campagne mai" |
| `status` | `text` | NOT NULL, CHECK in ('draft', 'active', 'archived') | |
| `bundle_id` | `text` | NOT NULL, INDEX | SHA-256 du JSON canonique |
| `plan` | `jsonb` | NOT NULL | Le `TrackingPlan` complet (cf. Zod) |
| `parent_version_id` | `uuid` | NULL, FK self | Plan dont celui-ci est cloné |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |
| `created_by` | `text` | NOT NULL | Email admin |
| `activated_at` | `timestamptz` | NULL | Set seulement quand status passe à 'active' |
| `archived_at` | `timestamptz` | NULL | Set quand status passe à 'archived' |
| `notes` | `text` | NULL | Commentaire libre admin |

**Index :**
- `UNIQUE INDEX idx_plans_one_active ON trackingPlans(status) WHERE status = 'active'`
- `INDEX idx_plans_bundle ON trackingPlans(bundle_id)`
- `INDEX idx_plans_status_activated ON trackingPlans(status, activated_at DESC)`
- `INDEX idx_plans_plan_gin ON trackingPlans USING GIN (plan jsonb_path_ops)`

### 1.2 `trackingPlanAudit`

Append-only. Capture toutes les transitions.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `bigserial` | PK |
| `plan_id` | `uuid` | NOT NULL, FK |
| `action` | `text` | NOT NULL, CHECK in ('create', 'update', 'activate', 'archive', 'export', 'validate') |
| `actor` | `text` | NOT NULL (email) |
| `actor_ip` | `inet` | NULL |
| `actor_ua` | `text` | NULL |
| `diff` | `jsonb` | NULL — JSON Patch RFC 6902 |
| `metadata` | `jsonb` | NULL — payload contextuel |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT NOW() |

**Pas d'UPDATE, pas de DELETE.** Trigger Postgres `BEFORE UPDATE` qui RAISE EXCEPTION.

### 1.3 `trackingDefaults`

Source d'autocomplete (key-value).

| Colonne | Type |
|---|---|
| `key` | `text` PK (ex: `ga4.production.measurementId`) |
| `value` | `text` |
| `updated_at` | `timestamptz` |
| `updated_by` | `text` |

### 1.4 Tables conservées (legacy → renommées en `_legacy_v1`)

- `trackingProviders_legacy_v1`
- `eventMappingVersions_legacy_v1`
- `eventMappingAudit_legacy_v1`
- `trackingSettings_legacy_v1`

Lecture seule. Drop à T+90j (cf. runbook).

### 1.5 Tables conservées (sans renaming, fonctionnent telles quelles)

- `gtmSentinelPings`
- `gtmDriftState`
- `gtmDriftHistory`
- `gtmSentinelDailyAggregates`

Le drift detector continue de comparer le `bundleId` reçu vs. celui du `plan actif` (lecture depuis `trackingPlans`).

---

## 2. Schéma `TrackingPlan` (Zod canonique)

```ts
// apps/web/src/lib/tracking/plan/schema.ts

export const TrackingPlanSchema = z.object({
  meta: z.object({
    schemaVersion: z.literal('1.0.0'),
    createdAt: z.string().datetime(),
    createdBy: z.string().email(),
  }),

  providers: z.object({
    ga4: z.object({
      enabled: z.boolean(),
      measurementId: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
      apiSecret: z.string().optional(), // chiffré
    }),
    googleAds: z.object({
      enabled: z.boolean(),
      customerId: z.string().regex(/^AW-\d+$/).optional(),
      conversions: z.array(z.object({
        label: z.string(),
        type: z.enum(['lead', 'purchase', 'view', 'custom']),
      })),
    }),
    meta: z.object({
      enabled: z.boolean(),
      pixelId: z.string().regex(/^\d{15,16}$/).optional(),
      capiToken: z.string().optional(), // chiffré
      testEventCode: z.string().optional(),
    }),
    tiktok: z.object({
      enabled: z.boolean(),
      pixelId: z.string().optional(),
      accessToken: z.string().optional(), // chiffré
    }),
    snapchat: z.object({
      enabled: z.boolean(),
      pixelId: z.string().optional(),
    }),
    pinterest: z.object({
      enabled: z.boolean(),
      tagId: z.string().optional(),
    }),
  }),

  envProfiles: z.record(
    z.enum(['production', 'staging', 'preview', 'dev']),
    z.object({
      containerId: z.string().regex(/^GTM-[A-Z0-9]+$/).nullable(),
      overrides: z.object({
        // surcharge des IDs providers pour cet env
        ga4MeasurementId: z.string().optional(),
        metaPixelId: z.string().optional(),
        googleAdsCustomerId: z.string().optional(),
        // ... idem pour autres providers
      }).default({}),
      cookieDomain: z.string().default('auto'),
      defaultCurrency: z.string().length(3).default('MAD'),
    })
  ),

  events: z.record(z.string(), z.object({
    enabled: z.boolean(),
    description: z.string().optional(),
    mappings: z.object({
      ga4: z.object({
        mappedName: z.string().nullable(),
        isCustom: z.boolean(),
        enabled: z.boolean(),
        parameters: z.record(z.string(), z.string()).default({}),
      }),
      googleAds: z.object({
        conversionLabel: z.string().nullable(),
        enabled: z.boolean(),
      }),
      meta: z.object({
        mappedName: z.string().nullable(),
        isStandard: z.boolean(), // standard event vs trackCustom
        enabled: z.boolean(),
      }),
      tiktok: z.object({
        mappedName: z.string().nullable(),
        enabled: z.boolean(),
      }),
      // ... autres providers
    }),
    consent: z.object({
      requiresAdStorage: z.boolean(),
      requiresAnalyticsStorage: z.boolean(),
    }),
  })),

  // Settings globaux du plan (pas par event)
  settings: z.object({
    autoFireOnPageView: z.boolean().default(true),
    blockedHostnames: z.array(z.string()).default([]),
    debugMode: z.boolean().default(false),
  }),
});

export type TrackingPlan = z.infer<typeof TrackingPlanSchema>;
```

---

## 3. Bundle ID — Algorithme

```ts
// apps/web/src/lib/tracking/plan/bundle-id.ts

export function computeBundleId(plan: TrackingPlan): string {
  // 1. Strip non-deterministic fields
  const canonical = stripVolatileFields(plan);
  // 2. Sort keys recursively
  const sorted = sortKeysRecursive(canonical);
  // 3. Stringify with explicit separators (no whitespace)
  const json = JSON.stringify(sorted);
  // 4. SHA-256
  return sha256(json).slice(0, 16); // first 16 hex chars suffisent
}

function stripVolatileFields(plan: TrackingPlan): unknown {
  const { meta, ...rest } = plan;
  // On exclut meta.createdAt qui change à chaque save.
  // On garde meta.schemaVersion qui doit influencer le bundleId.
  return { meta: { schemaVersion: meta.schemaVersion }, ...rest };
}
```

**Propriétés garanties :**
- Déterministe : même plan → même bundleId.
- Stable au renommage non-sémantique (ordre clés).
- Sensible aux changements significatifs (ajout event, changement provider).

---

## 4. Validation métier (au-delà de Zod)

Cf. [03-backend/service-api.md](../03-backend/service-api.md) pour les règles complètes. Résumé :

- **R-001 Placeholders interdits** : aucune valeur ne doit matcher des patterns connus (`G-PROD0000`, `AW-REPLACE_*`, `1234567890`).
- **R-002 Provider activé ⇒ ID requis** : si `meta.enabled=true`, `meta.pixelId` doit être défini.
- **R-003 Mapping enabled ⇒ provider enabled** : pas de mapping vers un provider désactivé.
- **R-004 Event consent cohérent** : `requiresAdStorage` si mapping vers `meta` ou `googleAds`.
- **R-005 Env profile completeness** : si `containerId` défini, au moins un provider doit être activé.

---

## 5. Migration depuis l'existant

Cf. [migration.sql](./migration.sql) pour le SQL. Étapes logiques :

1. Créer nouvelles tables (`trackingPlans`, `trackingPlanAudit`, `trackingDefaults`).
2. Renommer anciennes tables avec suffixe `_legacy_v1`.
3. Script TypeScript `scripts/migrate-tracking-plan.ts` :
   - Lit `trackingProviders_legacy_v1` → reconstruit `providers`.
   - Lit `eventMappingVersions_legacy_v1` (active) → reconstruit `events`.
   - Lit `trackingSettings_legacy_v1` → reconstruit `envProfiles`.
   - Calcule `bundleId`.
   - INSERT dans `trackingPlans` avec `status='active'`.
   - INSERT entrée audit (`action='create'`, `actor='migration-script'`).
4. Vérification post-migration : export du plan migré → diff vs. ancien export → manuel ou snapshot test.

Rollback : drop tables nouvelles, renommer `_legacy_v1` en standard, lance ancien code.

---

## 6. Données de seed initial

[seed.csv](./seed.csv) liste les `trackingDefaults` recommandés pour FemiGlow Maroc (clés/valeurs ID prod par défaut). À adapter par l'admin avant migration.

[event-presets.csv](./event-presets.csv) liste les events FemiGlow standard (lead_form_submit, add_to_cart, purchase, …) pour pré-remplir le wizard step 3.
