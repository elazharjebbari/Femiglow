# S09 — Budget IA dépassé au moment de publier

## Pré-conditions
- Daily budget at 95/100 ¢
- 1 post en cours de génération de visual

## Étapes
1. /create génère visual → budget passe à 100/100
2. Tente publish-now → ne touche pas le budget IA (publish-now ne consomme pas budget)
3. Tente regénérer visual → 402 budget_exceeded → toast mappé

## Critères
- Publish n'est pas impacté par budget IA (séparé)
- Génération visual bloquée → toast mappé

## Note
Cas un peu artificiel — sert à vérifier que budget IA et publish sont bien séparés.

## Spec
Non dédié, couvert par test contract `publish-now-budget-exceeded`.
