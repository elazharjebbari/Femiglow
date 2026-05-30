# F16 — Brouillon côté provider

## Objectif
Envoyer le contenu vers Postiz en mode brouillon, sans publication. L'opérateur de la plateforme social termine la publication manuellement côté Postiz.

## Comportement attendu
- Option "Brouillon Postiz" dans dropdown
- Dialog de confirmation
- Appel `POST /posts/:id/draft-on-provider`
- Le post.status reste à `approved` ; un `content_postiz_delivery` est créé avec status `pending` puis `sent`

## Comportement actuel
Fonctionnel. Dialog basique.

## Gaps
- F16-LOCAL-1 : pas de feedback de l'état Postiz (sent/auth_failed/…)
- F16-LOCAL-2 : pas de lien direct vers Postiz dans le toast succès

## Propositions
### A — Toast simple
### B — Toast + lien "Voir dans Postiz"
### C — Polling status delivery + barre status

## Recommandation
**B** — toast enrichi.

## Implementation
- Backend : retourner l'URL Postiz dans la réponse (`{ jobs: [{ provider_url: '...' }] }`)
- Frontend : si présent, toast avec action "Ouvrir"

## Tests
Voir `test-scenarios.yaml`.
