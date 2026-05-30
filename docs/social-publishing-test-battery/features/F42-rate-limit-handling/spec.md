# F42 — Rate limit handling

## Importance : 🟠 P1

## Objectif
Gérer gracieusement les 429 retournés par Postiz (rate limit).

## Comportement
- Adapter retourne `provider_rate_limited`, retryable=true
- Retry strategy avec backoff (cf F23)
- Si retries exhausted → status='failed', toast UI mappé
- (Futur) honor Retry-After header si fourni

## Tests
Voir `test-scenarios.yaml`.
