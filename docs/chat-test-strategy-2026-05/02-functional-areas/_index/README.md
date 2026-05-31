# Functional Areas — Index

Inventaire exhaustif des 60 fonctionnalités à couvrir.

## Convention de nommage

- **F01–F60** — numérotation continue
- Chaque dossier `FNN-slug/` contient :
  - `README.md` — description fonctionnelle détaillée (cible, comportement attendu, edge cases)
  - `acceptance-criteria.md` — DoD validable par tests
  - `test-matrix.csv` — matrice tests (couches × scénarios × tags)
  - `scenarios.gherkin` — scénarios métier en Gherkin
  - `sequence-diagram.puml` — séquence UML (interactions)
  - `vitest-suite.spec.md` — plan tests unitaires + intégration
  - `playwright-suite.spec.md` — plan tests E2E UI
  - `msw-handlers.md` — handlers MSW à fournir
  - `a11y-checklist.md` — checklist accessibilité (si UI)
  - `test-data.json` — fixtures de données
  - `risks.md` — risques connus (de l'audit) + traitement

## Lien matrice

📊 [00-matrix.csv](00-matrix.csv) — Matrice exhaustive (60 lignes × 14 colonnes)

Colonnes : `id, area, category, layer_unit, layer_integration, layer_component, layer_e2e,
layer_msw, priority, risk_audit, owner, test_count_target, coverage_target_pct, blocking_release`

Les chiffres `layer_*` indiquent le nombre cible de tests pour chaque couche.

## Légende priorités

| Priorité | Critère | SLA |
|----------|---------|-----|
| **P0** | Bloquant release ; cœur fonctionnel ou sécurité | Tests obligatoires avant merge |
| **P1** | Important ; couvert avant fin phase 2 | Tests obligatoires avant release |
| **P2** | Confort ; couvert ad-hoc | Tests recommandés |

## Catégorisation

```
Widget UI (visiteur)      F01–F13  (13 features)
API routes                F14–F22  ( 9 features)
Orchestrator pipeline     F23–F36  (14 features)
Admin console             F37–F52  (16 features)
Cross-cutting             F53–F60  ( 8 features)
                          ────────
                              TOTAL 60
```

## Sélection des 10 features détaillées en profondeur (Phase 2 du plan)

Ces 10 features sont les piliers — elles ont **toutes** un sous-dossier complet rédigé.
Les 50 autres ont au minimum un `README.md` + `acceptance-criteria.md` ; les autres fichiers
suivent le template (cf. [TEMPLATE.md](TEMPLATE.md)).

| ID | Feature | Pourquoi pilier |
|----|---------|-----------------|
| F01 | Widget initialization | Point d'entrée visiteur — sans ça, tout est cassé |
| F08 | SSE streaming reception | Cœur du temps réel — couvre R5 (swallow errors) |
| F11 | Lead form bubble | Levier conversion principal — UI critique |
| F15 | POST /api/chat/message | Endpoint orchestrator — couvre C2/C5/C6/R5 |
| F23 | Sanitize PII | Sécurité + RGPD — couvre I7 |
| F27 | Moderation pipeline | Sécurité éditoriale — couvre C2 |
| F31 | Provider router + breaker | Résilience — couvre C3/C6/I5 |
| F33 | Lead decision (10 règles) | Conversion — règles métier complexes |
| F40 | Admin leads management | Opérations — couvre I1 dette outcome |
| F53 | Cross-cutting multilingue | Cohérence FR/AR/AR-MA — critique pour MA market |

## Template à dupliquer

Voir [TEMPLATE.md](TEMPLATE.md) pour la structure type d'un sous-dossier feature.

## Couverture transverse

Certaines préoccupations apparaissent dans **plusieurs** features et sont documentées dans
des fichiers transverses du dossier `_index/` :

| Fichier transverse | Couvre |
|--------------------|--------|
| [01-a11y-baseline.md](01-a11y-baseline.md) | A11y WCAG 2.1 AA appliqué à F01–F13, F37–F52 |
| [02-i18n-baseline.md](02-i18n-baseline.md) | FR/AR/AR-MA appliqué à toutes UI features |
| [03-error-states-baseline.md](03-error-states-baseline.md) | Empty/loading/error states sur toutes UI |
| [04-perf-baseline.md](04-perf-baseline.md) | Budgets perf : LCP, TBT, TTI widget, P95 backend |
| [05-security-baseline.md](05-security-baseline.md) | XSS, CSRF, rate limit, secrets — F15, F22, F45 |
