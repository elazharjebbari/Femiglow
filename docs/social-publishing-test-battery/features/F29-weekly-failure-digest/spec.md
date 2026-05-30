# F29 — Weekly failure digest

## Importance : 🟢 P3

## Objectif
Agrégat hebdomadaire des publications en échec, envoyé par email à `SOCIAL_DIGEST_RECIPIENT`.

## Comportement
- Cron `/api/cron/content-studio/social-failure-digest` chaque lundi 09:00
- Query : jobs failed des 7 derniers jours
- Groupé par provider × platform × error_code
- Email avec tableau + lien vers JobQueue

## Tests
Voir `test-scenarios.yaml`.
