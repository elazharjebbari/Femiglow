# Seeders Runner — Runbook

**Objectif** — Centraliser dans `/admin/settings/seeders` la possibilité de
relancer **n'importe quel feed par défaut** (navigation, flags, rbac, branding,
form-config, delivery-cities, SEO, produits, tracking, chat:instructions,
chat:theme, chat:providers, rituals, components, media) avec :
- sélection fine (case à cocher par feed + “Tout / Aucun / Par groupe”)
- suivi d'avancement en direct (SSE) : barre globale, ETA, état par feed
- annulation à chaud, audit, rejouable

## Inventaire (15 feeds)

| ID | Groupe | Label | ETA (ms) | Idempotent | Source |
|---|---|---|---|---|---|
| `navigation` | core | Navigation admin | 200 | ✓ UPSERT | `lib/admin-config/defaults.ts` |
| `flags` | core | Feature flags | 200 | ✓ UPSERT | `lib/admin-config/defaults.ts` |
| `rbac` | core | RBAC matrice | 200 | ✓ UPSERT | `lib/admin-config/defaults.ts` |
| `branding` | core | Branding | 200 | ✓ UPSERT | `lib/admin-config/defaults.ts` |
| `form-config` | core | Form-config (wizards kit + commander) | 600 | ✓ versionné | migration 0018 + `lib/checkout/form-config` |
| `seo` | content | SEO settings + 13 overrides | 1500 | ✓ UPSERT | `scripts/seed-seo.ts` |
| `products` | commerce | Produits + variantes | 1200 | ✓ UPSERT | `scripts/seed-products.ts` |
| `delivery-cities` | commerce | 430 villes Maroc | 3500 | ✓ préserve admin edits | `scripts/seed-delivery-cities.ts` |
| `components` | content | Site components depuis docs/images | 8000 | ✓ reconcile | `lib/components/seed-pipeline.ts` |
| `media` | content | Médias depuis docs/images | 10000 | ✓ skip si slug existe | `scripts/seed-media.ts` |
| `chat:instructions` | chat | Instructions v2 (FR + AR + AR-MA) | 800 | ✓ skip si body identique | `scripts/seed-chat-instructions-v2.ts` |
| `chat:theme` | chat | Theme preset par défaut | 200 | ✓ skip si default existe | `scripts/seed-chat.ts` |
| `chat:providers` | chat | Providers (OpenAI/Anthropic/…) | 300 | ✓ skip si ≥1 provider | `scripts/seed-chat.ts` |
| `tracking` | tracking | Providers + events + pages + components | 5000 | ✓ UPSERT | `scripts/seed-tracking.ts` |
| `rituals` | content | ~30 testimonials seed | 4000 | ✓ skip par body hash | `scripts/seed-rituals.ts` |

ETA = estimation typique en dev local. L'ETA réel se recalibre par run (cf. § Mesure).

## Architecture

```
src/lib/seeders/
├── types.ts              # SeederDescriptor, SeederEvent, SeederResult
├── registry.ts           # Liste les 15 SeederDescriptor
├── job-store.ts          # In-memory: jobs + buffer d'events pour SSE replay
├── orchestrator.ts       # runJob(jobId, ids, actorId) → enchaîne sequentially
└── items/
    ├── app-config.ts     # 4 wrappers (nav, flags, rbac, branding)
    ├── form-config.ts
    ├── delivery-cities.ts
    ├── seo.ts
    ├── products.ts
    ├── components.ts
    ├── media.ts
    ├── chat-instructions.ts
    ├── chat-theme.ts
    ├── chat-providers.ts
    ├── tracking.ts
    └── rituals.ts

src/app/api/admin/seeders/
├── route.ts                          # GET → liste registry (id, label, ETA, group)
├── run/route.ts                      # POST {ids[]} → {jobId}
└── jobs/[jobId]/
    ├── stream/route.ts               # GET SSE (events: job.start, seeder.start, seeder.progress, seeder.complete, seeder.error, job.complete)
    └── cancel/route.ts               # POST

src/app/admin/settings/seeders/page.tsx     # Server RSC (RBAC gate + fetch registry)
src/components/admin/settings/SeedersRunner.tsx  # Client: checkboxes + run + SSE
```

### Event model (SSE)

Tous les events ont un `ts` (epoch ms) et `jobId`.

