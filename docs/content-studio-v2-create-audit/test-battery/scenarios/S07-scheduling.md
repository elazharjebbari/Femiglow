# S07 — Scheduling

> Valide la programmation et la replanification d'une publication.

## Étapes

### Schedule initial
1. Compléter parcours jusqu'à postId disponible
2. Click "Publier" → "Programmer"
3. Dialog avec datepicker
4. Sélectionner +24h
5. Confirmer
6. **Attendu** :
   - POST /posts/:id/schedule { scheduledAt } → 200
   - Toast "Publication programmée pour {date}"
   - Stepper Valider reste actif
   - post.status='scheduled'

### Reschedule
1. Dans une UI dédiée (ou re-cliquer Publier)
2. Sélectionner nouvelle date
3. **Attendu** : POST /posts/:id/reschedule

### Validation passé
- Saisir une date passée
- **Attendu** : input HTML5 min refuse OU server retourne 400 avec message

### Validation min lead time
- Saisir une date < now + 5 min
- **Attendu** : server retourne 400 code='min_lead_time'

### Annulation
- Click "Annuler la planification" (à ajouter dans une UI dédiée — backlog si pas dans cette phase)
- POST /posts/:id/cancel
- **Attendu** : post.status='cancelled'

## Spec Playwright
`e2e/content-studio-v2/create-scheduling.spec.ts`
