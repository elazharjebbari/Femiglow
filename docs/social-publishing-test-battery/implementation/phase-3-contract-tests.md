# Phase 3 — Contract tests

## Objectif
100% des routes API publish ont ≥ 6 cas couverts.

## Fichiers à créer (9)

Voir liste dans `01-action-plan.md` Phase 3.

Pattern : mock auth + service, valider 200/201/400/401/404/409/500.

## Durée
~1 j-p

## Commande
```bash
pnpm vitest run src/test/api-contracts/social-publishing-*.contract.test.ts
```

## Acceptance
- [ ] 9 fichiers contract créés
- [ ] ~60 tests
- [ ] Tous verts
- [ ] Chaque route teste : success, validation par champ, auth, état métier, rate-limit, idempotency
