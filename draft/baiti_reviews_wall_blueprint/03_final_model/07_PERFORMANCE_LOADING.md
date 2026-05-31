# Performance & Loading

## Objectifs
- First open < 200ms (hors réseau)
- API reviews initial < 400ms p95 (cible)
- Pas de pic mémoire via images

## Stratégie

### 1) Chargement initial
- Charger summary + 10 avis
- Payload minimal (texte + thumbs)

### 2) Pagination
- Cursor-based pagination (stable, rapide)
- Bouton "Afficher plus" (contrôle user)

### 3) Images
- Thumbnails compressées
- `loading="lazy"`
- Preload seulement pour le premier écran
- Full-res uniquement en lightbox

### 4) DOM / rendering
- Éviter 200 cards dans le DOM.
- Option 1 (simple): Load more jusqu'à 60 cards max, puis bouton "Voir les plus anciens".
- Option 2 (avancée): virtual scrolling.

### 5) Cache
- Cache server-side summary (invalidé quand nouvel avis publié/validé)
- ETag/Last-Modified pour list
