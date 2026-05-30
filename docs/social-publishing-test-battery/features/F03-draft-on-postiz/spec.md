# F03 — Brouillon Postiz

## Importance : 🟠 P1

## Objectif
Envoyer le contenu côté Postiz en mode brouillon (`type='draft'`). Le post n'est PAS publié sur Instagram/Facebook ; il atterrit dans la file de drafts de l'UI Postiz, où un opérateur (depuis Postiz directement) le validera manuellement.

## Comportement attendu

### UI flow
1. Click "Publier" → "Brouillon Postiz"
2. Dialog confirm avec G12 preview + texte explicatif
3. Click "Envoyer" → API call
4. Toast "Brouillon envoyé au provider" (+ lien "Ouvrir Postiz" optionnel)
5. Le post **reste** en status='approved' (pas publié)
6. Un job `mode='draft'` apparaît dans JobQueue avec status='published' (le draft est "published" côté Postiz, pas Instagram)

### API call
- `POST /api/admin/content-studio/posts/:postId/draft-on-provider`
- Body : `{ accountId?, idempotencyKey? }`

### Postiz reçoit
- `POST /api/public/v1/posts` avec `type='draft'`, payload identique sauf le type
- Postiz crée une entrée draft visible dans son UI

### Audit log
- Action : `social.draft_created` (pas `published`)
- Meta : `{ jobId, provider, platform, remoteId (draft id) }`

## Différence vs F01
- F01 : Postiz `type='now'` → Instagram immédiatement
- F03 : Postiz `type='draft'` → Postiz UI seulement

## Cas d'erreur

| Cas | HTTP | Code | UI |
|-----|------|------|----|
| Capability ne supporte pas draft | 409 | `capability_not_supported` | Toast "Ce compte ne supporte pas les brouillons" |
| Postiz down | 503 | `provider_unavailable` | Toast |
| Autres | comme F01 |

## Tests à écrire
Voir `test-scenarios.yaml`.
