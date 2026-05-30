# S11 — Idempotency race condition

## Pré-conditions
- 1 post approuvé

## Étapes
1. Spec lance 2 publish-now en parallèle (Promise.all) avec même idempotencyKey
2. Vérifie qu'une seule INSERT social_publish_job a eu lieu (UNIQUE constraint)
3. Les 2 requêtes retournent la même job.id
4. Postiz appelé 1 seule fois (pas de double publish)

## Critères
- 1 INSERT en DB (l'autre rejected par UNIQUE)
- 2 responses 200 avec même job.id
- 1 seul POST Postiz /posts

## Spec
`e2e/social-publishing/idempotency-race.spec.ts`
