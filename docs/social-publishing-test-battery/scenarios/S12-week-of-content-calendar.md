# S12 — Semaine complète de contenu

## Pré-conditions
- 7 posts programmés sur la semaine (1/jour)

## Étapes
1. Visit /plan → Calendar week view
2. Vérifie : 7 cards visibles aux bonnes dates
3. Filter status=scheduled → 7 cards
4. Filter platform=instagram → cards filtrées
5. Click "next week" → calendar avance
6. "Today" ramène à aujourd'hui
7. Double-click card → QuickEditDrawer
8. Drag-drop card vers autre jour → reschedule via PATCH
9. List view → 7 entries sortées chronologiquement

## Critères
- Filtres fonctionnels
- Navigation fluide
- Drag-drop déclenche PATCH /reschedule

## Spec
`e2e/social-publishing/calendar-week-view.spec.ts`
