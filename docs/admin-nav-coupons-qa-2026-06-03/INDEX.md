# Dossier QA UI — Navigation admin & onglet « Coupons »

> **Date** : 2026-06-03 · **Périmètre** : la **couche de navigation / onglets** de l'admin FemiGlow,
> déclenchée par l'ajout de l'**onglet « Coupons »** (`AdminShell`), + le sous-système de **config nav
> dynamique** (`admin-config` : defaults → DB → résolution, éditeur `NavEditor`, contrat `PATCH
> /api/admin/settings/nav`). Orientation **UI / point de vue opérateur**.
>
> **Conventions** : ce dossier réutilise telles quelles les conventions du dossier
> [`coupon-loyalty-qa-ui-2026-06-03`](../coupon-loyalty-qa-ui-2026-06-03/00-overview/) :
> gabarit `TEMPLATE.md`, types de tests (U/I/C/M/E/A/V), schéma `test-cases.csv`, doctrine
> « comportement observable d'abord », cycle MSW par fichier, exécution depuis `apps/web/`.

## Pourquoi ce dossier (lacune)

Avant l'ajout de l'onglet, `AdminShell` (le composant qui **rend les onglets**) n'avait que **3 tests
basiques** ; l'**onglet Coupons était absent** du tableau `NAV` codé en dur (et la page `/admin/coupons`
passait `active="settings"` à tort). Le sous-système de config nav dynamique (`resolve.ts`, `NavEditor`,
contrat `PATCH [section]`) est **peu/non testé** côté UI. C'est un angle mort de l'expérience opérateur :
un onglet manquant, mal surligné, ou une sauvegarde de nav qui échoue silencieusement = navigation cassée.

## Ce qui a été corrigé (implémentation préalable)

1. `AdminShell` : ajout de l'entrée `{ href:'/admin/coupons', key:'coupons', label:'Coupons' }` (position 9,
   avant Audit), ajout de `'coupons'` à l'union `active`, et **`data-testid="admin-nav-<key>"`** sur chaque
   lien (testabilité UI, inexistante avant).
2. `/admin/coupons/page.tsx` : `active="coupons"` (au lieu de `"settings"`).

## Carte des fonctionnalités

| # | Fonctionnalité | Surface | Couche | Risque |
|---|---|---|---|---|
| N01 | AdminShell — inventaire & ordre des onglets (Coupons inclus) | admin | Composant | P0 |
| N02 | AdminShell — onglet actif (aria-current + style) par route | admin | Composant | P0 |
| N03 | Intégration onglet Coupons (page RSC `active=coupons` → CouponsManager) | admin | Composant/Intégration | P0 |
| N04 | AdminShell — a11y + responsive + déconnexion | admin | Composant + A11y | P1 |
| N05 | admin-config `defaults` ↔ `navSchema` (Coupons présent, clés uniques, positions) | config | Unit | P1 |
| N06 | `resolve.ts` — cascade DB → defaults → failsafe + badge `isDefault` | config | Intégration | P1 |
| N07 | `NavEditor` — édition locale (add/move/remove/update, normalizePositions, dirty, validation client) | admin | Composant | P0 |
| N08 | `NavEditor` — sauvegarde réseau (MSW : 200 / 409 conflit / 422 / réseau, `If-Match`) | admin | Composant + MSW | P0 |
| N09 | Contrat `PATCH /api/admin/settings/nav` (auth/404/If-Match/422/409/audit) | admin | Intégration | P0 |
| N10 | E2E — parcours opérateur onglet Coupons (login → clic → page → bascule actif) | admin | Playwright | P0 |
| N11 | E2E — NavEditor visibilité/édition (best-effort) | admin | Playwright | P2 |

## Navigation

- `00-overview/` — README (doctrine + invariants + audit), `feature-inventory.csv`, `test-strategy.md`, `quality-gates.yaml`, `traceability-matrix.csv`, `architecture.puml`
- `N01-…` à `N11-…` — un sous-dossier par fonctionnalité (spec/test-cases/scenarios/fixtures [+ flow.puml])
- `90-action-plan/` — vagues + boucle de correction
- `99-runbook/` — exécution + commandes + triage
