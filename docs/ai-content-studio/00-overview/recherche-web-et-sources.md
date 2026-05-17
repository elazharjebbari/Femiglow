# Recherche web et sources

Recherche effectuée le 2026-05-14. Les sources ci-dessous servent à cadrer le prototype sans remplacer les contraintes locales de `docs/ai-content-service/concept.md`.

## Sources principales

| Source | Apport pour le studio |
| --- | --- |
| Postiz — Create Post : https://docs.postiz.com/public-api/posts/create | Confirme le payload public `POST /api/public/v1/posts`, les types `draft`, `schedule`, `now`, les settings par plateforme, et l’obligation d’un `__type`. |
| Postiz — List Integrations : https://docs.postiz.com/public-api/integrations/list | Confirme `GET /integrations`, les IDs de comptes connectés, `identifier`, `disabled`, `profile`. |
| Postiz — site produit : https://postiz.com/ | Confirme le positionnement API, analytics, AI text/images/videos et la logique “posting app on top of Postiz”. |
| OpenAI — Image generation guide : https://developers.openai.com/api/docs/guides/image-generation | Confirme que l’API image gère génération, édition, références, multi-turn via Responses API, choix qualité/format/taille. |
| OpenAI — Models : https://developers.openai.com/api/docs/models/all | Confirme l’évolution rapide des modèles image ; le choix modèle doit rester configurable. |
| Buffer — Social Media Scheduling Tools 2026 : https://buffer.com/resources/social-media-scheduling-tools/ | Benchmark produit : calendrier visuel, bulk scheduling, approval workflows, media library, analytics sont les features structurantes des schedulers modernes. |
| Meta/Instagram Graph API — documentation publique référencée : https://developers.facebook.com/docs/instagram-api/guides/content-publishing/ | La publication Instagram repose historiquement sur conteneur média puis publication ; Postiz masque cette complexité mais les limites Meta restent à surveiller. |

## Enseignements utiles

1. Le studio doit éviter de réimplémenter un scheduler social complet : Postiz fait déjà intégrations, upload, posts, statuts et analytics.
2. Le vrai différenciateur FemiGlow est la **qualité éditoriale et visuelle contrôlée par la charte**.
3. Les outils sociaux performants convergent vers cinq objets UX : calendrier, bibliothèque média, brouillons/idées, approvals, analytics.
4. Les images IA doivent être générées avec références, retouches et variantes, puis validées contre un score marque.
5. Les APIs et modèles changent vite : providers, modèles et paramètres doivent être configurables en DB/env, pas codés en dur.

## Hypothèses à vérifier avant implémentation

| Hypothèse | Vérification |
| --- | --- |
| Postiz self-hosted expose les mêmes endpoints que la doc cloud | Test `GET /api/public/v1/integrations` sur `https://postiz.lumiereacademy.com` |
| Upload depuis URL fonctionne mieux que upload fichier avec le patch Cloudinary/R2 | POC sur une image FemiGlow publique |
| Instagram/Facebook connectés ne sont pas `disabled` | Snapshot quotidien des integrations |
| Analytics Postiz sont suffisantes pour feedback loop v1 | Tester `GET /post analytics` et `GET /platform analytics` |
| Modèle image OpenAI disponible côté organisation | Vérifier organization verification, rate limits, pricing |

