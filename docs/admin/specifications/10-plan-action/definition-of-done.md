# Definition of Done (DoD)

Une tâche/PR n'est **Done** que si tous les critères ci-dessous sont
satisfaits selon son type.

## DoD générique (toutes tâches)

- [ ] Code écrit en TypeScript strict, aucun `any` non justifié
- [ ] `pnpm lint` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm test` exit 0
- [ ] Aucun `console.log` ou commentaire `TODO/FIXME` non lié à un ticket
- [ ] Aucun secret committé (vérifié par gitleaks)
- [ ] Convention de nommage commits `ADM-NNN: <imperatif>`
- [ ] PR description : contexte + changements + tests + screenshots si UI
- [ ] 1 reviewer minimum a approuvé
- [ ] CI verte (lint + typecheck + vitest + playwright + axe)

## DoD spécifique : feature backend (API/lib)

- [ ] Schéma Zod côté entrée (validation à la frontière)
- [ ] Erreurs typées via `HttpError` (pas de `throw` brut)
- [ ] Logger structuré (`logger.info({ event, ... })`) sur succès et erreur
- [ ] Audit `audit_events` si action sensible
- [ ] Tests unitaires Vitest sur le handler / la fonction publique
- [ ] Test MSW d'intégration sur le scénario nominal
- [ ] Test MSW sur au moins 1 scénario d'erreur (4xx ou 5xx)
- [ ] Coverage du fichier ≥ 80 %
- [ ] OpenAPI mis à jour (si endpoint public ou admin)
- [ ] Documentation `api-endpoints.md` mise à jour

## DoD spécifique : feature frontend (page/composant)

- [ ] Composant typé (props + retour)
- [ ] States gérés : loading, empty, error, success
- [ ] Mobile : responsive testé en viewport 375px
- [ ] Desktop : viewport 1280px et 1920px
- [ ] Accessibilité :
  - [ ] `pnpm test` jest-axe → 0 violation critique
  - [ ] Tab order logique, focus visible
  - [ ] aria-label sur icônes-only buttons
  - [ ] Couleurs : contraste WCAG AA (4.5:1)
- [ ] Test E2E Playwright golden path
- [ ] Test E2E Playwright erreur (validation, 500)
- [ ] Test `@axe-core/playwright` sur la page
- [ ] Screenshot visuel attaché à la PR (avant/après si modification)
- [ ] Pas de FOUC ni de layout shift après hydratation

## DoD spécifique : migration DB

- [ ] Migration `drizzle-kit generate` propre (pas de DROP non
      intentionnel)
- [ ] Migration testée en preview branche Neon
- [ ] Migration testée roll-forward + roll-back si pertinent
- [ ] Aucune perte de données (additif uniquement, sauf cleanup
      explicite documenté)
- [ ] Index ajoutés justifiés (EXPLAIN ANALYZE attaché à la PR pour
      requêtes critiques)
- [ ] Rétention/soft-delete documenté si nouvelle table
- [ ] `schema.sql` régénéré dans `docs/admin/specifications/06-data/`

## DoD spécifique : sécurité

- [ ] Threat-model entry mis à jour si nouvelle surface d'attaque
- [ ] Contrôle ajouté/coché dans `controles.csv`
- [ ] Si crypto : test round-trip + edge case (clé invalide, timing)
- [ ] Si auth : test brute-force + session expiration
- [ ] Si webhook : test SSRF + signature invalide
- [ ] Si CSP : test que les resources légitimes passent + violation reportée

## DoD spécifique : test (ajout test)

- [ ] Test isolé (pas d'effet de bord vers d'autres tests)
- [ ] Setup/teardown propre (DB clean entre tests si applicable)
- [ ] Pas de timing-dependent (sleep/délais arbitraires)
- [ ] Assertions explicites (pas de `expect(true).toBe(true)`)
- [ ] Nom de test descriptif (`it('refuse une URL avec IP privée'`)
- [ ] Si flake intermittent : marqué `.skip` + ticket ouvert

## DoD spécifique : documentation

- [ ] Markdown valide (preview rendu OK)
- [ ] Pas de fautes d'orthographe (vérifier diacritiques fr)
- [ ] Liens internes valides (autres `.md` du repo)
- [ ] Code samples copiables et fonctionnels
- [ ] Pas de jargon non défini (premier usage explicité)

## DoD phase / livrable

À la clôture d'une phase (Px → Px+1) :

- [ ] Tous les tickets `ADM-NNN` de la phase mergés ou explicitement
      reportés
- [ ] Gate de sortie de phase atteint (cf. `phases.md`)
- [ ] Démo enregistrée (screencast 5-10 min)
- [ ] Métriques de phase reportées (coverage, perf, a11y)
- [ ] Décision `go` formalisée par la fondatrice

## DoD go-live

- [ ] Checklist `checklist-go-live.md` 100 % cochée
- [ ] Plan de rollback `plan-rollback.md` validé en exercice
- [ ] Runbook `runbook-incident.md` testé
- [ ] Backup PITR + S3 fonctionnel
- [ ] Monitoring + alertes opérationnels
- [ ] Fondatrice formée + autonome
- [ ] 7 jours sans P0/P1 après go-live
