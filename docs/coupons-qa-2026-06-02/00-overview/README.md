# Dossier QA — Système de coupons FemiGlow

> Référence : `docs/coupon-auto-appliqué.md` (stratégie) + plan d'implémentation `~/.claude/plans/optimized-frolicking-pelican.md`
> Date : 2026-06-02 · Périmètre : Phase 1 (coupon d'accueil auto-appliqué) avec architecture extensible Phases 2/3
> Standard : ingénierie qualité « grande agence » (modèle V + shift-left + risk-based testing)

## 1. Objet du dossier

Ce dossier est la **source de vérité QA** du système de coupons. Il décrit, fonctionnalité par fonctionnalité et **sans exception**, le fonctionnement optimal attendu, les points à vérifier sous tous les angles (backend, frontend, UI/UX, design/charte, data, sécurité/RBAC, perf, accessibilité, i18n, observabilité), puis une **batterie de tests ultra-dense** (Vitest + MSW + Playwright) couvrant tous les scénarios, y compris des **scénarios métier complexes** modélisant une utilisation réelle des interfaces visiteur et admin.

Il sert simultanément de :
- **Spécification exécutable** (chaque fonctionnalité a des critères d'acceptation testables) ;
- **Plan de test** (cas, niveaux de priorité, oracles, traçabilité) ;
- **Plan d'action** de mise en œuvre TDD (`90-action-plan/`) ;
- **Runbook** d'exécution + boucle de correction (`99-runbook/`).

## 2. Principe directeur : la priorité est la ROBUSTESSE, pas le volume

> « On se fout du nombre de tests : ce qui compte c'est la robustesse. »

Chaque test doit avoir un **oracle fort** (assertion non ambiguë), couvrir un **risque identifié**, et être **non-régressif, déterministe, isolé, lisible**. Un test qui ne peut pas échouer pour une bonne raison est supprimé. La densité vient de la **couverture des scénarios et des chemins d'erreur**, pas de la duplication.

## 3. Invariant produit n°1 (le risque maître)

**Le prix AFFICHÉ doit toujours être égal au prix FACTURÉ.** Le repricing serveur (`order-repo.ts`) rejette toute commande dont le total client ≠ total serveur (`PriceMismatchError` → HTTP 422). Tout coupon doit donc être résolu de façon **identique et déterministe** aux trois points : affichage (`/kit`), snapshot panier (wizard), repricing commande (`/api/checkout/order`). La majorité des tests P0 de ce dossier protègent cet invariant.

## 4. Pyramide de tests (orientée UI / opérateur)

Conformément à la demande, le centre de gravité est **haut** (parcours UI réels), tout en gardant un socle unitaire solide pour la logique pure :

```
        ╱╲   E2E Playwright (opérateur visiteur + admin)  ── parcours métier réels, anti-422, RBAC, charte
       ╱──╲  Intégration MSW (composants + handlers API)  ── UI vue de l'opérateur, états réseau, erreurs
      ╱────╲ Contract / API route handlers (Vitest)        ── auth, Zod 422, idempotence, audit
     ╱──────╲ Unitaire pur (Vitest)                         ── applyCoupon, holdout, éligibilité, fallback
```

- **Unitaire (Vitest)** : logique pure et déterministe (moteur, math de prix, bucketing). Pas d'I/O.
- **Intégration (Vitest + MSW)** : composants React rendus en JSDOM avec **MSW** interceptant les appels réseau ; on teste **du point de vue de l'opérateur** (ce qu'il voit, clique, saisit) et tous les états (loading, succès, 4xx/5xx, latence, conflit de version).
- **Contract / route handlers (Vitest)** : on exerce les routes `/api/admin/coupons/**` et `/api/checkout/order` directement (auth, validation, idempotence, audit, codes d'erreur).
- **E2E (Playwright)** : parcours bout-en-bout sur navigateur réel, visiteur **et** admin, avec assertions UI + base/serveur.

## 5. Structure du dossier

| Dossier | Contenu |
|---|---|
| `00-overview/` | Ce README, inventaire exhaustif, stratégie, matrice de traçabilité, gates qualité, outillage, architecture |
| `01-…` → `20-…` | Un sous-dossier **par fonctionnalité** (voir `feature-inventory.csv`) |
| `90-action-plan/` | Plan d'action global TDD, board d'exécution, boucle de correction |
| `99-runbook/` | Runbook de pilotage, commandes, pipeline CI, playbook de triage |

### Gabarit de chaque sous-dossier fonctionnalité

Chaque dossier `NN-<feature>` contient au minimum :

- `spec.md` — fonctionnement optimal, contrats I/O, **points de vérification par axe**, risques, critères d'acceptation.
- `test-cases.csv` — batterie dense (colonnes normalisées, voir `test-strategy.md §6`).
- `scenarios.md` — scénarios métier de bout en bout en **Gherkin** (visiteur + opérateur admin).
- `fixtures.*.json` / `*.yaml` — données de test réutilisables.
- `flow.puml` — diagramme de séquence/état (pour les fonctionnalités à flux).

## 6. Conventions de nommage des cas de test

`CPN-<feat>-<type><nnn>` — ex. `CPN-08-E012` (fonctionnalité 08, test E2E n°12), `CPN-02-U005` (unitaire), `CPN-10-I003` (intégration MSW), `CPN-13-C001` (contract).

Types : `U`=unit, `I`=intégration MSW, `C`=contract/route, `E`=E2E Playwright, `V`=visuel/snapshot, `A`=accessibilité, `P`=perf.

## 7. Comment lire ce dossier

1. Démarrer par `feature-inventory.csv` (la carte complète).
2. `test-strategy.md` (la doctrine + colonnes CSV + gates).
3. `traceability-matrix.csv` (fonctionnalité ↔ risques ↔ types de tests ↔ gate).
4. Plonger dans les sous-dossiers fonctionnalités.
5. Exécuter via `90-action-plan/` piloté par `99-runbook/`.
