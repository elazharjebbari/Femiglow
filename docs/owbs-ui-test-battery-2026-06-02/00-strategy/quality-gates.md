# 00 — Portes qualité (Definition of Done de la batterie)

## Par scénario
- [ ] **Oracle perceptible** défini (libellé/état/timing observable).
- [ ] Sélection par rôle/nom/`data-testid` (zéro couplage implémentation).
- [ ] Déterministe (réseau & horloge contrôlés) ; aucune attente temps réel.
- [ ] Échoue **avant** le fix (rouge utile) si c'est un garde-fou de bug.

## Par module (sous-dossier Fxx)
- [ ] Tous les scénarios **P0 et P1** de `scenarios.csv` implémentés et verts.
- [ ] **Parité legacy** prouvée (flag OFF == existant) sur l'écran concerné.
- [ ] **a11y** : `axe` 0 violation sur l'écran (si UI utilisateur).
- [ ] **i18n/RTL** : au moins FR + AR couverts (si écran localisé).
- [ ] **≥ 2 scénarios métier** complets passent en Playwright.
- [ ] Aucune **régression** sur la suite existante du périmètre.
- [ ] `tsc` 0, `eslint` 0 erreur, gitleaks ok.

## Globales (batterie complète)
- [ ] **100 % des fonctionnalités** de l'inventaire ont au moins un scénario P0 couvert.
- [ ] Tous les **risques** `severity=high` du registre ont ≥ 1 test dédié vert.
- [ ] **Zéro-perte** prouvé e2e (beacon) sur chromium **et** webkit.
- [ ] **Double-conversion impossible** prouvé (double-tap + rejeu).
- [ ] **Indicateur dégradé** non bloquant prouvé (navigation reste possible).
- [ ] **Admin** : un lead optimiste capturé en fond est **visible** par l'opérateur ; un effet `dead` est **détectable** (UI ou procédure documentée).
- [ ] La **boucle de correction** a convergé : 0 bug ouvert `P0/P1`.

## Barres de couverture (cœur OWBS, indicatif)
| Domaine | Cible lignes | Cible scénarios P0 |
|---|---|---|
| Composants wizard (steps) | ≥ 85 % | 100 % |
| `lead-sync-queue` / transport / beacon | ≥ 95 % | 100 % |
| Routes (`/lead`, `/sync`, `/order`, cron) | ≥ 85 % | 100 % |
| Admin leads (vues/actions) | ≥ 75 % | 100 % |

> On ne « score » pas sur le **nombre** de tests : on score sur **robustesse**
> (chaque risque high couvert) et **réalisme** (parcours métier complets verts).

## Sévérité des défauts (triage)
| Sévérité | Définition | SLA correction |
|---|---|---|
| **S1 Bloquant** | perte de lead / double commande / checkout cassé / a11y inutilisable | immédiat, gate de release |
| **S2 Majeur** | UX dégradée perceptible (gel, faux message, indicateur cassé) | avant fin de vague |
| **S3 Mineur** | cosmétique, libellé, edge rare non-perte | backlog tracé |
