# F10 — Caption Editor

## Objectif
Édition de la caption + hook + cta + hashtags + altText du draft sélectionné, avec autosave debounce (1500ms), indicateur de statut et compteur de caractères.

## Comportement attendu
- Champs : Hook, Caption, CTA, Hashtags (chips), Alt text
- Compteur de caractères par plateforme (IG caption max 2200, FB max 63206)
- `AutosaveIndicator` : idle | saving | saved | error | session_expired
- Conflict detection : si serveur retourne 409, afficher banner + bouton "Recharger"

## Comportement actuel
Fichier : `CaptionEditor.tsx` (existant). Fonctionnel.

## Gaps
- F10-LOCAL-1 : pas de versioning (G09) → modification = destruction silencieuse
- F10-LOCAL-2 : pas d'undo après autosave
- F10-LOCAL-3 : hashtags : pas de suggestion basée sur le contenu

## Propositions

### A — Statu quo
Garder le comportement actuel. Aucune action.

### B — Ajout undo/redo local
Stack d'états locaux, raccourcis clavier Cmd+Z / Cmd+Shift+Z.

### C — Versioning DB + timeline UI
Voir G09. Nécessite nouvelle table `content_draft_versions`.

## Recommandation
**A** pour cette phase. Inscrire B + C au backlog (cf F12).

## Implementation
Pas de modification dans cette phase. Fichier déjà OK.

## Tests
Voir `test-scenarios.yaml`.
