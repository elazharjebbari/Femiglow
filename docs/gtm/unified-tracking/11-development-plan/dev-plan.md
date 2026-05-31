# Development plan

## 1. Stack et organisation code

### Stack

| Couche | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript strict |
| Server state | TanStack Query v5 |
| Local state | Zustand 4 + persist middleware |
| Validation | Zod v3 |
| Styling | Tailwind CSS v4 + design tokens FemiGlow |
| DB | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Tests unit | Jest + React Testing Library |
| Tests E2E | Playwright |
| Tests mock | MSW (Mock Service Worker) |
| CI | GitHub Actions |
| Telemetry | OpenTelemetry → Datadog (existant) |

### Organisation des fichiers

```
apps/web/src/
├── app/
│   └── admin/
│       └── tracking/
│           ├── page.tsx               ← Home (dashboard)
│           ├── plans/
│           │   ├── page.tsx           ← Liste plans
│           │   ├── new/page.tsx       ← Création plan
│           │   └── [id]/
│           │       └── page.tsx       ← Édition (wizard ou expert via ?mode)
│           ├── sync/page.tsx
│           ├── history/page.tsx
│           ├── diagnostics/page.tsx   ← Expert only
│           └── settings/page.tsx
├── components/
│   └── tracking/
│       ├── shared/                    ← StatusCard, Badge, etc.
│       ├── wizard/                    ← TrackingPlanWizard + Step1-5
│       ├── expert/                    ← TrackingPlanExpert + sections
│       ├── home/                      ← Cards dashboard
│       ├── sync/                      ← Sync dashboard
│       └── history/                   ← Versions list
├── lib/
│   └── tracking/
│       └── plan/                      ← Domain logic (nouveau)
│           ├── types.ts               ← Zod schemas + types
│           ├── repository.ts          ← Drizzle CRUD
│           ├── service.ts             ← TrackingPlanService
│           ├── validator.ts           ← validatePlan
│           ├── exporter.ts            ← exportPlan
│           ├── differ.ts              ← diffPlans
│           ├── cache.ts               ← PlanCache (30s TTL)
│           ├── audit.ts               ← appendAudit
│           ├── defaults.ts            ← Auto-prefill mechanism
│           └── index.ts               ← Public exports
├── stores/
│   └── tracking-plan-store.ts         ← Zustand
└── lib/
    └── db/
        └── schema/
            └── tracking-plan.ts       ← Drizzle table defs
```

### Legacy (à renommer pendant migration)

```
apps/web/src/
├── lib/
│   └── tracking/
│       ├── gtm/                       ← _legacy_v1 marker
│       │   ├── builders.ts
│       │   ├── exporter.ts
│       │   └── ...
│       └── mappings/                  ← _legacy_v1 marker
│           ├── resolver.ts
│           ├── gtm-export.ts
│           └── ...
```

Suppression à T+90 jours post-release.

## 2. Stratégie git

### Branches

```
master                       ← prod, intouchable sans review + tests
  ↑
release/tracking-plan-v2     ← intégration des features avant prod
  ↑
feat/tp2-{ticket-id}-{short} ← feature branches (Younes)
```

Convention de naming :
- `feat/tp2-001-schema-postgres`
- `feat/tp2-002-repository`
- `fix/tp2-{ticket}-{summary}`
- `chore/tp2-cleanup-legacy`

### Workflow PR

1. Branche depuis `release/tracking-plan-v2`.
2. Implémentation + tests + docs.
3. PR vers `release/tracking-plan-v2`.
4. CI vert (Jest + Playwright + lint + a11y).
5. Review par lead.
6. Merge.
7. Quand toute la release est verte : PR `release/tracking-plan-v2` → `master`.

### Commit convention

Conventional Commits :
```
feat(tracking-plan): add Zod schema for TrackingPlan
fix(tracking-plan): handle null bundleId in export
chore(tracking-plan): rename legacy tables to _legacy_v1
test(tracking-plan): cover placeholder validator edge cases
docs(tracking-plan): update OpenAPI spec
```

## 3. Découpage en phases (sprints de 1 semaine)

### Sprint 1 — Data + Backend foundations (M3a, M3b)
- TP2-001 à TP2-008
- Livrable : repository + service + validator + tests unit verts

### Sprint 2 — Backend API + Export (M3c, M3d)
- TP2-009 à TP2-016
- Livrable : 9 endpoints + exporter unifié + OpenAPI

### Sprint 3 — Frontend primitives + Home (M4a, M4d partiel)
- TP2-017 à TP2-024
- Livrable : composants partagés + page home + Storybook

### Sprint 4 — Wizard 5 steps (M4b)
- TP2-025 à TP2-032
- Livrable : wizard complet + E2E happy path

### Sprint 5 — Expert mode + Sync + History (M4c, M4d complet)
- TP2-033 à TP2-040
- Livrable : 3 layouts complets + i18n

### Sprint 6 — Tests + Migration + Runbook (M5a-g)
- TP2-041 à TP2-050
- Livrable : suite tests complète + migration prod + go-live

