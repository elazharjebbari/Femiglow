# 10 — Plan d'action priorisé

Préalable : la quasi-totalité du plan dépend de la **décision de branche** (P0-1). Tant qu'elle n'est pas prise, ne pas corriger sur master ce qui est déjà corrigé sur backup (double travail garanti).

## P0 — Sauvegarde & décision structurante (jours 1-2)

| # | Action | Pourquoi | Effort |
|---|---|---|---|
| P0-1 | **Pousser `backup-staging-2026-06-01` sur origin** (avec accord explicite du propriétaire — règle « pas de push sans OK ») | 209 k lignes de travail sur un seul disque = point de défaillance unique | 5 min |
| P0-2 | **Décider : merger backup→master** (recommandé — 5 conflits mesurés, aucun dans le code studio) ou assumer l'abandon du travail média | Tout le reste en dépend ; c'est la seule voie qui réconcilie le code avec la DB déjà migrée | décision |
| P0-3 | Si merge : exécuter le merge, reconstruire `meta/_journal.json` (0063-0065 avant 0073-0078), `pnpm -r typecheck` + suite complète + build | Revalidation = le vrai coût du merge | 1-2 j |
| P0-4 | Restaurer `apps/web/scripts/media-optimize-tick.sh` (ou retirer l'entrée crontab 03:15) | Échec silencieux chaque nuit depuis le 02/06 | 10 min |
| P0-5 | **Ne PAS redémarrer l'app staging depuis master** sur la DB actuelle (assets invisibles, état mixte `primary`/`primary_image`) — redémarrer seulement après P0-2/P0-3, sur un **port libre** (≠8012, pris par corolle-reviews) avec re-pointage du vhost LiteSpeed | Régression assets immédiate sinon | — |

## P1 — Sûreté de publication (avant toute activation live ; semaine 1)

| # | Action | Référence |
|---|---|---|
| P1-1 | **Cancel/reschedule purgent les jobs queued** du post + `executeJob` re-vérifie le statut du post avant de publier | `03-backend` §3 (bloquant #5) |
| P1-2 | **Kill-switch global** : exiger un env-flag explicite pour tout adapter non-dry_run ; supprimer le repli silencieux sur `eligible[0]` (la base existe sur backup : `SOCIAL_PUBLISHING_MODE`) | `03-backend` §3 |
| P1-3 | Supprimer le bypass `x-vercel-cron` du scheduler (exiger `CRON_SECRET`) | `06-securite` #1 |
| P1-4 | Reaper de jobs zombies (lock TTL) + corriger l'ordre des écritures dans `executeJob` | `03-backend` §3 |
| P1-5 | `uniqueIndex` sur `content_post.draft_id` ; transactions drizzle autour de generate/approve/executeJob/upsertAsset | `03-backend` §2, §5 |
| P1-6 | Tests des routes `reschedule`, `posts/[id]/cancel`, `publish-jobs/[id]/retry` (ce sont exactement les chemins porteurs des bugs ci-dessus) | `04-tests` |

## P2 — Réparer le flow opérateur dans /create (semaine 2)

| # | Action | Référence |
|---|---|---|
| P2-1 | Hydratation de `/create` (server-side ou fetch de montage) — débloque tout le reste | `02-interface-ux` étape 0 |
| P2-2 | Déclencheur UI de génération de variantes texte + bouton **Approuver** dans le workspace | étapes 2 et 4 |
| P2-3 | Une seule instance `useDraftAutosave` ; restaurer le pending en cas d'échec ; persister `mediaId` à la sélection | §2 (3 critiques) |
| P2-4 | Créer la route `create/[draftId]` (ou réécrire les liens) — corrige les 404 Library/Plan ; retirer le no-op « Programmer » bulk | §4 |
| P2-5 | Désactiver « Générer un visuel IA » sans draft ; valider la date de programmation ; passer `disabled` (violations) et `onPublished` à PublishActionGroup | étapes 3-4 |
| P2-6 | Vidéo : intégrer `VideoPlayer` (existe sur backup) dans PlatformPreview + métadonnées dans la confirmation de publication | §3, plan « ergonomie vidéo » |
| P2-7 | `reload()` complet (jobs + mediaItems) ; backoff sur le poll JobQueue | §2, §6 |

## P3 — Debuggabilité, tests, dette (semaines 3-4)

| # | Action | Référence |
|---|---|---|
| P3-1 | Génération : runs `failed` enregistrés + `HttpError('upstream_failed', cause)` au lieu d'Error brut (BUG-001 résiduel : adopter `provider-credentials.ts` du backup) | `05-erreurs` §2 |
| P3-2 | Tests réels de `generation.ts` (429/5xx/JSON malformé) et de `budget.ts` (supprimer le test-copie) ; payload vidéo asserté dans l'adapter | `04-tests` §6 |
| P3-3 | Ajouter les e2e DB-assertives (social-publishing ×2, approval-gate) à la CI ; rafraîchir le step « Content Studio unit tests » | `04-tests` §5 |
| P3-4 | Audit log : publish-now/schedule, reschedule, cancel, retry, publication réussie | `05-erreurs` §3 |
| P3-5 | Brancher enfin le scheduler (BUG-003) : crontab → `social-publish-scheduler` avec `CRON_SECRET` — **uniquement après P1-1/P1-2** (le garde-fou historique anti-double-publication devient levable) | `07-historique` §2 |
| P3-6 | Dette : extinction du pipeline Postiz legacy (sunset 08/2026), gating flag sur create/library, purge du code mort UI, zod `.parse()`→`safeParse` sur reject/cancel | `03-backend` §8, `02-interface-ux` |

## Hors plan (décisions produit à re-trancher)

- **ADR-0007** : convergence pipeline A (LangGraph) vs voie médiane actuelle — à re-trancher après le merge.
- **Higgsfield live (BUG-002)** : bloqué sur le credential `KEY_ID:KEY_SECRET` complet (jamais fourni — ne pas le chercher dans l'environnement, le demander).
- **Publication live Postiz** : exiger P1 complet + un test contrôlé en `publishMode:'draft'` sur un compte dédié avant tout post public réel.
- **Où faire revivre le studio** : staging (nouveau port + vhost) vs prod (flags actuellement absents du `.env` prod) — décision d'exploitation, hors périmètre de cet audit.
