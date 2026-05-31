# Tracking - Reviews Wall

## Objectifs
- Mesurer l'impact du mur d'avis sur :
  - engagement (open, scroll, filters)
  - consultation avis (card impressions)
  - ouverture produit depuis avis
  - soumission avis
  - conversion (lead submit)

## Format
- Utiliser `window.dataLayer.push({ event, ...payload })`.
- Éviter payloads lourds.

## Événements
Voir `datalayer_events.csv`.

## Bonnes pratiques
- Event naming stable (snake_case).
- Inclure room_slug + product_key.
- Pour les impressions : debouncer + batch.
