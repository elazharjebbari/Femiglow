# F07 — Reschedule via Calendar / QuickEditDrawer

## Importance : 🟠 P1

## Objectif
Modifier la date d'une publication programmée depuis l'écran Plan, sans repasser par le flow Create. Soit via drag-drop sur Calendar, soit via QuickEditDrawer.

## Comportement attendu

### Drag-drop (Calendar)
1. Opérateur drag une CalendarCard
2. Drop sur une autre cellule jour
3. Confirmation toast "Horaire mis à jour"
4. PATCH `/posts/:id/reschedule` envoyé avec `{ scheduledAt }`
5. La card apparaît au nouveau jour

### QuickEditDrawer (double-click)
1. Double-click sur une CalendarCard
2. Drawer s'ouvre à droite
3. Input datetime-local pré-rempli avec scheduledAt actuel
4. User pick une nouvelle date
5. Click "Enregistrer" → PATCH `/posts/:id/reschedule`
6. Toast succès
7. Drawer ferme automatiquement

### API
- PATCH `/api/admin/content-studio/posts/:id/reschedule`
- Body : `{ scheduledAt: ISO }`
- Validations : > now + minLeadTime ; post status='scheduled' ou 'approved'

### Side effects
- UPDATE `content_post.scheduledAt`
- UPDATE `social_publish_job.scheduledAt` (si still queued)

## Cas d'erreur
- Date passée → 400 invalid_date → toast
- Post non scheduled (ex: déjà publié) → 409 invalid_state
- Network error → toast + drawer ne ferme pas

## Tests
Voir `test-scenarios.yaml`.
