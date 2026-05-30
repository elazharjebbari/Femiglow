# F14 — Publier maintenant

## Objectif
Déclencher la publication immédiate vers les comptes connectés via Postiz, depuis le PublishActionGroup.

## Comportement attendu
- Option "Publier maintenant" dans le dropdown
- Dialog de confirmation avec récap (aperçu média + caption tronquée)
- Appel `POST /posts/:id/publish-now { idempotencyKey }`
- Job(s) créé(s) (un par compte connecté)
- Toast succès + redirection optionnelle vers le détail du post

## Comportement actuel
Endpoint OK. Dialog basique présent. Récap absent. Pas de mock mode bandeau.

## Gaps
- G12 : pas de récap visuel (adressé ici)
- G13 : erreurs opaques (adressé ici)

## Propositions
### A — Dialog enrichi (thumbnail + caption + plateforme)
### B — Modal dédié plein écran
### C — Inline expander (pas de modal)

## Recommandation
**A** — Dialog enrichi.

## Implementation
- Étendre le Dialog avec récap visuel
- Map erreurs : budget_exceeded, brand_review_blocked, no_account_connected → messages clairs
- Si mockMode : badge "Publication simulée" inline

## Tests
Voir `test-scenarios.yaml`.
