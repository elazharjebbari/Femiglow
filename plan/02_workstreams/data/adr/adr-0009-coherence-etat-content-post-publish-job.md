# ADR-0009 — Invariant de cohérence d'état content_post ↔ social_publish_job (propagation transactionnelle)

- **Statut** : Proposé (workstream DATA)
- **Date** : 2026-05-29
- **Findings liés** : `BUG-038` (major), contexte `BUG-003` (garde-fou du scheduler)
- **Actions** : ACT-DA-004 (conception, = dépendance `ACT-DATA-SYNC-JOB` citée par ACT-BE-021) ; consommé par ACT-BE-021/T-301

## Contexte

Deux sous-systèmes gèrent l'état d'un post à publier :
- le **planning éditorial** (`content_post` via `content-studio/service.ts`) ;
- le **lifecycle de job** (`social_publish_job` via `social-publishing/admin-service.ts`).

`cancelScheduledPost` (`service.ts:568`) et `reschedulePost` (`service.ts:603`) modifient **uniquement** `content_post` (via `cancelPost` / `updatePostPlanning`). Le `social_publish_job` lié reste **orphelin `queued`** avec son ancien `scheduled_at`. Latent (le scheduler ne tourne pas), mais dès qu'il est branché : un **post annulé est publié**, ou publié à l'**ancienne date**.

La transition `queued → cancelled` est **déjà autorisée** par la machine à états (`state-machine.ts:7`) — le correctif est donc viable sans modifier la machine.

## Décision

**Invariant de cohérence transverse (INV-2)** :
- `content_post.status = cancelled` ⇒ **tous** les `social_publish_job` non-terminaux du post (`draft|approved|queued`) → `cancelled`.
- `content_post.scheduled_at = T` (reschedule) ⇒ le job `queued` du post a `scheduled_at = T` (mutation en place, cohérent avec ADR-0008 : pas de 2e job).
- Propagation **transactionnelle** : la mutation `content_post` et la mutation `social_publish_job` se font dans la **même transaction** (atomicité).

**Garde-fou structurel** : on retient un **check applicatif transactionnel** (et non un trigger DB) pour rester dans l'écosystème Drizzle, testable et versionné. Un trigger DB est une alternative possible si la cohérence doit être garantie même hors application — à trancher ultérieurement (migration additive réversible séparée si retenu).

## Conséquences

- ✅ Plus d'orphelin `queued` ; un post annulé n'est **jamais** publié (garde-fou dur de `BUG-003`/T-103b, avec ADR-0008).
- ✅ Aucune migration de schéma requise (la machine à états supporte déjà `queued → cancelled`).
- ✅ Réversible (bascule de logique applicative).
- ⚠️ Exige la transactionnalité : si les deux sous-systèmes vivent sur des connexions séparées, vérifier qu'ils partagent la transaction.
- ⚠️ Le check applicatif ne protège pas des mutations hors application (acceptable : tout passe par l'app).

## Alternatives écartées

- **Trigger DB systématique** : garantit la cohérence hors-app mais sort de Drizzle, plus difficile à tester/versionner → repoussé en option.
- **Job de réconciliation périodique** : corrige a posteriori, laisse une fenêtre d'incohérence (double-post possible entre deux passages) → insuffisant comme garde-fou.
