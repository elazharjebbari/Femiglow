# Dossier QA — Système de coupons FemiGlow · Index général

Date : 2026-06-02 · Périmètre : Phase 1 (coupon d'accueil auto-appliqué) · Standard : ingénierie qualité grande agence (risk-based, shift-left, orienté UI/opérateur).

## Démarrage rapide

1. `00-overview/README.md` — vision, doctrine, invariant maître.
2. `00-overview/feature-inventory.csv` — les 20 fonctionnalités (carte complète).
3. `00-overview/test-strategy.md` — pyramide, MSW, colonnes CSV, gates.
4. `90-action-plan/action-plan.md` — vagues d'implémentation + boucle de correction.
5. `99-runbook/runbook.md` — pilotage de l'exécution.

## Carte du dossier

| Section | Rôle |
|---|---|
| `00-overview/` | Socle transverse : README, inventaire, stratégie, traçabilité, gates qualité, outillage, architecture (puml) |
| `01-data-model/` | CPN-01 — Tables coupons + coupon_events |
| `02-engine-applyCoupon/` | CPN-02 — Math de prix pur |
| `03-engine-resolveCoupon/` | CPN-03 — Sélection (éligibilité/validité/non-cumul) |
| `04-engine-resolveProductPricing/` | CPN-04 — Composition + fallback |
| `05-coupon-context/` | CPN-05 — Contexte (équivalence affichage↔checkout) |
| `06-price-display-public/` | CPN-06 — Prix public /kit + valeur lead |
| `07-cart-snapshot/` | CPN-07 — Snapshot panier (anti-422) |
| `08-order-repricing/` | CPN-08 — Repricing serveur autoritaire ⭐ critique |
| `09-coupon-events-logging/` | CPN-09 — Journalisation incrémentalité |
| `10-admin-crud/` | CPN-10 — CRUD admin |
| `11-admin-status-lifecycle/` | CPN-11 — Cycle de vie statut |
| `12-admin-stats-incrementality/` | CPN-12 — Stats & uplift |
| `13-rbac/` | CPN-13 — Permissions |
| `14-landing-welcome-note/` | CPN-14 — Module « geste d'accueil » |
| `15-invitation-code-disclosure/` | CPN-15 — Porte code d'invitation |
| `16-tracking-value-based/` | CPN-16 — Non-régression valeur ROAS |
| `17-promo-migration-source/` | CPN-17 — Bascule promo → source coupon |
| `18-cache-invalidation/` | CPN-18 — Cache & invalidation |
| `19-holdout-determinism/` | CPN-19 — Déterminisme du bucketing |
| `20-seed-welcome-auto/` | CPN-20 — Seed reproductible |
| `90-action-plan/` | Plan TDD par vagues, phases.yaml, board, boucle de correction |
| `99-runbook/` | Runbook, commandes, CI, playbook de triage |

## Chaque sous-dossier fonctionnalité contient

- `spec.md` — fonctionnement optimal, contrats I/O, points de vérification par axe, edge cases, risques, critères d'acceptation.
- `test-cases.csv` — batterie dense (oracles exacts, priorités, fichier cible).
- `scenarios.md` — scénarios métier Gherkin (visiteur + opérateur).
- `fixtures.json|yaml` — données de test.
- `flow.puml` — diagramme de flux/état (quand pertinent).

## Invariant maître (à ne jamais perdre de vue)

**Prix AFFICHÉ == prix FACTURÉ.** Le repricing serveur rejette tout écart (422). Tout coupon est résolu identiquement et de façon déterministe à l'affichage, au snapshot panier et à la commande. La majorité des tests P0 protègent cet invariant (gate `G-PRICE-PARITY`).

## Décisions ouvertes (voir 90-action-plan §0)

D-1 code HTTP Zod (422 recommandé) · D-2 re-seed préserve pause · D-3 holdout=0 en Phase 1 · D-4 hash bucketing implémentation-définie · D-5 copie arabe à valider · D-6 disclosure code sans champ (Option A).
