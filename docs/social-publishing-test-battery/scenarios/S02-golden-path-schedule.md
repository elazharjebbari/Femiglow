# S02 — Golden path : Programmer

## Étapes
1. Sur /create avec post approuvé
2. Click Publier → Programmer
3. Vérifie : dialog avec 3 presets visible + tz label
4. Click "+1h" → input se remplit
5. Click "Demain 9h" → input change
6. Click "Lundi 14h" → input change
7. Final : pick "+1h", confirme
8. Toast "Publication programmée pour {date}"
9. Navigate /plan → Calendar week → card visible au jour J+0
10. JobQueue → job status='queued' scheduledAt future

## Critères
- API POST /schedule appelée avec scheduledAt ISO
- Job créé queued
- post.status='scheduled'
- post.scheduledAt = date choisie

## Cas additionnel (cron simulation)
11. Avance le temps (mock Date.now) → +1h passé
12. Trigger cron `/api/cron/.../social-publish-scheduler`
13. Vérifie : job picked, executé, status='published'

## Spec
`e2e/social-publishing/schedule-golden-path.spec.ts`
