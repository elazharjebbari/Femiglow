# F41 — Live Instagram test (AlFenna Beauty)

## Importance : 🔴 P0 (validation E2E réelle)

## Objectif
Valider en chaîne réelle le pipeline complet publish-now sur Instagram AlFenna Beauty via Postiz.

## Cadre
- Voir `05-live-testing-protocol.md` pour le protocole complet
- Voir `scenarios/S13-live-instagram-alfenna.md` pour le scénario détaillé
- 1 seul spec `e2e/social-publishing/live-instagram-alfenna.spec.ts`
- Marqué `@live`, exclu par défaut
- Opt-in via `E2E_LIVE_POSTIZ=1`

## Validations
- DB delivery sent + postizPostId
- Postiz API GET /posts/:id retourne le post
- Audit log social.publish.published
- Cleanup automatique (DELETE Postiz)

## Tests
Voir `test-scenarios.yaml`.
