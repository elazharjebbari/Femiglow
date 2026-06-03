# Dossier QA UI — Système Coupon & Fidélité FemiGlow

> **Date** : 2026-06-03 · **Périmètre** : batterie de tests **orientée UI / point de vue opérateur**
> couvrant l'intégralité du système coupon (Phase 1 welcome, Phase 2 rescue) + crédit fidélité
> (Phase 3 grants), sur les surfaces **client** (`/kit`, wizard) et **admin** (`/admin/coupons`).
>
> **Doctrine** : on teste le comportement **observable** — ce que voit et fait un humain (client ou
> opérateur) face à l'interface — pas seulement les fonctions pures. La pyramide reste saine
> (unit > intégration > e2e) mais le **centre de gravité remonte vers l'UI** : composants React
> (Testing Library), contrats d'API mockés en **MSW**, parcours bout-en-bout en **Playwright**.

## Pourquoi ce dossier (lacunes identifiées)

L'audit de couverture (cf. `00-overview/README.md` §3) révèle que le **moteur** et les **repos** sont
bien couverts (~121 tests), mais que **toute la couche UI/opérateur est un angle mort** :

| Zone | État avant | Risque |
|---|---|---|
| `CouponsManager.tsx` (admin) | **0 test** | 🔴 Critique — l'écran que l'opérateur utilise au quotidien n'est pas testé |
| Routes admin `[id]/status`, `[id]/stats` | **0 contrat** | 🔴 RBAC publish, lock archivé, agrégation non vérifiés |
| Handlers **MSW** coupon/fidélité | **inexistants** | 🔴 Aucune couche réseau mockée → tests UI impossibles à isoler |
| E2E redemption client | **0** | 🔴 Le geste métier central (utiliser son code) n'a aucun filet |
| Parcours fidélité complet (wizard→ThankYou) | **0** | 🔴 Émission + affichage du code non couverts bout-en-bout |
| AddressStep disclosure, ThankYou wiring, filtres grants, rescue opérateur | partiel/0 | 🟠 |

## Navigation

- **`00-overview/`** — fondations transverses (lire en premier)
  - `README.md` — vision, doctrine, invariants maîtres, audit de couverture
  - `architecture.puml` — cartographie surfaces ↔ endpoints ↔ état
  - `feature-inventory.csv` — matrice des 20 fonctionnalités (id, risque, couche, statut)
  - `test-strategy.md` — pyramide, rôle de MSW, schéma de `test-cases.csv`, types de tests
  - `tooling.md` — stack exacte (Vitest/MSW/Playwright), chemins, patterns, pièges
  - `quality-gates.yaml` — seuils de couverture + conditions de passage de vague
  - `traceability-matrix.csv` — test ↔ risque ↔ exigence métier
  - `TEMPLATE.md` — gabarit imposé pour chaque sous-dossier feature
- **`01-…` à `20-…`** — un sous-dossier par fonctionnalité (spec.md, test-cases.csv, scenarios.md, fixtures.json, flow.puml)
- **`90-action-plan/`** — plan d'action global par vagues + boucle de correction + journal de décision
- **`99-runbook/`** — runbook d'exécution + commandes exactes + playbook de triage

## Carte des fonctionnalités

| # | Feature | Couche dominante | Risque |
|---|---|---|---|
| 01 | Admin — Création de coupon (formulaire) | Composant + MSW | P0 |
| 02 | Admin — Liste & transitions de statut | Composant + MSW | P0 |
| 03 | Admin — Stats incrementality (uplift) | Composant + MSW | P1 |
| 04 | Admin — Section « Codes de fidélité émis » | Composant + MSW | P0 |
| 05 | Contrat API — `POST [id]/status` (RBAC publish, lock archivé) | Intégration | P0 |
| 06 | Contrat API — `GET [id]/stats` (agrégation) | Intégration | P1 |
| 07 | Contrat API — `GET grants` (filtres, masquage PII) | Intégration | P0 |
| 08 | Client — `InvitationCodeField` (saisie + validation) | Composant + MSW | P0 |
| 09 | Client — AddressStep coupon disclosure | Composant + MSW | P1 |
| 10 | Client — `WizardCartRecap` (économie, crédit, total floor) | Composant | P0 |
| 11 | Client — ThankYouStep + `LoyaltyCodeCard` | Composant | P0 |
| 12 | Client — `CouponWelcomeNote` (landing Phase 1) | Composant | P2 |
| 13 | État — wizard-store coupon/loyalty (persistance) | Unit | P1 |
| 14 | Contrat API — `POST /api/coupons/redeem` (états) | Intégration + MSW | P0 |
| 15 | Contrat API — `POST /api/coupons/rescue` (bucket, events) | Intégration | P1 |
| 16 | E2E — Parcours opérateur (créer→activer→effet /kit→grants) | Playwright | P0 |
| 17 | E2E — Parcours client fidélité (wizard→ThankYou→carte) | Playwright | P0 |
| 18 | E2E — Redemption client (saisir code→crédit→commande) | Playwright | P0 |
| 19 | Intégration — Pricing/éligibilité/holdout (invariant anti-422) | Intégration | P0 |
| 20 | Règles métier — délai d'activation + unicité téléphone | Intégration | P1 |

## Exécution

Voir `90-action-plan/action-plan.md` (vagues W0→W6) et `99-runbook/runbook.md`.
Toute commande Vitest/Playwright s'exécute depuis `apps/web/`.
