# Backend — Choix techniques

## 1. Stack

- **Runtime** : Node.js 20 (Next.js 14 App Router, Edge non utilisé pour le tracking — DB direct access).
- **DB** : PostgreSQL 16 (déjà en place projet).
- **ORM** : Drizzle (déjà standard projet).
- **Validation** : Zod (un seul schéma `TrackingPlanSchema`).
- **Logs** : pino structuré JSON.
- **Métriques** : OpenTelemetry → Prometheus scrape.

## 2. Organisation des modules

```
apps/web/src/lib/tracking/plan/
├── schema.ts              # Zod canonique
├── service.ts             # TrackingPlanService (orchestration)
├── repository.ts          # Postgres via Drizzle
├── validator.ts           # Zod + règles métier
├── exporter.ts            # plan → GtmContainerJson
├── bundle-id.ts           # SHA-256 canonique
├── audit.ts               # AuditLogger
├── cache.ts               # PlanCache (TTL 30s + invalidate)
├── errors.ts              # Erreurs typées
└── __tests__/*.test.ts    # Unit tests
```

## 3. Repository pattern

```ts
export class TrackingPlanRepository {
  constructor(private db: NodePgDatabase) {}

  async findById(id: string): Promise<DbRow | null>;
  async findActive(): Promise<DbRow | null>;
  async list(opts: ListOpts): Promise<{ items: DbRow[]; total: number }>;

  async insert(row: InsertRow): Promise<DbRow>;
  async update(id: string, patch: UpdateRow): Promise<DbRow>;

  // Transaction explicite pour activate
  async activateInTx(id: string): Promise<{ plan: DbRow; previousActiveId: string | null }>;
}
```

**Pourquoi un repo séparé** : le service orchestre la logique métier (validation, cache, audit) ; le repo isole l'accès SQL. Permet de tester le service avec un `RepositoryFake` en mémoire.

## 4. Cache resolver runtime

```ts
// apps/web/src/lib/tracking/runtime/cache.ts
class PlanCache {
  private cached: { plan: TrackingPlan; expiresAt: number } | null = null;

  async get(): Promise<TrackingPlan> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.plan;
    }
    const plan = await this.repo.findActive();
    if (!plan) throw new NoActivePlanError();
    this.cached = { plan: plan.plan, expiresAt: Date.now() + 30_000 };
    return plan.plan;
  }

  invalidate(): void {
    this.cached = null;
  }
}
```

Cache instancié en `globalThis` (warm entre requêtes Next.js sur la même instance Node).

Pour multi-instance : Pub/Sub Redis (post-v1). En v1 : TTL 30s borne la fenêtre d'incohérence à 30s max.

## 5. Validation côté serveur

```ts
// apps/web/src/lib/tracking/plan/validator.ts

const PLACEHOLDER_PATTERNS = [
  /^G-PROD0+$/, /^G-TEST/, /^G-XXXXX/,
  /^AW-REPLACE/, /^AW-XXXX/,
  /^1234567890123456$/, /^111111111111111$/,
  /^GTM-XXXX/, /^GTM-PLACEHOLDER/,
];

export function validatePlan(plan: unknown): ValidationResult {
  // 1. Zod parse
  const zodResult = TrackingPlanSchema.safeParse(plan);
  if (!zodResult.success) {
    return zodFailureToValidationResult(zodResult.error);
  }
  const valid = zodResult.data;

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // R-001 — Placeholders interdits
  for (const [path, value] of walkStrings(valid)) {
    for (const re of PLACEHOLDER_PATTERNS) {
      if (re.test(value)) {
        errors.push({
          code: 'placeholder_id',
          severity: 'error',
          path,
          message: `Valeur "${value}" ressemble à un placeholder. Remplacez-la avant d'activer.`,
          fix: `Saisir le vrai identifiant à ${path}`,
        });
      }
    }
  }

  // R-002 — Provider activé ⇒ ID requis
  if (valid.providers.meta.enabled && !valid.providers.meta.pixelId) {
    errors.push({ code: 'missing_id', severity: 'error', path: 'providers.meta.pixelId', message: 'Meta est activé mais Pixel ID est absent.', fix: null });
  }
  // ... (idem ga4, googleAds, tiktok, ...)

  // R-003 — Mapping enabled ⇒ provider enabled
  for (const [eventName, event] of Object.entries(valid.events)) {
    for (const [provKind, mapping] of Object.entries(event.mappings)) {
      if (mapping.enabled && !valid.providers[provKind as keyof typeof valid.providers].enabled) {
        errors.push({ code: 'mapping_to_disabled_provider', severity: 'error',
          path: `events.${eventName}.mappings.${provKind}`,
          message: `${eventName} envoie vers ${provKind} mais ${provKind} est désactivé.`,
          fix: `Activer ${provKind} ou désactiver ce mapping.`,
        });
      }
    }
  }

  // R-004 — Consent cohérence
  // R-005 — Env profile completeness
  // ... (cf. validator.test.ts)

  return { ok: errors.length === 0, errors, warnings, recommendations: [] };
}
```

## 6. Exporter

```ts
// apps/web/src/lib/tracking/plan/exporter.ts

