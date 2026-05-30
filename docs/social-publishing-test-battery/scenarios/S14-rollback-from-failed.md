# S14 — Rollback from failed state

## Pré-conditions
- 1 job en status='failed' (post.status='approved' encore)

## Étapes
1. JobQueue → row failed visible
2. Click "Voir le post" → navigate /library/post-id
3. Vérifie : post.status='approved' (pas modifié par l'échec job)
4. Retour /create → état du post permet retry
5. Click Publier → publish-now → succès

## Critères
- Un job failed ne bloque pas le post pour re-publication
- L'opérateur peut soit Retry (depuis JobQueue) soit re-publier (depuis Create) — les 2 chemins fonctionnent

## Spec
Couvert par test composant + S06.
