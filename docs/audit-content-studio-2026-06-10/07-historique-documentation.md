# 07 — Historique du projet & état de la documentation

## 1. Chronologie (reconstituée depuis git + docs, toutes branches)

| Date | Étape | Commits / docs |
|---|---|---|
| 2026-05-14 | **Cadrage** « AI Content Studio » (conception, 0 code) | `docs/ai-content-studio/` |
| 2026-05-17 | **Content Studio v1** : service layer, state machine, Postiz bridge, image gen, budget/idempotence, hardening P3 | `61de3cf5` → `04d9d19a` ; `docs/content-studio/p3-plan/` |
| 2026-05-19/20 | **Publication directe Postiz** : adapter, scheduler worker, publication staging | `f4e6506f`, `2742d2fc`, `3e0ee55c` |
| 2026-05-21/22 | Modes publish (now/schedule/draft), alerts, dashboard | `3ec0ec99` … `afc09b0e` |
| 2026-05-22 | **Content Studio v2 UI** complet (shell, /home, /library, /create 4 étapes, /plan, ⌘K) sous flag | `c8208730` → `22bf2ddc` ; **← divergence master/branches ICI** |
| 2026-05-24 | Tests + bugfixes v2 (433 tests RTL, 11 bugs) — *hors master* | `e034eedc` … `9bf29e42` |
| 2026-05-25 | **AI-Engine LangGraph** : MVP → V1 (16 nœuds, RAG, trends) → V2 (Postiz, knowledge UI, jobs) → bridge Content Studio, HITL ; batteries 678 + 622 tests | `96a24b90`, `17bcd200`, `aa65fcdf`, `b244e918`, `435712a6` (branche `feat/ai-engine-langgraph-mvp`) |
| 2026-05-28 | **Audit `/create` v2** (19 features F01-F19) | `docs/content-studio-v2-create-audit/` (backup uniquement) |
| 2026-05-29 | **Audit gelé génération+publication** : 68 findings, 4 blockers, plan 67 actions, ADR-0001→0007 | `c29d3c20` |
| 2026-05-29/30 | **Exécution du plan** (branche `feat/exec-gen-pub-plan`) : ~30 commits ACT-*/BUG-* — exit-1 vitest corrigé, credential OpenAI unifié (`83e55146`), picker honnête, migration MSW, state.errors | |
| 2026-05-30 | Merge dans le master local de l'époque (`deecc53e`) puis **plan média + exécution P0→P4 le même jour** : bundle backbone + migrations 0064/0065 (`f42f004c`), voix-off (`04f11d60`), sous-titres (`f3bb16fc`), compose (`00fcb116`), UI MediaStudioTracks (`04842ee2`), VO éditable (`cfde5ece`) ; e2e golden path (`0765b46f`, 3 passed contre staging vivant) | `docs/plan-media-production-2026-05-30/` |
| 2026-06-01 | Gel de la lignée dans `backup-staging-2026-06-01` (HEAD `f15ebe68`) puis `git reset --hard origin/master` (réconciliation demandée) | |
| 2026-06-02→10 | :8012 réattribué à corolle-reviews ; staging arrêté ; master ne reçoit que du tracking/Meta — **le studio y est figé au 22 mai** | `c55add4b` |

## 2. L'audit gelé du 2026-05-29 (visible uniquement sur backup)

**Verdict de l'époque** : « générer → publier » non fonctionnel bout-en-bout en live ; seul le mock marche ; le signal de test ment (1695 passed mais EXIT 1).

**Compteurs** (`bug-register.csv`) : **4 blocker · 8 critical · 35 major · 18 minor · 3 info** ; 56 confirmed, 12 adjusted ; 2 réfutés par contre-exécution (BUG-012/013 ffmpeg lavfi). Gap-matrix live : 27 `broken`, 20 `untested`, 2 `works`.

**Statut final des 4 blockers (état 2026-06-10) :**

