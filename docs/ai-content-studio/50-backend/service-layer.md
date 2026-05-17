# Backend — service layer

## Services

### `contentIdeaService`

- `createIdea(input, actor)`
- `listIdeas(filters)`
- `archiveIdea(id, actor)`
- `convertToBrief(id, strategy)`

### `contentGenerationService`

- `generateBrief(ideaId)`
- `generateDrafts(briefId, count)`
- `generateVisualPrompt(briefId, mediaRefs)`
- `regenerateDraft(draftId, instruction)`

Garde-fous :

- budget par jour ;
- timeout ;
- max variantes ;
- prompt versionné ;
- pas de contenu publié sans review.

### `brandReviewService`

- `reviewText(caption, brief)`
- `reviewVisual(mediaId, brief)`
- `reviewDraft(draftId)`

Retour :

```json
{
  "status": "warning",
  "scoreTotal": 82,
  "violations": [
    {"severity": "warning", "rule": "cta_too_direct", "message": "CTA trop marchand"}
  ]
}
```

### `postizBridge`

- `listIntegrations()`
- `uploadFile(media)`
- `uploadFromUrl(url)`
- `createPost(payload, idempotencyKey)`
- `listPosts(filters)`
- `getPostAnalytics(postizPostId)`
- `deletePost(postizPostId)`

Exigences :

- ne jamais exposer la clé API client ;
- log redacted ;
- retry uniquement sur erreurs réseau/5xx ;
- pas de retry sur validation 4xx ;
- idempotency interne côté FemiGlow même si Postiz n’en fournit pas.

### `schedulerService`

- vérifie que `draft.status = approved` ;
- vérifie `brandReview.status != blocked` ;
- vérifie asset `ready` ;
- construit payload Postiz ;
- crée `content_postiz_delivery`;
- met à jour statut.

## Codes erreurs

| Code | HTTP | Description |
| --- | ---: | --- |
| `content_invalid_input` | 422 | Payload invalide |
| `content_not_found` | 404 | Objet introuvable |
| `content_invalid_state` | 409 | Transition impossible |
| `content_brand_blocked` | 409 | Draft bloqué par charte |
| `content_asset_unready` | 409 | Média non prêt |
| `content_provider_failed` | 502 | Provider IA indisponible |
| `content_postiz_failed` | 502 | Postiz indisponible ou erreur API |
| `content_budget_exceeded` | 429 | Budget IA atteint |
| `content_rate_limited` | 429 | Trop de générations |