export function exportPlanToGtm(plan: TrackingPlan, env: EnvName): GtmContainerJson {
  const envProfile = plan.envProfiles[env];
  if (!envProfile) throw new Error(`Env profile not found: ${env}`);

  const effectiveProviders = mergeProviderOverrides(plan.providers, envProfile.overrides);

  // 1. Construire variables Constant (un par ID)
  const variables = [
    buildConstant('CONST - GA4 Measurement ID', effectiveProviders.ga4.measurementId),
    buildConstant('CONST - Meta Pixel ID', effectiveProviders.meta.pixelId),
    buildConstant('CONST - Google Ads Customer ID', effectiveProviders.googleAds.customerId),
    // ...
  ].filter(Boolean);

  // 2. Tags : un par event activé pour chaque provider activé
  const tags: GtmTag[] = [];
  for (const [eventName, event] of Object.entries(plan.events)) {
    if (!event.enabled) continue;
    if (event.mappings.ga4.enabled && plan.providers.ga4.enabled) {
      tags.push(buildGa4EventTag(eventName, event));
    }
    if (event.mappings.googleAds.enabled && plan.providers.googleAds.enabled) {
      tags.push(buildAwctTag(eventName, event));
    }
    if (event.mappings.meta.enabled && plan.providers.meta.enabled) {
      tags.push(buildMetaHtmlTag(eventName, event));
    }
    // ...
  }

  // 3. Triggers : un Custom Event par event + PageView pour init tags
  const triggers = [
    ...Object.keys(plan.events).filter(n => plan.events[n].enabled).map(buildCustomEventTrigger),
    buildPageViewTrigger(),
  ];

  return {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      containerId: envProfile.containerId,
      tag: tags,
      trigger: triggers,
      variable: variables,
      builtInVariable: BUILT_IN_VARIABLES,
    },
  };
}
```

**Déterministe** : pour le même `plan` et le même `env`, retourne le même JSON octet-pour-octet. Vérifié par snapshot tests.

## 7. AuditLogger

```ts
// apps/web/src/lib/tracking/plan/audit.ts

export class AuditLogger {
  async log(entry: {
    planId: string;
    action: AuditAction;
    actor: string;
    actorIp?: string;
    actorUa?: string;
    diff?: JsonPatchOps;
    metadata?: object;
  }): Promise<void> {
    await this.db.insert(trackingPlanAudit).values(entry);
  }
}
```

Aucune méthode `update` ou `delete`. Le trigger Postgres rejette.

## 8. Sécurité runtime

- Secrets (capiToken, apiSecret) : champs `text` chiffrés via `crypto.subtle.encrypt` AES-GCM avec clé root en env.
- Logs : masquage automatique des champs `*Token`, `*Secret`, `pixelId`.
- Endpoints admin : `requireAdminSession()` côté Route Handler avant tout traitement.

## 9. Tests

Cf. [14-tests/](../14-tests/) pour la stratégie complète. Highlights backend :
- Unit : `service.test.ts`, `validator.test.ts`, `exporter.test.ts` (snapshot), `bundle-id.test.ts`, `cache.test.ts`.
- Integration : API routes avec DB de test (Testcontainers Postgres).
