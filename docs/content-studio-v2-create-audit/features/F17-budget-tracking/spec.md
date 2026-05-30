# F17 — Suivi du Budget

## Objectif
Surfacer le budget IA quotidien dépensé / restant, et empêcher les générations si épuisé.

## Comportement attendu
- Indicateur visible dans MediaStudio (déjà présent)
- Couleur :
  - Vert si remaining > 50%
  - Orange si 20-50%
  - Rouge si < 20%
- Génération bloquée si remainingCents <= 0 (toast 402)
- Banner global "Budget atteint pour aujourd'hui" si > 90% utilisé

## Comportement actuel
Indicateur présent dans MediaStudio header. Pas de banner global. Pas dans IntentionForm/CaptionEditor.

## Gaps
- F17-LOCAL-1 : indicateur seulement dans MediaStudio
- F17-LOCAL-2 : pas de banner global

## Propositions
### A — Indicateur dans Stepper header
### B — Banner dédié en haut de page
### C — Both

## Recommandation
**A** — indicateur compact dans le header (à côté du MockModeBadge), banner uniquement si critique.

## Implementation
- Lire `/generation-runs?limit=0` au mount + après chaque génération
- Stocker dans StudioContext.budget
- Rendre `BudgetIndicator` dans Stepper

## Tests
Voir `test-scenarios.yaml`.
