# BUG-003 — La publication PROGRAMMÉE ne s'exécute jamais: le scheduler n'est branché à aucun cron

| | |
|---|---|
| **Sévérité** | `blocker` |
| **Domaine** | publication-postiz |
| **Composant** | `src/app/api/cron/content-studio/social-publish-scheduler/route.ts + src/lib/social-publishing/worker.ts + vercel.json + cron/tick` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Un post programmé via POST /schedule crée un social_publish_job 'queued' avec scheduledAt futur, qu'un worker cron (runScheduledPublishJobs) récupère à échéance et exécute (executeJob), publiant via dry_run/Postiz.

## État réel vérifié
Identique au realState de l'auditeur, avec correction du mécanisme cron réel: ce n'est pas Vercel (vercel.json n'est effectivement pas honoré ici) mais des systemd timers qui pilotent les crons. Aucun timer/service systemd ne cible /api/cron/content-studio/social-publish-scheduler, donc un job queued+scheduledAt reste queued indéfiniment (mock comme live). Programmation = accusé de réception inerte.

## Écart
Le chemin 'Programmer' de l'UI (PublishActionGroup -> /schedule) accuse réception ('Publication programmée') mais le contenu ne sera JAMAIS publié automatiquement, ni en mock ni en live, sauf appel manuel authentifié de la route scheduler avec CRON_SECRET.

## Cause racine
Route cron créée mais jamais enregistrée dans l'orchestrateur de crons (l'app tourne en PM2/next start, pas Vercel; vercel.json n'est de toute façon pas honoré ici, et tick ne relaie pas le scheduler).

## Preuves
- grep -rln 'runScheduledPublishJobs' src/ (hors tests) => seulement social-publish-scheduler/route.ts et worker.ts; aucun appel depuis cron/tick
- cat src/app/api/cron/tick/route.ts: appelle processBatch, scanAndDispatchCartAbandon, scanAndDispatchLeadStep1Abandon, syncCampaignStatuses — JAMAIS runScheduledPublishJobs
- vercel.json crons: 15 entrées (tick, media-optimize, ...), AUCUNE = /api/cron/content-studio/social-publish-scheduler
- crontab -l + /etc/cron.d/: aucune entrée social-publish
- Probe: GET /api/admin/content-studio/publish-jobs?status=queued => 0 jobs queued (tous les 11 jobs existants sont status=published/mode=now, jamais schedule)

## Reproduction
1) En staging, via /admin/content-studio (ou /create), programmer un post approuvé pour T+1h. 2) Le job social_publish_job est créé 'queued' avec scheduledAt. 3) Attendre T+1h+ : le post reste 'scheduled'/'queued', jamais 'published'. 4) Confirmer: GET /api/admin/content-studio/publish-jobs?status=queued montre le job toujours queued.

## Piste de correction
Brancher runScheduledPublishJobs dans /api/cron/tick (l'appeler dans la boucle tick avec un limit borné), OU enregistrer un cron PM2/système qui POST /api/cron/content-studio/social-publish-scheduler avec Bearer CRON_SECRET toutes les minutes. Vérifier aussi que vercel.json (si déploiement Vercel futur) inclue l'entrée.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Le scheduler n'est branché à aucun déclencheur. Preuve renforcée: le déploiement réel n'utilise PAS Vercel crons mais des systemd timers (pid web = PM2/next start). L'énumération complète des timers systemd ne contient AUCUN social-publish-scheduler. tick (seul cron par minute) appelle uniquement scanAndDispatchCartAbandon/LeadStep1/syncCampaignStatuses/processBatch — jamais runScheduledPublishJobs. grep exhaustif (ts/js/json/sh/yml/service/timer hors node_modules/.next): runScheduledPublishJobs et social-publish-scheduler ne sont référencés QUE par leur propre route, le worker, leurs tests et des docs. Probe: publish-jobs?status=queued => 0; sur 12 jobs tous published/dry_run, publishMode {now:11, draft:1}, jamais 'schedule'. Le chemin /schedule crée bien un job queued+scheduledAt (admin-service:329-341) mais rien ne le consomme.
- **Contre-preuve / nuance :** systemctl list-timers --all | grep femiglow: timers existants = tick, media-optimize, media-recover, promote-scheduled-fields, analytics-refresh, tracking-purge, chat, insights-purge, purge-field-history, email-outbox. AUCUN social-publish. /etc/systemd/system/femiglow-staging-cron-tick.service ExecStart=curl POST .../api/cron/tick (pas de fan-out). tick/route.ts:33-57 ne contient aucun appel au worker de publication.

> Réf. registre : `bug-register.csv` ligne `BUG-003` · matrice : `gap-matrix.csv`.
