# F60 — Cross — cron jobs (KB sync + intent recompute + digest)

> Voir [TEMPLATE.md](../_index/TEMPLATE.md) pour la structure complète. Cette feature suit
> le template ; le détail des tests est dans [test-matrix.csv](test-matrix.csv).

## Cible
Voir matrice fonctionnelle (`docs/chat-test-strategy-2026-05/02-functional-areas/_index/00-matrix.csv`)
pour le détail des couches et le compteur de tests cible.

## Comportement attendu
- Cf. audit (`docs/chat-audit-2026-05/`) + cartographie code.
- Cas nominal + edge cases (empty / loading / error / offline / large data).

## Stratégie test (couches activées)
- Voir la ligne **F60** dans [00-matrix.csv](../_index/00-matrix.csv) : compteurs par couche, coverage target, tags.

## Risques audit liés
- Cf. la colonne **risk_audit** dans la matrice (référence aux findings).

## Liens
- 📊 [test-matrix.csv](test-matrix.csv) — détail tests par cas (à compléter)
- 🧪 vitest-suite.spec.md — plan tests vitest (à rédiger Phase 2)
- 🎭 playwright-suite.spec.md — plan tests Playwright (à rédiger Phase 2)

## Métadonnées
- **Owner** : Backend
- **Priorité** : P0
- **Catégorie** : Cross
- **Status doc** : SKELETON (à compléter dans Phase 2 du plan)
