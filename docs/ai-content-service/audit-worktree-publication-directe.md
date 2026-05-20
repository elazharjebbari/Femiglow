# Audit worktree — publication directe AI content

Date: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

## Résultat

Le worktree contient actuellement le dossier documentaire `docs/ai-content-service`, mais aucun module applicatif `content-studio` ou `social-publishing` n'était présent avant cette tranche.

Constats vérifiés:

- `docs/ai-content-service/concept.md` existe.
- `docs/ai-content-service/plan-publication-directe.md` existe.
- `docs/ai-content-service/runbook-publication-directe.md` existe.
- Aucun dossier `apps/web/src/lib/content-studio` n'était présent.
- Aucune route `apps/web/src/app/api/admin/content-studio` n'était présente.
- Aucune UI `apps/web/src/components/admin/content-studio` n'était présente.

## Décision d'exécution

La première tranche implémentée est volontairement limitée au noyau backend pur `apps/web/src/lib/social-publishing` avec adapter `dry_run`.

Cette tranche ne dépend pas de Meta, Postiz, d'une migration DB ou d'une UI encore absente. Elle établit les contrats, les erreurs normalisées, le retry et les transitions de statut pour rendre la suite testable sans effet externe.

## Suite logique

1. Porter ou créer le module Content Studio dans ce worktree.
2. Ajouter le data model Drizzle `social_*`.
3. Brancher les routes admin sur le service `social-publishing`.
4. Ajouter UI et Playwright sur le parcours dry-run.
5. Ajouter Postiz fallback puis Meta Graph single-image.
