# S04 — Step Progression

> Valide que le Stepper avance et recule cohéremment avec les actions utilisateur.

## Étapes & attentes

| # | Action | Stepper attendu | draft.status |
|---|--------|-----------------|--------------|
| 1 | Visit page | Cadrer actif | (pas de draft) |
| 2 | Submit IntentionForm | Générer actif | generated |
| 3 | Select variant | Visuel actif | needs_review |
| 4 | Edit caption (autosave) | Visuel reste actif | needs_review |
| 5 | Generate visual | Visuel reste actif | needs_review |
| 6 | Click Valider | Valider actif | approved |
| 7 | Publier maintenant (publish-now) | Valider reste actif | published |
| 8 | Refresh page | Valider actif | published (persiste) |

## Vérifications

- À chaque étape, `aria-current="step"` est sur la bonne étape
- Steps passées ont l'icône Check
- Steps futures ont `aria-disabled="true"` et tooltip
- Cliquer sur step passée scrolle vers la section correspondante
- Rétrograder via navigation past step ne change pas draft.status

## Cas limite : Rétro après publish
- Une fois published, cliquer sur "Cadrer" → scrolle mais le formulaire est en mode lecture (ou désactivé) car la création est figée

## Spec Playwright
`e2e/content-studio-v2/create-step-progression.spec.ts`
