# F34 — QuickEditDrawer

## Importance : 🟠 P1

## Objectif
Drawer latéral pour reschedule + cancel + voir détail d'un post depuis Calendar.

## Comportement
- Ouvre via double-click CalendarCard
- Slide-in depuis la droite
- Champs : scheduledAt (datetime-local), platform/format (read-only), caption preview, account
- Boutons : Enregistrer, Annuler la publication, Voir le post (/library/post-id), Fermer
- Esc ferme
- Click outside ferme

## Tests
Voir `test-scenarios.yaml`.
