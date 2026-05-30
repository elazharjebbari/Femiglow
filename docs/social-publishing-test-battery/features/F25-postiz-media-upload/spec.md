# F25 — Postiz media upload

## Importance : 🟠 P1

## Objectif
Upload chaque média (image/vidéo) côté Postiz avant la création du post. Retour : `{ id, path }`.

## Flow
1. Pour chaque media du content : POST Postiz `/api/public/v1/upload`
   - Body : `{ url: media.originalUrl }` ou multipart si binary
   - Headers : `authorization: API_KEY`, `content-type`
2. Récupère `{ id, path }` de la réponse
3. Ces id+path sont injectés dans `posts[0].value[0].image[]`

## Pré-requis
- media.originalUrl est HTTPS (sinon 409 invalid_media_url côté FemiGlow)
- media.status='ready' ou 'passthrough'

## Tests
Voir `test-scenarios.yaml`.
