# Backend - API Contracts

## 1) Summary
GET `/api/reviews/summary?room=<slug>&product=<product_key?>`

Response: `review_summary_response.example.json`

## 2) List
GET `/api/reviews/list?room=<slug>&product=<product_key?>&has_photos=1&rating=5&tags=...&sort=recommended&cursor=...&limit=10`

Response: `review_list_response.example.json`

## 3) Submit
POST `/api/reviews/submit`

Body: `review_submit_request.example.json`

Response: `review_submit_response.example.json`

Notes:
- Retour 202 Accepted (publication après modération).
- Rate limiting (anti-spam) conseillé.

## 4) Policy (transparence)
GET `/api/reviews/policy`
- retourne un texte "Comment nos avis sont vérifiés".