| Blocker | Cause | Statut |
|---|---|---|
| **BUG-001** — image live cassée | Split env-var : le flux lit `CONTENT_STUDIO_OPENAI_API_KEY` (vide) alors qu'`OPENAI_API_KEY` valide existe dans l'environnement | ✅ Corrigé sur backup (`83e55146`, `provider-credentials.ts`) · ❌ **toujours cassé sur master** (vérifié dans le code) |
| **BUG-002** — vidéo live Higgsfield | Credential `KEY_ID:KEY_SECRET` incomplet + host/endpoints faux | ⚠️ Partiel sur backup (auth `platform.higgsfield.ai` + submit/poll réécrits) ; **jamais validé live** (secret jamais fourni) · absent de master |
| **BUG-003** — publication programmée jamais exécutée | Route scheduler branchée à aucun cron (self-hosted : vercel.json non honoré) | ❌ **Jamais corrigé sur aucune lignée** — garde-fou volontaire du runbook (risque doubles publications tant que cancel/reschedule ne purgent pas les jobs) jamais levé |
| **BUG-004** — voix-off/musique/sous-titres/montage inaccessibles | Deux pipelines (A LangGraph / B create-flow), pont unidirectionnel avec perte | ✅ Corrigé sur backup (plan média P0→P4 + e2e) · invisible sur master |

## 3. Inventaire documentaire : où sont les documents ?

**Visibles sur master (working tree)** — tous antérieurs au 23 mai, donc **périmés** par rapport au travail réel :
- `docs/ai-content-studio/` (14/05, cadrage — supersédé par l'implémentation)
- `docs/content-studio/p3-plan/` (17/05, exécuté)
- `docs/ai-content-service/` (19→22/05 : concept, publication directe, plan v2 — exécutés)

**Uniquement sur `backup-staging-2026-06-01`** (invisibles du working tree actuel) :
- `docs/content-studio-v2-create-audit/` (28/05)
- `docs/audit-generation-publication-2026-05-29/` (baseline gelée : 68 findings, SHA256SUMS, plan, runbook)
- `docs/plan-media-production-2026-05-30/` (83 fichiers, design BUG-004)
- findings et batteries de tests ai-engine

**Contradiction active** : les documents visibles décrivent un système que le code master reflète encore (v2 du 22/05, BUG-001/003 présents) ; tout ce qui documente et corrige les blockers vit sur le backup. Quiconque audite ou développe depuis le working tree actuel **ne peut pas savoir** que ces audits/corrections existent. Détail piquant : `execution-checklist.csv` du plan média est resté 78×`todo` alors que les phases ont été exécutées et commitées — la preuve d'exécution est dans les commits, pas dans le doc (leçon : tenir les checklists ou les générer depuis git).

## 4. Décisions d'architecture (ADR) et application réelle

| ADR | Décision | Application |
|---|---|---|
| 0001 | Baseline d'audit figée datée | ✅ (dossier gelé, SHA256SUMS) |
| 0002 | La vérité = comportement réel exécuté, pas les tests verts | ✅ méthode appliquée (2 findings réfutés par contre-exécution) |
| 0003 | Harnais parité mock/live MSW | ⚠️ partiel (12 fichiers migrés, flip global `onUnhandledRequest:'error'` repoussé — chantier multi-session documenté) |
| 0004 | Résolution unifiée des clés OpenAI | ✅ backup / ❌ master |
| 0005 | Déclencheur cron self-hosted pour le scheduler | ❌ jamais appliqué (BUG-003) |
| 0006 | Higgsfield async submit+poll | ⚠️ codé, jamais validé live (credential) |
| 0007 | Frontière pipelines A/B — l'utilisateur avait choisi l'Option 1 (convergence vers A/LangGraph) | ⚠️ arbitré **de facto en voie médiane** par le plan média : B reste le pipeline opérateur mais réutilise les nœuds de A via DTO/bridge étendus. La convergence complète n'a pas eu lieu. |
| D1–D6 (plan média) | Bundle d'assets par rôle, DTO étendu, services per-draft, panneau Studio média, réutilisation, additif+flag | ✅ appliqués par P0→P4 (backup) |

## 5. Leçons institutionnalisées (à conserver)

1. **Tests verts ≠ système fonctionnel** : vérifier le code de sortie, exercer le comportement réel, tester mock ET live. (A produit le gate `tsc --noEmit` en CI — appliqué.)
2. **Build/restart ≠ migrate** : les migrations doivent être exécutées explicitement (`scripts/_migrate-safe.mjs`) — l'oubli a déjà produit un 42703 en staging.
3. **Après `pm2 restart`, vérifier l'orphelin** : un `next-server` orphelin a déjà servi du code périmé sur :8012 pendant que PM2 crash-loopait (585 restarts silencieux).
4. **Le runner de migrations tracke par hash** : éditer une migration appliquée la ré-applique.
5. **Jamais de `crontab -l` en command-substitution sous `set -u`** dans ce harness (a déjà effacé un crontab) — installer via fichier explicite complet.
