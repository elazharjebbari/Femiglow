# F36 — Toast feedback

## Importance : 🟡 P2

## Objectif
Cohérence des toasts (Sonner library) sur toutes les actions publish : success/error/info.

## Toasts attendus

| Action | Success | Error |
|--------|---------|-------|
| publish-now | "Publication lancée" | "Publication : {mappedError}" |
| schedule | "Publication programmée pour {date}" | idem |
| draft | "Brouillon envoyé au provider" | idem |
| cancel | "Publication annulée" | idem |
| reschedule | "Horaire mis à jour" | idem |
| retry | "Reprise demandée" | idem |
| job cancel | "Job annulé" | idem |
| postiz sync | "{N} comptes synchronisés" | "Sync : {mappedError}" |

## Tests
Voir `test-scenarios.yaml`.
