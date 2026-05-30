# S17 — Token expiry détecté pendant publish

## Pré-conditions
- 1 compte IG actif côté FemiGlow (sync récente)
- Token Postiz a expiré (côté Postiz, pas encore reflété dans FemiGlow)

## Étapes
1. publish-now → Postiz retourne 401
2. Adapter map → code='token_expired', non-retryable
3. social_account.status UPDATE → 'token_expired'
4. social_publish_job.status='failed' avec lastError.code='token_expired'
5. Toast "Compte expiré, reconnectez-le."
6. AccountHealthCard sur Home affiche warning sur ce compte
7. Slack alert envoyée

## Critères
- Détection 401 → maj account.status
- UI reflète immédiatement (badge warning)
- Pas de retry (non retryable)

## Spec
`e2e/social-publishing/token-expiry.spec.ts`
