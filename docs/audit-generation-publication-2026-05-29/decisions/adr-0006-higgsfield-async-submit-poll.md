# ADR-0006 — Réécriture de l'intégration Higgsfield sur le modèle async submit+poll

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Findings liés** : `BUG-002`, `BUG-008`, `BUG-009`

## Contexte

L'intégration Higgsfield est partiellement corrigée mais reste **non fonctionnelle** :
- **Host + auth corrigés** : `platform.higgsfield.ai`, `Authorization: Key KEY_ID:KEY_SECRET` (helper `higgsfield-auth.ts`) ✅ ;
- **Credential incomplet** en staging (clé `hf_…` sans la moitié `KEY_SECRET`) → `higgsfieldAuthHeader()` renvoie `null` → throw `invalid_state` ;
- **Endpoints encore SYNCHRONES faux** : `image-generation.ts` POST `/v1/images/generate`, `video-generation.ts` POST `/v1/videos/generate` + poll `/v1/videos/status/:id`, alors que l'API réelle est **asynchrone** : `POST /v1/text2image/<model>` et `/v1/image2video/<model>` retournent un id de requête, puis **polling** `GET /v1/requests/{id}/status` ;
- la **découverte** de modèles vise encore l'ancien host mort (`api.higgsfield.ai`) + `Bearer`, échoue, et tombe sur un fallback statique **marqué `live` à tort** (BUG-009).

## Décision

1. Réécrire les appels génération image/vidéo en **submit + poll** conformes à l'API réelle, avec backoff borné, timeout global et gestion des statuts `queued|processing|completed|failed`.
2. Aligner la **découverte de modèles** sur le bon host/auth ; ne marquer `source:"live"` que les modèles réellement renvoyés par l'API (sinon `static`/`fallback`).
3. Exiger un **credential complet `KEY_ID:KEY_SECRET`** ; gating clair sinon (déjà en place). Validation au boot quand un modèle `hf-*` est exposé.
4. **Vérification live** obligatoire (DoD) une fois le credential fourni : générer 1 image + 1 vidéo de bout en bout, prouvées via MSW (mock fidèle au flux async) **et** live.

## Conséquences

- ✅ Génération Higgsfield réellement opérationnelle et conforme.
- ✅ Le contrat async devient mockable fidèlement (ADR-0003) → parité possible.
- ⚠️ Bloqué sur la fourniture du credential complet par le commanditaire.
- ⚠️ Le polling doit être piloté côté worker/job, pas dans la requête HTTP opérateur (UX + timeouts).

## Alternatives écartées

- **Garder les endpoints sync** : ne correspond à aucune API réelle → échec permanent.
- **Abandonner Higgsfield au profit d'OpenAI uniquement** : possible repli court terme (image), mais perd la vidéo générative.
