# Execution — plan d'action, tests, runbook

Ce sous-dossier contient les **documents opérationnels** du composant « Rituels partagés ». Là où les documents `01` à `18` du dossier parent définissent **ce qu'il faut faire et pourquoi**, ce sous-dossier décrit **comment le faire, dans quel ordre, avec quels tests, et avec quels garde-fous**.

## Comment lire ce sous-dossier

1. **Toujours commencer par le runbook** (`00-runbook.md`). C'est le chef d'orchestre : il indexe pour chaque phase les documents de référence et les checks à valider.
2. **Lire l'architecture détaillée** (`01-architecture-detaillee.md`) pour la vue système, les flux, les couches.
3. **Choisir son angle d'attaque** :
   - Côté **conception UI/UX** : `02-ui-ux-conception.md` + `03-wizard-ui-specification.md`.
   - Côté **backend** : `04-backend-plan-action.md` + `08-tests-jest.md` (segment backend).
   - Côté **frontend client** : `05-frontend-plan-action.md` + `08-tests-jest.md` (segment composants) + `09-tests-msw.md`.
   - Côté **admin** : `06-admin-plan-action.md`.
   - Côté **QA** : `07-strategie-tests.md` + `08` + `09` + `10`.

## Plan du sous-dossier

| # | Fichier | Sujet | Lectorat principal |
| --- | --- | --- | --- |
| — | `README.md` | Index | Tous |
| 00 | [`00-runbook.md`](00-runbook.md) | Runbook maître — pilote toute l'exécution, indexe les références par étape | Tech lead, dev référent |
| 01 | [`01-architecture-detaillee.md`](01-architecture-detaillee.md) | Architecture système, couches, flux de données, contrats | Tous tech |
| 02 | [`02-ui-ux-conception.md`](02-ui-ux-conception.md) | Design system spécifique au wall, style, micro-interactions, états visuels | Design, front |
| 03 | [`03-wizard-ui-specification.md`](03-wizard-ui-specification.md) | **Spécification UI détaillée du wizard de soumission** (frame par frame) | Design, front |
| 04 | [`04-backend-plan-action.md`](04-backend-plan-action.md) | Plan d'action backend (BDD, API, jobs, vision ML, e-mail) | Backend |
| 05 | [`05-frontend-plan-action.md`](05-frontend-plan-action.md) | Plan d'action frontend (module compact, drawer, wizard, lightbox) | Frontend |
| 06 | [`06-admin-plan-action.md`](06-admin-plan-action.md) | Plan d'action admin (queue, détail, actions, insights, politique) | Frontend / admin |
| 07 | [`07-strategie-tests.md`](07-strategie-tests.md) | Stratégie globale de tests (pyramide, ratios, ce que chaque niveau couvre) | QA, tech lead |
| 08 | [`08-tests-jest.md`](08-tests-jest.md) | Catalogue Vitest/Jest unitaire — un test par composant ou util, scénarios atomiques | Front + back |
| 09 | [`09-tests-msw.md`](09-tests-msw.md) | Handlers MSW + scénarios d'intégration des composants avec API simulée | Front |
| 10 | [`10-tests-playwright.md`](10-tests-playwright.md) | Scénarios E2E Playwright (parcours utilisateur + admin) | QA |
| 11 | [`11-debug-observabilite.md`](11-debug-observabilite.md) | Logs structurés, traces Sentry, alertes, dashboards | Tech lead, SRE |
| 12 | [`12-evolutivite.md`](12-evolutivite.md) | Points d'extension, dette technique anticipée, paths d'évolution Phase 2 | Tech lead |
| 13 | [`13-import-system-architecture.md`](13-import-system-architecture.md) | **Système d'import** : architecture, tables, flux, endpoints API | Backend, tech lead |
| 14 | [`14-import-wizard-ui-specification.md`](14-import-wizard-ui-specification.md) | **Spec UI du wizard d'import admin** (6 étapes, frame par frame) | Design, front |
| 15 | [`15-import-templates-formats.md`](15-import-templates-formats.md) | Formats supportés (CSV/JSON/JSONL/TSV/ZIP), templates téléchargeables, validation | Backend, support utilisateur |
| 16 | [`16-bulk-management.md`](16-bulk-management.md) | **Gestion bulk** : sélection multiple, actions de masse, RBAC, UX | Front, backend, design |
| 17 | [`17-tests-import-bulk.md`](17-tests-import-bulk.md) | Catalogue de tests dédié import + bulk (Jest, MSW, Playwright) | QA |

## Conventions

- **Toutes les commandes** assument `pnpm` à la racine ou `pnpm --filter @femiglow/web` selon contexte.
- **Tests Jest** s'entendent comme **Vitest** dans le projet (API compatible, runner différent).
- **Les chemins de fichiers** dans ce dossier sont préfixés par `apps/web/src/` quand absolus, par `./` quand relatifs à un composant.
- **Les références aux documents de décision** (01-18 du dossier parent) sont précédées de `↗` : `↗ 09-interface-publique.md § 3.6`.
- **Les références aux fichiers de code** suivent le format `file:line` quand pertinent : `apps/web/src/lib/db/schema.ts:1409`.

## Boucle d'exécution attendue

Chaque dev qui prend une tâche suit cette boucle :

```
1. Ouvrir 00-runbook.md à la phase concernée
2. Lire les références indexées pour cette phase
3. Implémenter en suivant le plan d'action de domaine (04/05/06)
4. Écrire les tests Jest atomiques (08)
5. Écrire les tests MSW si composant front (09)
6. Vérifier la couverture E2E concernée (10)
7. Vérifier les checks d'observabilité (11)
8. Cocher la case DoD de la phase dans le runbook
9. Merger
```

Pas de raccourci. Pas de « je teste plus tard ». Les tests s'écrivent **en même temps** que l'implémentation, pas après.
