# Service & API — TrackingPlanService

## 1. Service layer

`apps/web/src/lib/tracking/plan/service.ts`

```ts
export class TrackingPlanService {
  constructor(
    private repo: TrackingPlanRepository,
    private validator: TrackingPlanValidator,
    private exporter: TrackingPlanExporter,
    private audit: AuditLogger,
    private cache: PlanCache,
  ) {}

  async list(filters?: { status?: PlanStatus[] }): Promise<PlanSummary[]>;
  async getById(id: string): Promise<TrackingPlanRecord | null>;
  async getActive(): Promise<TrackingPlanRecord | null>;

  async create(input: { from?: string; name: string; actor: string }): Promise<TrackingPlanRecord>;
  async update(id: string, patch: DeepPartial<TrackingPlan>, actor: string): Promise<TrackingPlanRecord>;

  async validate(planOrId: TrackingPlan | string): Promise<ValidationResult>;
  async activate(id: string, actor: string): Promise<{ plan: TrackingPlanRecord; bundleId: string }>;
  async archive(id: string, actor: string): Promise<void>;

  async exportContainer(id: string, env: EnvName): Promise<{ container: GtmContainerJson; bundleId: string }>;

  async syncStatus(id: string): Promise<SyncStatus>;
}
```

### 1.1 Garanties transactionnelles

- `create` / `update` / `activate` / `archive` : transaction unique (BEGIN/COMMIT).
- `activate` : désactive l'actif + active le nouveau + insère audit + invalide cache → atomique.
- En cas d'échec : ROLLBACK + erreur typée (`PlanNotFoundError`, `ValidationError`, `ConflictError`).

### 1.2 Erreurs typées

```ts
export class PlanNotFoundError extends Error { code = 'plan_not_found'; httpStatus = 404; }
export class ValidationError extends Error { code = 'validation_failed'; httpStatus = 422; issues: ValidationIssue[]; }
export class ConflictError extends Error { code = 'conflict'; httpStatus = 409; }
export class UnauthorizedError extends Error { code = 'unauthorized'; httpStatus = 401; }
```

---

## 2. API REST

Base path : `/api/admin/tracking/plans`

### 2.1 `GET /api/admin/tracking/plans`

**Liste les plans.**

Query params :
- `status` : filtre (`?status=active`, `?status=draft,active`)
- `limit`, `offset` : pagination (défaut 20, max 100)

Réponse 200 :
```json
{
  "items": [
    {
      "id": "...",
      "name": "Production v8",
      "status": "active",
      "bundleId": "abc123...",
      "createdAt": "...",
      "createdBy": "amal@femiglow.ma",
      "activatedAt": "..."
    }
  ],
  "total": 12
}
```

### 2.2 `POST /api/admin/tracking/plans`

**Crée un nouveau plan.**

Body :
```json
{
  "name": "Test campagne mai 2026",
  "from": "uuid-du-plan-actif"   // optionnel : clone, sinon plan vide minimal
}
```

Réponses :
- `201` : `{ id, plan, bundleId }`
- `422` : `{ code: 'validation_failed', issues: [...] }`

### 2.3 `GET /api/admin/tracking/plans/:id`

**Récupère un plan complet.**

Réponses :
- `200` : `TrackingPlanRecord`
- `404` : `{ code: 'plan_not_found' }`

### 2.4 `PATCH /api/admin/tracking/plans/:id`

**Édite un plan (en draft).** Refus si `status='active'`.

Body : `DeepPartial<TrackingPlan>` (merge profond).

Réponses :
- `200` : `TrackingPlanRecord` mis à jour, `bundleId` recalculé
- `409` : `{ code: 'conflict', detail: 'cannot edit active plan' }`
- `422` : validation échouée

### 2.5 `POST /api/admin/tracking/plans/:id/validate`

**Lint un plan (sans le sauver).**

Body : `TrackingPlan` (peut être un draft non encore sauvé).

Réponses :
- `200` : `{ ok: bool, errors: [...], warnings: [...], recommendations: [...] }`

### 2.6 `POST /api/admin/tracking/plans/:id/activate`

**Active un plan.** Valide d'abord, puis bascule.

Body : vide (id dans l'URL).

Réponses :
- `200` : `{ plan, bundleId, deactivatedPlanId? }`
- `422` : validation échouée (impossible d'activer)
- `409` : `id` déjà actif

### 2.7 `POST /api/admin/tracking/plans/:id/archive`

**Archive un plan.** Si actif : refuse (il faut activer un autre d'abord).

Réponses :
- `200` : `{ archivedAt }`
- `409` : `{ code: 'conflict', detail: 'cannot archive active plan' }`

### 2.8 `GET /api/admin/tracking/plans/:id/export`

**Export JSON GTM.**

Query params :
- `env` : `production` | `staging` | `preview` | `dev` (requis)
- `format` : `pretty` | `minified` (défaut `pretty`)
- `download` : `true` | `false` (défaut `false`). Si `true` : header `Content-Disposition: attachment`.

Réponses :
- `200` : container JSON
- `404` : plan introuvable
- `422` : env invalide pour ce plan

### 2.9 `GET /api/admin/tracking/plans/:id/sync-status`

**Statut drift de ce plan.**

Réponse 200 :
```json
{
  "status": "ok" | "warning" | "critical",
  "since": "2026-05-14T...",
  "reasons": [...],
  "lastPing": {
    "receivedAt": "...",
    "bundleId": "abc123..."
  }
}
```

---

## 3. Endpoints runtime (non-admin)

### 3.1 `POST /api/track`

(Inchangé fonctionnellement, mais lit le plan via `getActivePlan()` au lieu de l'ancienne resolver chain.)

### 3.2 `POST /api/track/sentinel`

Réception des pings drift. Body :
```json
{
  "bundleId": "abc123...",
  "containerId": "GTM-M8K7V88D",
  "userAgent": "...",
  "page": "/"
}
```

Insère dans `gtmSentinelPings`. Async (non-bloquant).

---

## 4. Authentification & autorisation

Toutes les routes `/api/admin/tracking/plans/*` :
- Auth NextAuth obligatoire (session admin).
- Rôle `admin` ou `tracking-manager` requis.
- CSRF token vérifié sur POST/PATCH/DELETE.
- Rate limit : 60 req/min par admin (sliding window).

---

## 5. Logs structurés

Chaque endpoint logge :
```json
{
  "ts": "...",
  "level": "info",
  "evt": "tracking.plan.activate",
  "actor": "amal@femiglow.ma",
  "planId": "...",
  "bundleId": "...",
  "durationMs": 42
}
```

Niveaux :
- `info` : opérations normales (list, get, export)
- `notice` : opérations sensibles (create, activate, archive)
- `warn` : validation failures
- `error` : exceptions inattendues

---

## 6. Métriques (Prometheus / OpenTelemetry)

- `tracking_plan_active_count` (gauge) : doit valoir 1.
- `tracking_plan_operations_total{action,status}` (counter).
- `tracking_plan_operation_duration_ms{action}` (histogram).
- `tracking_export_size_bytes` (histogram).
- `tracking_validation_errors_total{rule}` (counter).
