# F05 — Dialog de confirmation enrichi (G12)

## Importance : 🟠 P1

## Objectif
Avant chaque action publish (now/schedule/draft), un dialog affiche un recap visuel : thumbnail + caption tronquée + platform + format + indicateur mock.

## Comportement attendu

### Structure du dialog
- Title : "Publier maintenant ?" / "Programmer la publication" / "Envoyer en brouillon ?"
- Body :
  - **ConfirmPreview** (component dédié) :
    - Thumbnail 64×80 du média ou placeholder dashed si pas de media
    - Caption tronquée à 140 chars + "…"
    - Tag "📱 {platform}"
    - Tag "· {format}"
    - Tag "· Mode mock" si mockMode
  - Texte explicatif (variant par mode)
- Footer : Annuler / Confirmer

### Props
- `preview: PublishConfirmPreview | null` — `{ thumbnailUrl, caption, platform, format }`
- `mockMode: boolean`
- Si `preview=null`, le bloc est entièrement omis

## Tests
Voir `test-scenarios.yaml`. Couvre rendu thumbnail/placeholder, troncation caption, tags, mock mode.
