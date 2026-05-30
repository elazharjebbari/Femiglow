# ADR-0009 — Idempotence de publication indépendante de `scheduledAt`

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Workstream** : backend (ACT-BE)
- **Findings liés** : `MISS-028`, `MISS-006` (appui), en garde-fou de `BUG-003`
- **Actions liées** : ACT-BE-022 (garde-fou dur de ACT-BE-021), coordination ACT-DATA (BUG-038)
- **Décisions parentes** : ADR-0005 (cron self-hosted), ADR-0002 (vérité)

## Contexte

La clé d'idempotence de `scheduleContentPost` (`admin-service.ts:328`) est construite avec `defaultIdempotencyKey(postId, accountId, scheduledAt.toISOString())` — elle **intègre l'horodatage de programmation**. Conséquences :

- **Reprogrammer** un même post à un autre horaire produit **DEUX** `social_publish_job` `queued` distincts (la clé diffère, `findPublishJobByIdempotencyKey` ne matche pas), au lieu de muter l'existant (MISS-028) ;
- **`publish-now`** n'invalide pas le job `queued` programmé du même post (MISS-006) ;
- sous **scheduler actif** (BUG-003 une fois branché par ACT-BE-021), ces jobs s'exécutent tous → **double-publication sur de vrais comptes Instagram clients**.

C'est le **seul risque irréversible** du projet : une fois publié sur un compte client, on ne revient pas en arrière.

## Décision

1. **Clé d'idempotence par `post + compte + intent`**, **indépendante de `scheduledAt`**. Reprogrammer le même post sur le même compte réutilise/mute la même ligne `social_publish_job`.
2. **`reschedule` MUTE** le `scheduledAt` du job `queued` existant (jamais de second job).
3. **`publish-now` invalide/réutilise** le job `queued` existant du même post+compte avant d'envoyer (un seul envoi).
4. **Verrou / locking** pour éviter qu'un tick scheduler chevauchant n'exécute deux fois le même job (cohérent avec ADR-0005 « idempotence/locking requis »).
5. **Garde-fou dur** : l'activation **live** du scheduler (ACT-BE-021) est interdite tant que cette idempotence **et** la sync d'état `content_post↔job` (BUG-038, data) ne sont pas prouvées en mock/staging.

## Conséquences

- ✅ Neutralise le risque irréversible avant de transformer BUG-003 (blocker inerte) en chemin actif.
- ✅ `reschedule`/`publish-now`/`schedule` convergent vers **un seul** job par post+compte.
- ⚠️ Impose un test explicite anti-doublon comme gate d'activation (DoD de ACT-BE-022).
- ⚠️ Dépend de la sync d'état côté data (BUG-038) — co-garde-fou, pilotage croisé.

## Alternatives écartées

- **Garder `scheduledAt` dans la clé + dédupliquer au moment du tick** : déplace le risque dans le worker concurrent et reste fragile aux courses ; corrige le symptôme, pas la cause.
- **Brancher le scheduler d'abord, durcir ensuite** : inacceptable — exposerait les comptes clients à des doubles publications pendant la fenêtre intermédiaire.
