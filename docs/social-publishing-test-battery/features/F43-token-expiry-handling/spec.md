# F43 — Token expiry handling

## Importance : 🟠 P1

## Objectif
Détecter et signaler quand un compte Postiz a son token OAuth expiré.

## Comportement
- Adapter retourne `token_expired` sur 401 Postiz
- `social_account.status='token_expired'` après détection
- UI : badge warning + lien "Reconnecter"
- Pre-flight `getPostPublishability` rejette si account.status='token_expired'

## Tests
Voir `test-scenarios.yaml`.
