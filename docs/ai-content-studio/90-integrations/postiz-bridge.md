# Intégration Postiz

## Rôle de Postiz

Postiz est la couche de publication sociale. FemiGlow ne doit pas réimplémenter :

- connexion OAuth aux plateformes ;
- upload social compatible ;
- scheduling multi-plateforme ;
- statuts de posts ;
- analytics exposés par Postiz.

FemiGlow doit gérer :

- stratégie ;
- génération ;
- validation ;
- assets ;
- audit ;
- mapping vers payload Postiz ;
- retry et debug métier.

## Endpoints utilisés

| Action | Endpoint Postiz |
| --- | --- |
| Lister comptes | `GET /api/public/v1/integrations` |
| Upload media | `POST /api/public/v1/upload` ou upload from URL selon disponibilité |
| Créer/programmer post | `POST /api/public/v1/posts` |
| Lister posts | `GET /api/public/v1/posts` |
| Lire analytics | endpoints analytics Postiz si disponibles |

## Payload minimal

```json
{
  "type": "schedule",
  "shortLink": false,
  "date": "2026-05-20T10:00:00.000Z",
  "tags": [{"value": "femiglow", "label": "FemiGlow"}],
  "posts": [
    {
      "integration": {"id": "postiz-integration-id"},
      "value": [
        {
          "content": "Caption validée...",
          "image": [
            {
              "id": "media-id-postiz",
              "path": "https://res.cloudinary.com/..."
            }
          ]
        }
      ],
      "settings": {
        "__type": "instagram",
        "post_type": "post"
      }
    }
  ]
}
```

## Variables d’environnement proposées

```env
CONTENT_STUDIO_ENABLED=false
POSTIZ_BASE_URL=https://postiz.lumiereacademy.com
POSTIZ_API_KEY=...
CONTENT_STUDIO_DEFAULT_TIMEZONE=Africa/Casablanca
CONTENT_STUDIO_OPENAI_MODEL_TEXT=gpt-5.5
CONTENT_STUDIO_OPENAI_MODEL_IMAGE=gpt-image-2
CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS=500
```

## Gestion erreurs

| Erreur | Réponse FemiGlow |
| --- | --- |
| 401 Postiz | Marquer integration `auth_failed`, alerter admin |
| 404 integration | Sync integrations, demander sélection |
| 400 payload | Pas de retry, erreur de mapping à corriger |
| 429 | Retry backoff + message quota |
| 5xx | Retry backoff |
| Timeout | Retry limité puis `failed` |

