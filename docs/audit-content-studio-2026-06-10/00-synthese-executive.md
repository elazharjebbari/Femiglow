# Audit complet — Studio de création de contenu (Content Studio)

**Date : 2026-06-10 · Périmètre : code (master `c55add4b` + branche `backup-staging-2026-06-01`), interface, backend, tests, infra, documentation · Méthode : 5 inspections parallèles (frontend, backend, tests, delta git, historique docs) + vérifications empiriques (DB, cron, processus serveur)**

## Sommaire du dossier

| Fichier | Contenu |
|---|---|
| `00-synthese-executive.md` | Ce document — verdict, top findings, notation par dimension |
| `01-etat-des-lieux.md` | Infra/runtime, branches git, dérive base de données (vérifiée), cron cassé |
| `02-interface-ux.md` | Audit de l'interface : flux opérateur, ergonomie, accessibilité, code mort |
| `03-backend-fonctionnement.md` | Services, machine à états, publication, génération, données |
| `04-tests-couverture.md` | Résultats d'exécution réels, qualité des tests, trous de couverture, CI |
| `05-erreurs-robustesse.md` | Erreurs bien gérées vs mal gérées, observabilité, debuggabilité |
| `06-securite.md` | Auth, surface d'attaque, secrets, validation |
| `07-historique-documentation.md` | Chronologie du projet, audits passés, ADR et leur application réelle |
| `08-delta-branche-backup.md` | Le travail orphelin sur `backup-staging-2026-06-01` et ce qui serait perdu |
| `09-fragilites-ameliorations.md` | Bilan par dimension demandée (modularité, évolutivité, robustesse…) |
| `10-plan-action.md` | Plan d'action priorisé P0→P3 |

---

## Verdict en une phrase

Le Content Studio est un système **ambitieux, bien architecturé par endroits (pipeline de publication, validation, auth), mais aujourd'hui en état de schisme** : la branche qui contient 9 jours de corrections et de fonctionnalités majeures (AI-Engine LangGraph, voix-off/sous-titres/montage, déblocage OpenAI live) n'est mergée nulle part, le `master` actuel est revenu à l'état du 22 mai avec des bugs déjà corrigés ailleurs réintroduits, **la base de données staging est en avance sur le code** (régression active vérifiée), et **plus aucune instance du studio ne tourne** (staging arrêté, port réattribué à un autre projet ; studio désactivé en prod).

## Les 10 constats majeurs (toutes sources confondues)

