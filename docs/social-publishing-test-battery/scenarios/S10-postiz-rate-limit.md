# S10 — Postiz rate limit

## Pré-conditions
- Postiz quota épuisé (429 sur premier upload ou post)

## Étapes
1. publish-now → upload → 429 → retry 100ms → 429 → 300ms → 429 → 900ms → 429 → status='failed', code='provider_rate_limited'
2. Toast "Trop de requêtes, réessayez dans un instant."
3. JobQueue row failed
4. (Attendre 1h, quota reset) Click Retry → succès

## Critères
- 4 attempts max
- Backoff délais corrects
- Final status='failed' avec code mappé

## Spec
`e2e/social-publishing/postiz-rate-limit.spec.ts`
