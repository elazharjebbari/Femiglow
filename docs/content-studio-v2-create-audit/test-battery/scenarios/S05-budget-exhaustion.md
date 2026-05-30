# S05 — Budget exhaustion

> Valide la gestion du budget IA quotidien atteint.

## Setup

Mock `/api/admin/content-studio/generation-runs` pour retourner :
```json
{
  "runs": [...],
  "budget": { "dailyBudgetCents": 100, "dailySpentCents": 100, "remainingCents": 0 }
}
```

Mock `/api/admin/content-studio/ideas/:id/generate` pour retourner 402.

## Étapes

1. Visit create page
2. **Attendu** : BudgetIndicator rouge, banner "Budget atteint pour aujourd'hui"
3. Submit IntentionForm
4. **Attendu** :
   - POST /ideas réussit (idea créée, pas de coût)
   - POST /ideas/:id/generate échoue avec 402
   - Toast erreur "Budget IA quotidien atteint"
   - Stepper reste à "Cadrer" ou "Générer" (variantes non créées)
5. Bouton "Générer un visuel IA" disabled
6. **Vérifier** : aucune autre action de génération possible

## Cas limite : Budget recharge
- Modifier le mock pour `remainingCents: 50`
- Refresh
- **Attendu** : Banner disparaît, indicator passe orange ou vert

## Spec Playwright
`e2e/content-studio-v2/create-budget-exhaustion.spec.ts`
