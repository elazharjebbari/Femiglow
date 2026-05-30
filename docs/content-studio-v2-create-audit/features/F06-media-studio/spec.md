# F06 — Media Studio (Visuel)

## Objectif
Permettre à l'opérateur d'attacher un visuel au draft : soit en uploadant un fichier, soit en piochant dans la bibliothèque, soit en générant via IA (image ou vidéo).

## Comportement attendu
- Toggle compartiment : All / Imported / AI Generated
- Bouton "Générer un visuel IA" (primary)
- **NEW** : Toggle Image / Vidéo (selon le format choisi)
- **NEW** : ModelPicker (image ou video selon toggle)
- MediaPicker : grille des médias disponibles, avec sélection
- Bouton "Décrocher" si un média est lié

## Comportement actuel
Fichier : `MediaStudio.tsx`. Couvre l'image. Pas de vidéo, pas de modèle.

## Gaps
- G02 : pas de vidéo (adressé via F08 + F09)
- G03 : pas de modèle (adressé via F07/F08)
- F06-LOCAL-1 : pas de feedback du type de média à générer si format=reel mais user clique "Générer image"

## Propositions

### A — Statu quo + ajout linéaire
Ajouter toggle + ModelPicker dans le header de MediaStudio sans refactor.

### B — Refactor en 2 modes : "Bibliothèque" / "Générer IA"
Tabs en haut : Bibliothèque (MediaPicker) vs Générer IA (form prompt + model + kind).

### C — Séparer en 2 composants distincts
`MediaLibrary` et `MediaGenerator`. Plus modulaire.

## Recommandation
**B** — Tabs lisibles, le générateur a sa propre zone aérée.

## Implementation
- Refactor MediaStudio :
  - Header : titre "Visuel" + budget + autosave
  - Tabs : "Bibliothèque" | "Générer IA"
  - Tab Générer :
    - Toggle Image/Vidéo (default selon format)
    - ModelPicker (role selon toggle)
    - Prompt textarea
    - Size + quality (image only)
    - Bouton "Générer"
  - Tab Bibliothèque : MediaPicker existant

Voir F07 (image), F08 (video), F09 (mock video).

## Tests
Voir `test-scenarios.yaml`.