- `job.start` `{ jobId, ids, total, startedAt }`
- `seeder.start` `{ id, index, etaMs }`
- `seeder.progress` `{ id, stepLabel, fraction }`  (fraction 0..1, optionnel)
- `seeder.complete` `{ id, durationMs, report }`
- `seeder.error` `{ id, durationMs, message }`
- `seeder.skipped` `{ id, reason }` (si désélectionné, ou dependsOn failed)
- `job.complete` `{ jobId, durationMs, succeeded, failed }`
- `job.cancelled` `{ jobId, cancelledAt }`

### Job state (in-memory)

```ts
type JobState = {
  id: string;            // 'job_<random>'
  selected: string[];    // seeder ids
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  finishedAt?: number;
  events: SeederEvent[]; // ringbuffer pour SSE late-subscribers (max 500)
  emitter: EventEmitter; // node EventEmitter pour fan-out aux SSE clients
  abort: AbortController;
  actorId: string;
};
```

State conservé 1 h dans une `Map<string, JobState>` (singleton). Suffit pour
suivre un run même si le navigateur reconnecte le SSE.

### ETA

ETA initial = `descriptor.estimatedDurationMs`. ETA dynamique = moyenne
glissante des 3 derniers runs (stockée en mémoire process — pas critique). Le
client recalcule `eta_restant = somme(ETA seeders restants) - elapsed_seeder_courant`.

## UI/UX

Page `/admin/settings/seeders` (RBAC `app-config:write`).

```
┌─ Seeders Runner ───────────────────────────────────────────────┐
│ Réamorce ta configuration par défaut. Idempotent — pas de wipe.│
├────────────────────────────────────────────────────────────────┤
│ [Tout]  [Aucun]  [Core only] [Chat only] [Commerce only]       │
│                                                                │
│ ☑ Core (4)                                                     │
│   ☑ Navigation admin               ~200ms   prêt               │
│   ☑ Feature flags                  ~200ms   prêt               │
│   ☑ RBAC matrice                   ~200ms   prêt               │
│   ☑ Branding                       ~200ms   prêt               │
│   ☑ Form-config (wizards)          ~600ms   prêt               │
│ ☑ Chat (3) …                                                   │
│ ☑ Commerce (3) …                                               │
│ ☑ Content (3) …                                                │
│ ☑ Tracking (2) …                                               │
│                                                                │
│  ETA total : ~36 s        [Lancer 15 feeds]   [Annuler]        │
└────────────────────────────────────────────────────────────────┘
```

Pendant run :

```
█████████████████░░░░░░░░░░░░░░  62 %   reste ~14 s
✓ Navigation admin          198 ms
✓ Feature flags             204 ms
⟳ Branding                  en cours…  «upsert app_config»
☐ RBAC matrice              en attente
✓ Form-config               412 ms · v3 created
…
```

Chaque ligne : pill statut (idle/running/done/error/cancelled) + step label
courant + durée (ou ETA si idle/queued).

### Accessibilité

- `role="status"` sur le compteur global + `aria-live="polite"`.
- Boutons `Lancer` / `Annuler` disabled selon état.
- Focus ring sur les cases à cocher.

## Sécurité

- Admin session obligatoire (`getAdminSession`).
- RBAC : `requireAdminCapability('app-config', 'write')` (déjà existant).
- Audit : chaque seeder qui réussit log `seeders.run` avec `meta = { id, durationMs }`.
- Pas d'exposition publique : tous les endpoints sous `/api/admin/seeders/*`.

## Tests

- `seeders/registry.test.ts` — chaque descriptor a id unique, ETA > 0, run fn.
- `seeders/job-store.test.ts` — create/get/emit/replay events.
- `seeders/orchestrator.test.ts` — séquence, error path, cancel mid-run.
- `seeders/items/app-config.test.ts` — re-seed nav et vérifie payload.
- `e2e/admin-seeders.spec.ts` — Playwright : sélectionner Core only,
  cliquer Run, voir 4 lignes pass, screenshot final.

## Phases

1. ✅ P0 inventaire
2. ✅ P1 patterns lus
3. ✅ P2 runbook (ce doc)
4. P3 backend `lib/seeders/*` (types/registry/job-store/orchestrator)
5. P4 15 wrappers `items/*`
6. P5 API : `GET /api/admin/seeders` + `POST run` + `GET stream` + `POST cancel`
7. P6 UI `/admin/settings/seeders` (page + composant client)
8. P7 Card sur `/admin/settings`
9. P8 Tests
10. P9 Build prod + verify live (curl + Claude_Preview screenshots)
