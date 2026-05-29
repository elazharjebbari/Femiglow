# BUG-040 — Route legacy /postiz-draft (createDraftInPostiz) appelle DIRECTEMENT l'API Postiz réelle, hors du garde-fou dry_run/live

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | publication-postiz |
| **Composant** | `src/app/api/admin/content-studio/posts/[id]/postiz-draft/route.ts + service.createDraftInPostiz:625` |
| **Mode mock** | `n/a` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Tous les chemins de publication respectent SOCIAL_PUBLISHING_MODE (dry_run par défaut, sécurité).

## État réel vérifié
La route legacy /postiz-draft contourne effectivement le garde-fou SOCIAL_PUBLISHING_MODE=dry_run et touche l'API Postiz réelle d'un compte client, MAIS l'effet concret est la création d'un BROUILLON (type:'draft') dans la file de revue Postiz (pas une publication Instagram en ligne). Elle exige un integrationId valide fourni par l'appelant et émet des en-têtes Deprecation/Sunset + un audit social.legacy_route_used. Reste une brèche de simulation réelle à décommissionner.

## Écart
Un appel à /postiz-draft (encore vivant) publie/draft réellement sur Postiz même en staging dry_run. La nouvelle UI pointe vers /draft-on-provider (sûr), mais la route legacy reste exposée et fonctionnelle.

## Cause racine
Pipeline legacy content_postiz_delivery non encore supprimé; il précède l'abstraction adapter et ne connaît pas le mode dry_run.

## Preuves
- postiz-draft/route.ts:43 createDraftInPostiz({ integrationId: parsed.data.integrationId, ... }) — integrationId requis fourni par l'appelant
- service.ts:702 createPostizDraft({...}) appelé directement (API réelle), aucune lecture de SOCIAL_PUBLISHING_MODE
- postiz-draft/route.ts:12-17 commentaire: legacy, Deprecation/Sunset RFC 8594, remplacé par publish-now
- PublishActionGroup.tsx:548 endpointFor('draft') => /draft-on-provider (route SÛRE), donc la nouvelle UI n'utilise plus postiz-draft

## Reproduction
POST /api/admin/content-studio/posts/<id>/postiz-draft avec {integrationId:'<vrai id Postiz>'} en staging => crée un draft sur l'instance Postiz réelle malgré dry_run. (NON exécuté ici par sécurité.)

## Piste de correction
Décommissionner /postiz-draft (renvoyer 410 Gone), ou au minimum router createDraftInPostiz à travers resolveDefaultAccount + respecter SOCIAL_PUBLISHING_MODE (dry_run -> simuler).

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** createDraftInPostiz (service.ts:625) appelle uploadPostizMediaFromUrl (664) et createPostizDraft (702) directement, sans aucune lecture de SOCIAL_PUBLISHING_MODE (aucune occurrence dans service.ts/postiz.ts) ni passage par resolveDefaultAccount. postiz.ts émet de vraies requêtes vers l'instance Postiz réelle (POST /api/public/v1/upload, POST /api/public/v1/posts) avec authorization=POSTIZ_API_KEY, present en staging. La route /postiz-draft (route.ts) est toujours montée, requiert une session admin, et integrationId est requis (schemas.ts:47 z.string().min(1)). Donc un appel fourni avec un vrai integrationId crée bien un objet côté Postiz réel malgré dry_run. Nuance: buildPostizDraftPayload défaute type:'draft' (postiz.ts:143) et createDraftInPostiz ne fixe pas input.type => l'effet est la création d'un BROUILLON dans la file de revue Postiz, pas une publication IG. La nouvelle UI v2 utilise /draft-on-provider (sûr).
- **Contre-preuve / nuance :** service.ts:664,702 (appels directs); grep SOCIAL_PUBLISHING_MODE dans service.ts/postiz.ts = aucun. postiz.ts:226,249 (vraies URL Postiz), :87 authorization=POSTIZ_API_KEY. postiz.ts:143 type ?? 'draft'. route.ts:43-49 createDraftInPostiz avec integrationId requis. PublishActionGroup.tsx:548 -> /draft-on-provider.

> Réf. registre : `bug-register.csv` ligne `BUG-040` · matrice : `gap-matrix.csv`.
