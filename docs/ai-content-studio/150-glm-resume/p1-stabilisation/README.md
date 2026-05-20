# P1 — Stabilisation du Content Studio

**Modèle** : GLM-5.1 (Cloud)
**Date** : 2026-05-17
**Serveur** : staging.femiglow-maroc.com (`/var/www/femiglow-staging`)
**Branche** : master

---

## Objectif

Stabiliser le prototype Content Studio en corrigeant les bugs, en refactorant le composant monolithique de 1567 lignes, en ajoutant les tests manquants, et en mettant à jour la documentation. À l'issue de P1, le Content Studio doit être fiable, testable, et prêt pour les évolutions produit de P2.

## Bugs identifiés

| # | Bug | Fichier | Ligne | Sévérité |
|---|-----|---------|-------|----------|
| B1 | `insertReview` set toujours `needs_review` même si le review passe | `repository.ts` | 457 | Haute |
| B2 | State machine jamais enforce — les transitions ne sont pas validées | `service.ts` | partout | Haute |
| C1 | Dead code : bloc `if` vide | `ContentStudioClient.tsx` | 436-438 | Basse |
| C2 | `target="_blank"` sans `rel="noopener"` | `ContentStudioClient.tsx` | 1202 | Moyenne |
| C3 | Types `Integration` et `StudioMediaItem` dupliqués côté client | `ContentStudioClient.tsx` | 32-55 | Moyenne |

## Documents

- [`conception/architecture-refactor.md`](conception/architecture-refactor.md) — Architecture cible du refactoring
- [`conception/data-model-bugs.md`](conception/data-model-bugs.md) — Bugs B1 et B2 en détail
- [`plan-dev/etapes.md`](plan-dev/etapes.md) — Étapes de développement avec ordre et dépendances
- [`plan-action/checklist.md`](plan-action/checklist.md) — Checklist détaillée avec fichiers impactés
- [`tests/strategie-tests.md`](tests/strategie-tests.md) — Stratégie de tests Vitest + Playwright + MSW
- [`runbook/execution.md`](runbook/execution.md) — Runbook pas-à-pas pour exécuter P1