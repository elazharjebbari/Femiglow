# Architecture cible

## Vue logique

Le studio s’intègre dans l’admin FemiGlow et s’appuie sur des services internes. Postiz reste externe.

```txt
Admin UI
  -> Content Studio API
    -> Content Repository
    -> Media Repository
    -> Product/Article Sources
    -> Generation Service
    -> Brand Review Service
    -> Postiz Bridge
    -> Scheduler Jobs
    -> Analytics Import
```

## Modules à créer

| Module | Chemin cible | Responsabilité |
| --- | --- | --- |
| Routes admin | `src/app/admin/content-studio/**` | UI serveur/client |
| API admin | `src/app/api/admin/content-studio/**` | CRUD, génération, review, schedule |
| Lib content | `src/lib/content-studio/**` | Services métier |
| DB schema | `src/lib/db/schema.ts` ou fichier dédié importé | Tables Drizzle |
| Jobs | `src/app/api/cron/content-studio/**` | sync, retry, analytics |
| Tests | `src/lib/content-studio/*.test.ts` et route tests | Qualité |

## Services internes

| Service | Rôle |
| --- | --- |
| `ideaService` | Créer, classer, convertir idées en briefs |
| `briefService` | Générer briefs structurés |
| `textGenerationService` | Générer captions et variantes |
| `visualDirectionService` | Définir prompts et sélectionner assets |
| `brandReviewService` | Score déterministe + score IA |
| `postizBridge` | API client Postiz |
| `schedulerService` | Prépare publications et retries |
| `analyticsService` | Importe métriques et calcule insights |
| `auditService` | Trace toute action sensible |

## State machine

```txt
idea
  -> brief
  -> generated
  -> needs_review
  -> approved
  -> scheduled
  -> published
  -> measured

Transitions alternatives:
generated -> rejected
needs_review -> rejected
approved -> archived
scheduled -> cancelled
scheduled -> failed
failed -> retry_pending
retry_pending -> scheduled
```

## Règles d’intégration

- Les appels IA et Postiz sont serveur uniquement.
- Les API keys restent dans `env.ts`.
- Toute action générative crée un `generation_run`.
- Tout export Postiz crée un `postiz_delivery`.
- Toute validation humaine crée un audit event.
- Les prompts de marque sont versionnés.
- Les outputs IA ne remplacent jamais les données produit officielles.