Total : ~50 tickets sur 6 sprints (8.3 tickets/sprint = 1.5/jour, raisonnable).

## 4. Définition de "Done" pour un ticket

- [ ] Code implémenté.
- [ ] Tests unitaires couvrent la nouvelle logique (≥ 80%).
- [ ] Tests E2E ajoutés si flux user touché.
- [ ] Documentation mise à jour (si pertinent : OpenAPI, README de section, types).
- [ ] PR créée avec description claire + screenshots si UI.
- [ ] CI verte (lint + tests + a11y).
- [ ] Review approuvée.
- [ ] Merged dans `release/tracking-plan-v2`.

## 5. Définition de "Done" pour une release

- [ ] Tous tickets sprints 1-6 fermés.
- [ ] Couverture globale `lib/tracking/plan/` ≥ 80%.
- [ ] E2E pass sur fr-MA (et structure ar-MA validée).
- [ ] Lighthouse a11y ≥ 95.
- [ ] Test ultime d'intégration validé.
- [ ] Runbook deploy + rollback rehearsé en staging.
- [ ] Migration dry-run sur copie de prod réussit.
- [ ] Feature flag `TRACKING_PLAN_V2_ENABLED` testé ON et OFF.

## 6. Outillage dev

### Variables d'environnement (nouvelles)

```bash
# Feature flag
TRACKING_PLAN_V2_ENABLED=false              # défaut false en dev avant impl complète
TRACKING_PLAN_V2_LEGACY_ROUTES_ENABLED=true # garde routes legacy actives pendant transition

# Cache
TRACKING_PLAN_CACHE_TTL_MS=30000

# Validation
TRACKING_PLAN_STRICT_PLACEHOLDERS=true      # refuse les placeholders en prod
```

### Scripts npm

```json
{
  "scripts": {
    "tracking-plan:migrate": "drizzle-kit migrate --schema=./src/lib/db/schema/tracking-plan.ts",
    "tracking-plan:seed": "tsx scripts/seed-tracking-plan.ts",
    "tracking-plan:test-export": "tsx scripts/test-export-plan.ts",
    "tracking-plan:dry-run": "tsx scripts/migrate-tracking-plan.ts --dry-run",
    "tracking-plan:validate-prod": "tsx scripts/validate-prod-plans.ts"
  }
}
```

### Pre-commit hooks (existants)

- `lint-staged` : ESLint + Prettier sur fichiers modifiés.
- Type check : `tsc --noEmit`.
- Format check.

## 7. Code conventions

### Naming

- Domain logic : `lib/tracking/plan/` (singulier `plan` car concept unifié).
- Composants React : `PascalCase`.
- Hooks : `use*` (e.g. `useTrackingPlan`, `usePlanStore`).
- Constantes : `SCREAMING_SNAKE_CASE`.
- Fichiers : `kebab-case` (e.g. `tracking-plan-service.ts`).

### Imports

Ordre : externes → internes absolus → internes relatifs.

```typescript
import { useEffect } from 'react'
import { z } from 'zod'

import { db } from '@/lib/db'
import { TrackingPlan } from '@/lib/tracking/plan/types'

import { Step1Providers } from './step-1-providers'
```

### Types vs interfaces

Préférer `type` (sauf cas où `interface` permet extension utile).

### Error handling

Toujours typer les erreurs métier :
```typescript
export class PlanNotFoundError extends Error {
  constructor(public planId: string) {
    super(`Plan ${planId} not found`)
    this.name = 'PlanNotFoundError'
  }
}
```

Server endpoint catches → mappe en HTTP error → JSON response standard.

### Async/Await

Préférer `async/await` à `.then().catch()`. Toujours wrapper en try/catch dans le code applicatif (Boundary HOC en frontend).

## 8. Performance budget

| Métrique | Budget |
|---|---|
| Bundle module tracking (gzipped) | < 80kb |
| Tree-shakeable exports | 100% |
| Pas de barrel files lourds | OK |
| Lazy load expert mode | OK (dynamic import) |
| Lazy load JSON preview | OK |

## 9. Outils de qualité

### CI checks (bloquants)

1. ESLint (+ jsx-a11y plugin) → 0 warning.
2. TypeScript → 0 error.
3. Jest → all pass + coverage ≥ 80%.
4. Playwright → all pass.
5. axe-core → 0 serious/critical violation.
6. Bundle analyzer → respect budget.
7. Lighthouse CI → score perf ≥ 80, a11y ≥ 95.

### Tools

- Prettier (formattage).
- Husky (git hooks).
- lint-staged (incremental linting).
- Drizzle Studio (debug DB localement).
- TanStack Query Devtools (debug fetch/cache).

## 10. Documentation pendant dev

Pour chaque ticket significatif :
- Mettre à jour la section concernée du dossier `unified-tracking/`.
- Ajouter des JSDoc sur les fonctions complexes (signature only, pas de What).
- Mettre à jour OpenAPI si endpoint ajouté/modifié.

À éviter : commentaires "What" dans le code (le code se suffit). Préférer "Why" si non évident.
