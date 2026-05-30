# S05 — Publication multi-comptes / multi-plateformes

## Pré-conditions
- 2 comptes : IG actif + FB actif
- 1 post approuvé compatible IG/FB (format=post)

## Étapes
1. /create avec post
2. Click Publier → "Publier maintenant"
3. Dialog confirm avec sélecteur "Comptes" (multi-select)
4. Sélectionne les 2 comptes
5. Confirme
6. Toast "2 publications lancées"
7. JobQueue : 2 jobs distincts (1 par compte), idempotency keys différentes
8. Les 2 jobs passent à 'published'

## Critères
- 2 INSERTs social_publish_job
- 2 idempotency keys distinctes
- 2 POST Postiz /posts (1 par compte)
- 2 audit_log entries

## Spec
`e2e/social-publishing/multi-platform-bulk.spec.ts`
