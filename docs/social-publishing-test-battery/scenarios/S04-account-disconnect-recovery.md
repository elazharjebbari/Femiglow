# S04 — Recovery après déconnexion compte

## Pré-conditions
- 1 compte IG avec status='token_expired'

## Étapes
1. Home → AccountHealthCard montre compte avec badge warning
2. Tente publish-now → 401 token_expired → toast "Compte expiré, reconnectez-le"
3. (Hors UI FemiGlow) Re-OAuth via Postiz
4. Click "Sync comptes" sur AccountHealthCard
5. Account status passe à 'active'
6. Retente publish-now → succès

## Critères
- 1ère tentative bloquée pre-flight (pas de fetch Postiz)
- 2ème tentative succès après sync

## Spec
`e2e/social-publishing/account-disconnect.spec.ts`
