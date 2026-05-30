# F16 — Brand review gate

## Importance : 🟠 P1

## Objectif
Bloquer la publication si le brand review du draft est en status='blocked'.

## Comportement attendu

### Pre-flight (getPostPublishability)
- Lit le dernier `content_brand_review` du draft
- Si status='blocked' → throw HttpError code='brand_review_blocked'
- Si status='warning' → laisse passer (juste un warning UI ailleurs)

### UI feedback
- ApproveButton avant publish déjà disabled si brand blocked (cf audit precedent)
- Si malgré tout l'opérateur lance publish-now et que brand bascule après → 409 + toast mappé

## Tests
Voir `test-scenarios.yaml`.
