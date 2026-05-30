# BUG-038 — Cancel/Reschedule orphelinent les social_publish_job 'queued' (incohérence d'état latente)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | publication-postiz |
| **Composant** | `src/lib/content-studio/service.ts (cancelScheduledPost L568, reschedulePost L603) + admin-service.scheduleContentPost` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Annuler un post programmé annule aussi le job de publication associé; reprogrammer déplace la date du job queued.

## État réel vérifié
cancelScheduledPost et reschedulePost n'opèrent QUE sur content_post (statut/scheduledAt via cancelPost/updatePostPlanning). Ils ne touchent JAMAIS la ligne social_publish_job. Un job créé par scheduleContentPost reste 'queued' avec son ancien scheduledAt. Si le scheduler tournait (cf finding-1), il publierait un post annulé / à l'ancienne date.

## Écart
Désync content_post <-> social_publish_job. Actuellement masqué car le scheduler ne tourne pas (finding-1), mais devient un bug actif dès que le scheduler est branché.

## Cause racine
Deux sous-systèmes (planning éditorial content_post via content-studio/service vs lifecycle de job social_publish_job via social-publishing/admin-service) non synchronisés sur cancel/reschedule.

## Preuves
- service.ts:568-573 cancelScheduledPost => cancelPost(post.id) (content_post seulement)
- service.ts:603-609 reschedulePost => updatePostPlanning (content_post.scheduledAt seulement)
- admin-service.ts:329-341 scheduleContentPost crée social_publish_job status=queued scheduledAt=input.scheduledAt; aucune route cancel/reschedule ne le met à jour
- admin-service.ts a bien cancelPublishJob (L353) mais cancelScheduledPost ne l'appelle pas

## Reproduction
1) Programmer un post (crée job queued). 2) Annuler le post via /cancel. 3) content_post=cancelled mais le social_publish_job reste queued. 4) Si finding-1 corrigé et scheduler actif, le post annulé serait publié.

## Piste de correction
Dans cancelScheduledPost, appeler cancelPublishJob sur les jobs queued du post (transition queued->cancelled autorisée par state-machine). Dans reschedulePost, mettre à jour scheduledAt du job queued ou recréer le job.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** cancelScheduledPost (service.ts:568-573) appelle uniquement cancelPost (content_post). reschedulePost (603-609) appelle uniquement updatePostPlanning (content_post.scheduledAt). Les routes /cancel et /reschedule n'invoquent que ces deux fonctions. Aucune ne touche social_publish_job ni n'appelle cancelPublishJob (qui existe en admin-service:353 mais reste non appelé par ces chemins). scheduleContentPost crée bien un job queued (admin-service:329-341). Le job reste donc orphelin queued. Latent aujourd'hui car le scheduler ne tourne pas (F1), bug actif dès F1 corrigé.
- **Contre-preuve / nuance :** service.ts:568-573 et 603-609 (aucune référence à social_publish_job/cancelPublishJob). cancel/route.ts:22 -> cancelScheduledPost; reschedule/route.ts:26 -> reschedulePost. state-machine: queued->cancelled est autorisé, donc le fix proposé est viable.

> Réf. registre : `bug-register.csv` ligne `BUG-038` · matrice : `gap-matrix.csv`.
