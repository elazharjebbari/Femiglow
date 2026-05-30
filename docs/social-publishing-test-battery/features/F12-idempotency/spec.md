# F12 — Idempotency

## Importance : 🔴 P0

## Objectif
Garantir qu'une publication n'est jamais dupliquée même en cas de double-click, retry réseau, ou race condition.

## Comportement attendu

### Génération de la clé
- Si client fournit `idempotencyKey`, celle-ci est utilisée
- Sinon, server génère : `content-studio:${postId}:${accountId}:${mode}:${scheduledAt?}`
- Stockée dans `social_publish_job.idempotencyKey` (UNIQUE constraint)

### Comportement double appel
- 1er appel avec key='k1' → INSERT job, status='queued', execute
- 2ème appel avec key='k1' → return existing job, no INSERT, no execute

### Race condition
- 2 requêtes simultanées avec même clé → seule 1 INSERT réussit (UNIQUE constraint) ; l'autre return l'existante
- Pas de double publish sur Postiz

### Header Idempotency-Key
- Si présent dans header HTTP, fallback sur celui-ci si pas dans body

## Tests
Voir `test-scenarios.yaml`. Inclut un test race via Promise.all simulant 2 requêtes simultanées.
