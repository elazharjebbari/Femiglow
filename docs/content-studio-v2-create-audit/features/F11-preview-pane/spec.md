# F11 — Preview Pane

## Objectif
Afficher un aperçu fidèle du post tel qu'il apparaîtra sur la plateforme cible (IG/FB) avec le format choisi (post/story/reel/carousel).

## Comportement attendu
- Header avec tabs plateforme (IG/FB) si plusieurs supportées
- Sub-tabs format (1:1, 4:5, 9:16) selon le format draft
- Zone media : <img> si kind=image, <video controls> si kind=video
- Caption sous le media
- Hashtags en pills
- Empty state quand pas de média ou pas de caption
- **NEW** : bouton "Valider et préparer la publication" sous l'aperçu (cf F13)

## Comportement actuel
Fonctionnel sauf : pas de bouton Valider, pas d'empty state guidé.

## Gaps
- F11-LOCAL-1 : empty state minimaliste (G11)
- F13 (cross-ref) : pas de bouton Valider

## Propositions
### A — Empty state guidé + bouton Valider intégré
Composer un état initial avec illustration + tips "Décrivez votre intention". Bouton Valider en bas après média.

### B — Empty state minimaliste
Garder seulement un placeholder gris. Bouton Valider en footer dédié.

### C — Pas d'empty state, bouton Valider toujours visible (disabled si pas prêt)
Plus simple mais moins informatif.

## Recommandation
**A** — bouton intégré au PreviewPane (logique : valider l'aperçu).

## Implementation
Voir F13 pour le bouton Valider. Empty state :
- Si pas de draft sélectionné : "Décrivez votre intention pour démarrer"
- Si draft mais pas de media : "Attachez un visuel pour activer la validation"
- Si caption vide : "Ajoutez une caption avant de valider"

## Tests
Voir `test-scenarios.yaml`.
