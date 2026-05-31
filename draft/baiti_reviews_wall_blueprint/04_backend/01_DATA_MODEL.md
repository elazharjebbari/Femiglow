# Backend - Data model

## Objectifs
- Avis associés à un produit (et optionnellement à une variante).
- Possibilité d'agréger un mur d'avis "room-level" (plusieurs produits) via un mapping.
- Modération (PENDING/APPROVED/REJECTED/HIDDEN).
- Photos optionnelles.

## Modèle proposé

### ProductReview
- id (uuid)
- product (FK Product)
- room_slug (string) ou FK Room (si besoin d'agrégations par room)
- variant_key (string, optionnel)
- rating (1..5)
- title (string, optionnel)
- body (text)
- author_name (string, optionnel)
- author_city (string, optionnel)
- is_anonymous (bool)
- language (string, optionnel)
- tags (array of strings) ou M2M ReviewTag
- has_photos (bool)
- verified_purchase (bool)
- status (enum)
- moderation_note (text)
- source (enum: manual, post_purchase_email, import)
- created_at
- published_at

### ReviewPhoto
- id
- review (FK)
- image_url (ou storage path)
- thumb_url
- order

### ReviewAggregate (cache)
- product_id
- avg_rating
- count
- distribution_json
- tag_summary_json
- updated_at

## Index
- (product_id, status, created_at desc)
- (room_slug, status, created_at desc)
