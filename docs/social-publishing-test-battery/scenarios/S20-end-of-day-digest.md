# S20 — End-of-day digest (weekly failure digest)

## Pré-conditions
- 5 jobs failed dans les 7 derniers jours, divers codes

## Étapes
1. Trigger cron `/api/cron/content-studio/social-failure-digest`
2. Vérifie : email envoyé à $SOCIAL_DIGEST_RECIPIENT
3. Email contient :
   - Total failures (5)
   - Breakdown par error_code (3 codes distincts)
   - Lien vers /plan ?status=failed
4. Si 0 failures → email skipped

## Critères
- 1 email envoyé (1 cron run)
- Email lisible avec tableau
- Skip si 0 failures

## Spec
Test unit `weekly-failure-digest.test.ts`.
