# F19 — Postiz adapter

## Importance : 🔴 P0

## Objectif
Adapter qui traduit `SocialPublishRequest` → appels Postiz API, et map les réponses/erreurs Postiz → `SocialPublishResult`.

## Capacités exposées
- `publish(request)` : crée le post Postiz (modes now/schedule/draft)
- `listCapabilities(account)` : ce que le compte peut faire selon platform
- `getInsights(publication)` : récupère les analytics Postiz

## Flow publish
1. Upload chaque média via POST Postiz `/upload`
2. Construire payload via `buildPostizDraftPayload`
3. POST Postiz `/posts` (type='now'|'schedule'|'draft')
4. Extraire postizPostId et permalink
5. Retourner `{ remoteId, permalink, raw }`

## Error extraction
- 4xx response → parse `error.message` ou `error.code`
- 401 → `token_expired`
- 422 → `invalid_payload`
- 429 → `provider_rate_limited` (retryable)
- 5xx → `provider_unavailable` (retryable)

## Tests
Voir `test-scenarios.yaml`. Couvre payload, error mapping, retry, idempotency.
