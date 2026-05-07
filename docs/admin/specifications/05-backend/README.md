# 05 — Backend

Spécification du backend admin FemiGlow : structure de fichiers,
contrats d'API (OpenAPI 3.1), middleware, authentification,
moteur de webhooks, jobs cron, gestion d'erreurs, validation,
rate limiting, logging.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`structure-fichiers.txt`](./structure-fichiers.txt) | Arborescence complète `src/lib/`, `src/app/api/admin/` |
| [`api-endpoints.md`](./api-endpoints.md) | Catalogue exhaustif des routes admin (méthode, path, auth, body, réponse) |
| [`api-openapi.yaml`](./api-openapi.yaml) | Contrat OpenAPI 3.1 complet |
| [`middleware.md`](./middleware.md) | `middleware.ts` Next.js : auth, redirects, headers |
| [`auth-flow.md`](./auth-flow.md) | Flow login/logout, iron-session, argon2id, brute-force protection |
| [`webhook-engine.md`](./webhook-engine.md) | Cycle de vie d'une livraison, état machine, retry policy |
| [`cron-jobs.md`](./cron-jobs.md) | Configuration Vercel Cron, endpoint `/api/cron/tick`, batch processing |
| [`error-handling.md`](./error-handling.md) | Format d'erreur unifié, codes internes, mapping HTTP |
| [`rate-limiting.md`](./rate-limiting.md) | Stratégie Postgres (windowing), seuils par route |
| [`validation-zod.md`](./validation-zod.md) | Convention de schémas Zod, partage front/back |
| [`logging-observabilite.md`](./logging-observabilite.md) | Format JSON, niveaux, corrélation, redaction PII |

## Principes

1. **API explicites, pas d'auto-magie** — pas de Server Actions en v1.
2. **Validation au boundary** — chaque entrée passe par un schéma Zod avant d'atteindre la couche métier.
3. **Erreurs structurées** — toujours `{ error, issues? }` avec un code interne stable.
4. **Idempotence** — toute mutation supportant un retry doit être idempotente.
5. **Logging structuré** — un événement par ligne JSON, jamais de PII en clair.
