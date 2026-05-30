# F38 — A11y publish UI

## Importance : 🟡 P2

## Objectif
Vérifier les exigences WCAG 2.1 AA sur les composants publish.

## Critères
- Tous les boutons ont un libellé accessible (text + aria-label si icon-only)
- Tous les dialogs ont role=dialog + aria-labelledby + focus trap
- Tous les inputs ont label associé
- Combobox (account selector) : role=combobox + aria-expanded
- Status indicators : role=status + aria-live=polite
- Pas de contraste insuffisant (critical/serious axe violations)

## Tests
Voir `test-scenarios.yaml`.
