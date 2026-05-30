# Rollback

## Stratégie
La batterie de tests est additive — elle n'introduit pas de changements de code applicatif (sauf MSW handlers + fixtures, qui sont dans `src/test/`). Donc pas de rollback applicatif à prévoir.

## Rollback per fichier

| Composant | Fichiers ajoutés | Rollback |
|-----------|-----------------|----------|
| MSW catalog | `src/test/msw/social-publishing-handlers.ts` | Supprimer le fichier |
| Fixtures | `src/test/fixtures/social-publishing/**` | Supprimer le dossier |
| Component tests | `*.test.tsx` ajoutés | Supprimer fichiers tests |
| Contract tests | `social-publishing-*.contract.test.ts` | Supprimer fichiers tests |
| E2E specs | `e2e/social-publishing/**` | Supprimer le dossier |
| Helpers Playwright | `e2e/social-publishing/helpers.ts` | Supprimer |

## Si bugs introduits

Si la PR introduit involontairement un bug dans le code applicatif via refactor de tests :
1. `git revert <pr-merge-commit>`
2. Re-créer une PR plus ciblée

## Live test
- Si un live test est commit puis cause un incident → désactiver via env :
  ```bash
  unset E2E_LIVE_POSTIZ
  ```
- Le spec sera skipped par défaut. Pas de désinstallation nécessaire.

## Cleanup post-rollback
- Vérifier qu'aucun post test n'est dangling sur Postiz : `scripts/social-publishing-live-cleanup.sh`
- Pas d'impact DB autre que les fixtures de test (isolées de prod)
