# F02 — Programmer un post (schedule)

## Importance : 🔴 P0

## Objectif
Programmer la publication d'un post à une date/heure future. Le worker cron picks le job au moment voulu et exécute la publication.

## Comportement attendu

### Pré-conditions
- Identiques à F01 (post approuvé, brand pass, media, caption)
- Date dans le futur (≥ now + 60 secondes)

### UI flow
1. Click "Publier" → "Programmer"
2. Dialog avec datepicker (datetime-local) + presets :
   - **+1h** : now+1h, arrondi à 5min
   - **Demain 9h** : demain à 9h00 (timezone navigateur)
   - **Lundi 14h** : prochain lundi à 14h00
3. Label timezone visible (ex: "Fuseau : Europe/Paris")
4. Validation client : min=defaultScheduledAt() (=now+1h)
5. Click "Programmer" → API call
6. Toast "Publication programmée pour {date}"
7. Le post apparaît dans Calendar à la date choisie + dans JobQueue (status='queued', scheduledAt future)

### API call
- `POST /api/admin/content-studio/posts/:postId/schedule`
- Body : `{ scheduledAt: ISO, accountId?, idempotencyKey? }`

### Validations
- scheduledAt requis, format ISO8601
- scheduledAt > now() + minLeadTime (60s par défaut)
- post pre-flight (idem F01)

### Worker pickup
- Cron `/api/cron/content-studio/social-publish-scheduler` toutes les 5min
- Pick jobs WHERE status='queued' AND scheduledAt ≤ now AND lockedAt IS NULL
- Limite : 5 jobs par run (configurable, max 20)
- Pour chaque : executeJob (idem F01)

## Cas d'erreur

| Cas | HTTP | Code | UI |
|-----|------|------|----|
| scheduledAt manquant | 400 | `invalid_input` | Validation HTML5 |
| scheduledAt dans le passé | 400 | `invalid_date` | Toast "La date doit être dans le futur" |
| scheduledAt trop proche (< 60s) | 400 | `min_lead_time` | Toast "La date doit être au moins 5 min dans le futur" |
| post invalide | 409 | `invalid_state` | Toast |
| Autres | comme F01 |

## Tests à écrire
Voir `test-scenarios.yaml`. Couvre :
- Presets : valeurs correctes, mise à jour input
- Validation date passée
- Min lead time
- Timezone label
- API call + toast + apparition dans Calendar
- Cron worker pick-up (unit + integration)
- Multi-account schedule
