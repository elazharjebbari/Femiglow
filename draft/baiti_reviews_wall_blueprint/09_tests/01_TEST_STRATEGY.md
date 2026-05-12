# Test Strategy - Reviews Wall

## Objectif
Valider que le mur d'avis:
- respecte UI/UX (layout, scannabilité, navigation)
- fonctionne (filtres, pagination, submit)
- track correctement (dataLayer)
- est accessible (focus trap, keyboard)
- est performant (no huge DOM)

## Niveaux de tests

### Unit (backend)
- calcul summary/distribution
- pagination cursors
- validation submit

### Integration (backend)
- endpoints summary/list/submit
- moderation status

### UI (frontend)
- rendering states
- filter chips
- load more

### E2E (Playwright)
- open spot dans room
- lire summary
- filtrer "avec photos"
- charger plus
- ouvrir produit depuis avis
- soumettre avis (mock)
- vérifier dataLayer

### Visual regression
- drawer desktop
- bottom sheet mobile

### Accessibility
- axe checks
- keyboard nav
