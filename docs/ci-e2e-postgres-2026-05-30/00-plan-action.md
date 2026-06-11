# Plan d'action — Provisionner Postgres pour le job e2e CI

> Date : 2026-05-30 · Branche : `ci/e2e-postgres-service` · Workflow : `.github/workflows/ci.yml`
> But : rendre le job **Playwright E2E** vert en lui fournissant une vraie base Postgres (+ pgvector),
> de façon **maintenable, modulaire, robuste, débuggable, optimale et évolutive**.

## 1. Problème (constat)

Le job `e2e` (`needs: quality`) ne tournait jamais (masqué par la CI cassée). Une fois le job
qualité réparé, il s'exécute et **échoue au `global.setup` Playwright** :

```
[setup] authenticate as admin → page.waitForURL timeout (reste sur /admin/login)
```

Cause racine : **`DATABASE_URL` est vide en CI** (pas de secret `CI_DATABASE_URL`) → l'app tombe en
`memoryStore` → le compte admin bootstrappé et la session iron-session ne survivent pas au build
`next start` / multi-requêtes → le login ne redirige jamais hors de `/admin/login`.

## 2. Objectif & critères de succès (Definition of Done)

- Le job **Playwright E2E** passe (vert) sur la PR puis sur `master`.
- Le job utilise une **vraie base Postgres éphémère** avec l'extension **pgvector** (requise par les
  migrations chat : `CREATE EXTENSION "vector"`, cf. `0012_chat_init.sql`, `0036_chat_v5_v6_tables.sql`).
- Les **74 migrations** sont appliquées avant le démarrage de l'app.
- En cas d'échec, on dispose d'**artefacts de debug** (rapport HTML + traces Playwright).
- Aucune régression du job qualité ni des autres workflows.

## 3. Conception cible

### 3.1 Architecture du job e2e

```
job e2e (needs: quality)
├── services.postgres : image pgvector/pgvector:pg16 (pgvector + pgcrypto inclus)
│     healthcheck pg_isready → le job attend que la DB soit prête
├── env (job-level) : DATABASE_URL = postgres://postgres:postgres@localhost:5432/femiglow_test
│     + ADMIN_* / secrets de session
├── checkout → pnpm setup → setup-node (cache pnpm)
├── pnpm install --frozen-lockfile
├── Playwright install chromium --with-deps
├── DB migrate :  pnpm --filter web db:migrate   (drizzle-kit migrate, lit DATABASE_URL)
├── Build Next.js (DATABASE_URL présent)
├── Run e2e : npx playwright test content-studio.spec.ts
│     (webServer `pnpm start` démarré par Playwright hérite de DATABASE_URL)
└── always() : upload-artifact (playwright-report/ + test-results/)  ← debuggabilité
```

### 3.2 Pourquoi `pgvector/pgvector:pg16`

`postgres:16` standard n'a pas l'extension `vector` → la migration `CREATE EXTENSION "vector"`
échouerait. L'image officielle `pgvector/pgvector:pg16` embarque pgvector et `pgcrypto` (built-in),
les deux seules extensions requises. Choix **robuste** (pas de compilation d'extension à la volée).

### 3.3 Migrations : `db:migrate` (drizzle-kit migrate)

`drizzle-kit migrate` lit `process.env.DATABASE_URL` (cf. `drizzle.config.ts`) et applique les
migrations en attente, idempotent (table `__drizzle_migrations`). On évite `db:migrate-safe`
(`--env-file=.env`, absent en CI).

## 4. Principes qualité → choix concrets

| Principe | Traduction concrète |
|---|---|
| **Maintenable** | `DATABASE_URL` et le nom de base centralisés en **env de job** (une seule source), steps nommés explicitement. |
| **Modulaire** | DB en **service container** isolé (pas de DB partagée) ; migration en **step dédié** réutilisable ; possibilité d'extraire une *composite action* plus tard. |
| **Robuste** | **healthcheck** Postgres (le job attend `pg_isready`) ; `--frozen-lockfile` ; image à version épinglée ; migrations idempotentes. |
| **Débuggable** | upload des **artefacts Playwright** (rapport HTML + traces + screenshots) en `always()` ; steps atomiques pour localiser l'échec ; `name:` parlants. |
| **Fonctionnel** | l'admin se bootstrappe sur une **vraie DB** → session persistée → e2e passe réellement. |
| **Optimal** | cache pnpm (déjà via `setup-node cache: pnpm`) ; `playwright install chromium` (un seul navigateur) ; service DB léger et éphémère. |
| **Évolutif** | base/URL paramétrées par env (changer la version PG = 1 ligne) ; ajouter des specs e2e = élargir le glob ; structure prête pour une matrice (chromium/firefox) ou un `services` partagé. |

## 5. Phases d'exécution

| Phase | Action | Vérif |
|---|---|---|
| **P1** | Modifier `ci.yml` job `e2e` : service postgres + env DATABASE_URL + step migrate + artefacts | lint YAML / relecture |
| **P2** | Pousser sur `ci/e2e-postgres-service`, ouvrir PR | PR créée |
| **P3** | Observer le run CI ; le job qualité reste vert, le job e2e doit passer | `gh run watch` |
| **P4** | Boucle de correction si échec (migration, healthcheck, env) — cf. runbook §Debug | e2e vert |
| **P5** | Merger dans `master` | master e2e vert |

## 6. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Extension `vector` absente | image `pgvector/pgvector:pg16` |
| DB pas prête au moment du migrate | healthcheck `pg_isready` sur le service |
| `db:migrate` échoue sur une migration | step dédié → log isolé ; artefacts ; rollback = revert du commit |
| `pnpm start` ne voit pas `DATABASE_URL` | env **au niveau job** (hérité par tous les steps + le webServer Playwright) |
| Build Next nécessite la DB | `DATABASE_URL` présent dès le build |
| Flakiness e2e | `retries` Playwright (config) + artefacts pour diagnostic |

## 7. Rollback

Le changement est **isolé au job `e2e` de `ci.yml`**. Rollback = `git revert` du commit. Le job
qualité (la vraie validation) n'est pas touché ; aucun impact applicatif (CI-only).

→ Exécution détaillée : [`01-runbook.md`](01-runbook.md).
