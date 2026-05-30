# F01 — Publier maintenant (direct)

## Importance : 🔴 P0 (cœur du module)

## Objectif
L'opérateur peut envoyer un post sur les réseaux sociaux immédiatement, via le compte Postiz lié, en cliquant "Publier maintenant" depuis l'écran Create ou Plan.

## Comportement attendu

### Pré-conditions
- 1 post approuvé (status='approved') avec :
  - draft.status='approved'
  - brand_review.status='pass' ou 'warning' (pas 'blocked')
  - au moins 1 média attaché via `content_asset_binding`
  - caption non vide, ≤ capability.maxLength
- 1 compte social actif (`social_account.status='active'`)

### UI flow
1. Opérateur ouvre `/admin/content-studio-v2/create` avec un post approuvé sélectionné
2. Le bouton "Publier" (dropdown) est **enabled** (postId existe)
3. Click "Publier" → dropdown s'ouvre
4. Click "Publier maintenant" → Dialog confirm s'ouvre
5. Dialog contient :
   - Thumbnail du média + caption tronquée (140 chars)
   - Platform tag (📱 instagram / facebook)
   - Format tag (post / reel / story / carousel)
   - Badge "Mode mock" si applicable
   - Warning : "Cette action ne peut pas être annulée une fois le contenu publié côté plateforme."
6. Click "Confirmer" → loading spinner sur le bouton
7. Toast succès "Publication lancée" (+ "(mock)" si applicable)
8. Dialog ferme
9. Le post apparaît dans JobQueue avec status='queued' puis 'publishing' puis 'published'

### API call
- `POST /api/admin/content-studio/posts/:postId/publish-now`
- Body : `{ accountId?, idempotencyKey? }`
- Headers : cookie admin

### Side effects
- Idempotency check : si `idempotencyKey` déjà utilisée → retourne le job existant (pas double publish)
- Pré-validation : `getPostPublishability()`
- INSERT `social_publish_job` (status='queued', mode='now')
- `executeJob` :
  - Acquire lock atomiquement
  - `publishWithAdapter(postiz, request)` :
    - POST Postiz `/upload` pour chaque média
    - POST Postiz `/posts` avec `type='now'`
    - Postiz publie sur Instagram/Facebook
  - INSERT `social_publish_attempt` (succeeded)
  - INSERT `social_publish_publication` (remoteId, permalink)
  - UPDATE `content_post.status='published'`, `publishedAt=now`
  - UPDATE `content_postiz_delivery.status='sent'`, `postizPostId`
  - INSERT `audit_log` `social.publish.published`

### Réponse API
```json
{
  "status": "queued",
  "jobs": [
    {
      "id": "spj_...",
      "postId": "post_...",
      "accountId": "sa_...",
      "provider": "postiz",
      "platform": "instagram",
      "format": "post",
      "status": "published",
      "publishedAt": "2026-05-28T..."
    }
  ]
}
```

## Cas d'erreur

| Cas | HTTP | Code | UI |
|-----|------|------|----|
| Post non approuvé | 409 | `invalid_state` | Toast "État de draft invalide" |
| Brand review bloqué | 409 | `brand_review_blocked` | Toast "Le contenu est bloqué…" |
| Pas de média | 409 | `no_media_attached` | Toast "Aucun média attaché…" |
| Pas de compte connecté | 409 | `no_account_connected` | Toast "Aucun compte social…" |
| Compte token expiré | 401 | `token_expired` | Toast "Session expirée…" |
| Postiz rate limit | 429 | `provider_rate_limited` | Toast "Trop de requêtes…" |
| Postiz down | 503 | `provider_unavailable` | Toast "Provider indisponible." |
| Budget dépassé | 402 | `budget_exceeded` | Toast "Budget IA quotidien atteint." |
| Idempotency replay | 200 | — | Toast "Publication lancée" (sans nouveau job DB) |

## Tests à écrire

Voir `test-scenarios.yaml`. Couvre :
- Happy path (publish-now → published)
- 9 chemins d'erreur ci-dessus
- Idempotency replay
- Multi-compte (1 post → 2 jobs si 2 comptes)
- UI feedback (toast, dialog open/close, dropdown trigger state)
- A11y dialog
