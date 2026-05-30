# S15 — Bulk schedule : 7 posts programmés en série

## Pré-conditions
- 7 posts approuvés
- Workflow : opérateur programme 1 par jour pour la semaine

## Étapes
1. Pour chaque post :
   - Schedule → +24h depuis le précédent
   - Toast confirme
2. /plan → Calendar week → 7 cards visibles
3. Avance temps de 7 jours (mocked) en simulant cron run
4. Vérifie : 7 publications réussies

## Critères
- 7 jobs scheduled
- 7 audit_log scheduled
- Cron pick-up sur 7 runs

## Spec
`e2e/social-publishing/week-bulk-schedule.spec.ts`
