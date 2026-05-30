# Phase 7 — Live Instagram (AlFenna Beauty)

## Objectif
1 spec `live-instagram-alfenna.spec.ts` qui poste réellement et nettoie.

## Setup
- env strict (E2E_LIVE_POSTIZ=1, POSTIZ_API_KEY, etc.)
- `scripts/live-preflight.sh` vérifie tout avant
- Postiz account AlFenna sync à jour

## Spec
Voir squelette dans `test-battery/05-playwright-live-plan.md`.

## Cleanup
- `E2E_LIVE_CLEANUP=1` → DELETE Postiz automatique
- `scripts/social-publishing-live-cleanup.sh` pour récupération manuelle

## Audit
Chaque run live :
- Archive trace.zip
- DB snapshot post-run
- Postiz logs
- Coût ($0.02 typique)

Stocké dans `test-results/live-runs/{timestamp}/`.

## Durée
~1 j-p (setup + spec + protocole)

## Acceptance
- [ ] Spec passe avec E2E_LIVE_POSTIZ=1
- [ ] Post visible sur Instagram (vérif manuelle)
- [ ] Cleanup réussi (post supprimé après vérifs)
- [ ] 4 assertions DB+API+audit passent
- [ ] Protocol recovery script testé
