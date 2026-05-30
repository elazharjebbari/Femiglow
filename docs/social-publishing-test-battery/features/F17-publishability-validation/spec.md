# F17 — Publishability validation

## Importance : 🔴 P0

## Objectif
Fonction `getPostPublishability()` qui valide tous les pré-requis avant publish. Source de vérité unique pour pre-flight.

## Vérifications effectuées (dans l'ordre)

1. **Post existe** (404 si non)
2. **post.status ∈ {approved, scheduled}** (sinon 409 invalid_state)
3. **draft.status='approved'** (sinon 409 invalid_state)
4. **Brand review** : `getLatestReview(draftId).status !== 'blocked'` (sinon 409 brand_review_blocked)
5. **Account** :
   - Un compte actif existe pour platform (409 no_account_connected)
   - Si `accountId` fourni : ce compte existe + status='active'
6. **Capabilities** :
   - capability.format matches draft.format (409 format_not_supported)
   - Si capability.mediaRequired : draft a au moins 1 asset_binding (409 no_media_attached)
7. **Média** :
   - media existe, non deleted
   - media.status ∈ {ready, passthrough}
   - originalUrl est HTTPS
8. **Caption** : length ≤ capability.maxCaptionLength (409 caption_too_long)
9. **Tags** : warning si > 25 hashtags (mais pas bloquant)

## Tests
Voir `test-scenarios.yaml`.