| # | Sévérité | Constat | Détail |
|---|---|---|---|
| 1 | **Bloquant** | **Schisme de branches** : 77 commits (AI-Engine, média P0–P5, correctifs d'audit, ~60 specs e2e) vivent uniquement sur `backup-staging-2026-06-01`, jamais poussée sur origin. Master est revenu au studio du 2026-05-22. | `08-delta-branche-backup.md` |
| 2 | **Bloquant** | **Dérive DB > code (vérifiée le 2026-06-10)** : la base staging a été migrée (0064/0065) par la branche backup — les bindings sont `primary_image`/`primary_video`, le code master requête `role='primary'` → **0 asset visible** pour le code actuellement checkouté. | `01-etat-des-lieux.md` §3 |
| 3 | **Bloquant** | **Aucune instance ne tourne** : l'app staging est arrêtée, le port :8012 a été réattribué à `corolle-reviews` (gunicorn). En prod (:8011), les flags `CONTENT_STUDIO_*` sont absents → studio 403. L'interface est donc invérifiable et inutilisable aujourd'hui. | `01-etat-des-lieux.md` §1 |
| 4 | **Bloquant** | **`/create` ne charge jamais aucune donnée** (master) : la page rend `CreateWorkspace` sans props et le provider saute le fetch de montage → drafts/médias vides à jamais, flow mort après l'étape 1. Pas de déclencheur UI pour la génération de variantes texte. Liens Library → `create/[draftId]` = 404 (route inexistante). | `02-interface-ux.md` §2-3 |
| 5 | **Bloquant** | **Annuler/replanifier un post ne touche pas les jobs de publication** : un `social_publish_job` queued reste exécutable par le cron après annulation (publication réelle d'un post annulé en mode live) ; replanifier ×2 crée 2 jobs → double publication. | `03-backend-fonctionnement.md` §4 |
| 6 | **Critique** | **Pas de kill-switch global dry_run/live** sur master : la sélection de compte par défaut peut retomber sur un compte Postiz réel si le compte dry_run manque. (Le flag `SOCIAL_PUBLISHING_MODE` n'existe que sur la branche backup.) | `03-backend-fonctionnemen​t.md` §4, `06-securite.md` |
| 7 | **Critique** | **Aucune transaction DB** sur les opérations multi-écritures (génération = 6+ écritures, approbation, exécution de job, upsert d'asset en delete+insert). | `03-backend-fonctionnement.md` §7 |
| 8 | **Critique** | **BUG-001 et BUG-003 de l'audit gelé du 2026-05-29 sont de nouveau/toujours présents sur master** : génération image live cassée (split env-var, corrigé seulement sur backup) ; publication programmée jamais branchée à aucun cron (jamais corrigé sur aucune lignée). | `07-historique-documentation.md` §2 |
| 9 | **Majeur** | **Le cron quotidien media-optimize (03:15) échoue chaque nuit depuis le 02/06** : le script `media-optimize-tick.sh` a disparu du working tree avec le reset sur origin/master (il n'existe que sur backup). Vérifié dans `/var/log/femiglow-media-optimize.log`. | `01-etat-des-lieux.md` §4 |
| 10 | **Majeur** | **Trous de tests sur les chemins les plus risqués** : `generation.ts` (texte OpenAI) zéro test, `budget.ts` testé via une copie réécrite dans le test (auto-validant), mode live jamais testé, payload vidéo jamais asserté, les 2 seules specs e2e qui vérifient Postgres ne tournent pas en CI. | `04-tests-couverture.md` |

## Notation par dimension (échelle A–E)

| Dimension | Note | Justification courte |
|---|---|---|
| **Fonctionnel (aujourd'hui)** | **E** | Aucune instance ne tourne ; sur master le flow create est mort après l'étape 1 ; la DB est incompatible avec le code checkouté. Sur backup (état du 01/06), le flow complet était démontré par e2e. |
| **Robustesse** | **D** | Pipeline de publication bien verrouillé (idempotence, lock atomique, contraintes uniques) mais : 0 transaction DB, jobs zombies sans reaper, cancel/reschedule ne purgent pas les jobs, double-clic coûteux non protégé sur la génération. |
| **Sécurité** | **C+** | 36/36 routes authentifiées, zod `.strict()`, pas de fuite de stack, redaction des secrets. Mais : bypass cron par header `x-vercel-cron` spoofable hors Vercel, pas de kill-switch live, flag legacy contournable par API directe. |
| **Modularité** | **B−** | Découpage frontend sain (médiane ~160 l/fichier), primitives réutilisées. Mais double pipeline Postiz (legacy + v2), repository dual drizzle/mémoire dupliqué à 100 %, styles inline + injection `document.head`. |
| **Évolutivité** | **D** | Le schisme de branches est LE frein : toute évolution part d'une base qui ignore 9 jours de travail et un schéma DB déjà migré. Deux pipelines de génération (A LangGraph / B create-flow) avec un pont unidirectionnel. |
| **Maintenabilité** | **C** | Zéro TODO/FIXME, conventions cohérentes, erreurs uniformisées. Mais code mort significatif côté UI (états inatteignables, props jamais passées, boutons inertes), docs d'audit invisibles du working tree. |
| **Déboggabilité** | **C+** | Excellente sur la publication (events, attempts redactés, lastError structuré, digest). Trou noir sur la génération : un échec image live = 500 « Erreur interne » sans run `failed` enregistré. Audit log lacunaire (reject/cancel/reschedule/publish non audités). |
| **Optimalité** | **C** | Budget vérifié avant dépense mais estimations 3× sous le coût réel ; `getDailySpentCents` charge 1000 lignes en JS ; bindings chargés intégralement puis filtrés ; picker média plafonné à 100. Rien de grave au volume actuel. |
| **Ergonomie / usage** | **D+** | Bonnes fondations (toasts systématiques, optimistic updates avec rollback, estimateur p50/p95, a11y au-dessus de la moyenne) mais : faux succès (« Programmer » en bulk = no-op), boutons morts (⌘K, notifications), pas d'approve dans le workspace create (opérateur bloqué sans issue), vidéo sans contrôles ni métadonnées, double-clic « éditer » non découvrable. |
| **Tests** | **C+** | 428 tests verts EXIT 0 sur le périmètre, adapters Postiz exemplaires, e2e DB-assertives. Mais les trous sont exactement sur les chemins critiques (texte live, budget, live publishing, vidéo) et la CI n'exécute qu'1 spec e2e studio sur 7. |

## Ce qui est effectivement robuste (à préserver)

- **Pipeline `social_publish_job`** : clé d'idempotence unique, verrou atomique `UPDATE … WHERE lockedAt IS NULL … RETURNING`, contraintes uniques `(provider, remoteId)`, events + attempts persistés et redactés. Le double-clic « Publier maintenant » est réellement protégé.
- **Auth systématique** : les 36 routes `/api/admin/content-studio/**` passent par `requireAdminApi()` (vérifié exhaustivement).
- **Validation** : zod `.strict()` avec bornes sur quasi tous les payloads.
- **Gestion d'erreurs HTTP** : `formatErrorResponse` uniforme, aucune fuite de stack, taxonomie provider Postiz (401→token_expired, 429→retryable…).
- **Frontend** : aucune erreur fetch avalée (toasts/inline partout), optimistic updates avec rollback (calendrier DnD, archivage), estimateur de génération p50/p95 persisté et testé.
- **Budget** : vérifié AVANT la dépense (texte et visuel).

## Décision structurante à prendre (avant toute correction)

Tout le plan d'action (`10-plan-action.md`) découle d'un choix unique : **que faire de `backup-staging-2026-06-01` ?** Le merge vers master est mécaniquement facile (5 conflits seulement, aucun dans le code applicatif studio — mesuré par `git merge-tree`), et c'est la seule voie qui réconcilie le code avec la base de données déjà migrée. L'alternative (rester sur master) impose de ré-écrire des migrations de réparation DB et de re-corriger des bugs déjà corrigés. Recommandation ferme : **pousser la branche backup sur origin immédiatement (sauvegarde), puis merger backup→master**.
