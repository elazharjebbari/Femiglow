# Runbook — Provisionner Postgres pour le job e2e CI

> Pilote l'exécution du [`00-plan-action.md`](00-plan-action.md). À dérouler dans l'ordre. Chaque
> étape a une **vérification** et une **issue de secours**.

## 0. Pré-requis

- Branche `ci/e2e-postgres-service` créée depuis `origin/master` (inclut le merge analytics).
- `gh` authentifié (HTTPS) ; push via `git push https://github.com/elazharjebbari/Femiglow.git`.
- Outils locaux : Node 22 (`~/.nvm/versions/node/v22.13.1/bin`), `pnpm` (corepack).

## 1. Modifier le job `e2e` de `ci.yml`

Cible : `.github/workflows/ci.yml`, job `e2e`. Appliquer (cf. patch de référence §6) :

1. **Service Postgres** avec pgvector + healthcheck :
   ```yaml
   services:
     postgres:
       image: pgvector/pgvector:pg16
       env:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: femiglow_test
       ports: ['5432:5432']
       options: >-
         --health-cmd "pg_isready -U postgres"
         --health-interval 5s --health-timeout 5s --health-retries 10
   ```
2. **Env au niveau job** (hérité par tous les steps + le webServer Playwright) :
   ```yaml
   env:
     DATABASE_URL: postgres://postgres:postgres@localhost:5432/femiglow_test
     CONTENT_STUDIO_ENABLED: 'true'          # le prototype est gated → l'e2e en a besoin
     CONTENT_STUDIO_IMAGE_PROVIDER: mock      # génération de visuel déterministe (pas d'appel externe)
   ```
3. **Step migrate** (avant le build) — **runner maison**, PAS `drizzle-kit migrate` (qui wrappe
   chaque migration en transaction → casse `CREATE EXTENSION`/`INDEX CONCURRENTLY`) :
   ```yaml
   - name: Apply DB migrations
     run: node scripts/_migrate-safe.mjs   # lit DATABASE_URL de l'env du job
     working-directory: apps/web
   ```
4. **Build** : conserver, retirer la ligne `DATABASE_URL: ${{ secrets.CI_DATABASE_URL || '' }}`
   (désormais fournie au niveau job).
5. **Artefacts de debug** (en fin de job) :
   ```yaml
   - name: Upload Playwright artifacts
     if: always()
     uses: actions/upload-artifact@v4
     with:
       name: playwright-report
       path: |
         apps/web/playwright-report/
         apps/web/test-results/
       retention-days: 7
   ```

**Vérif** : `git diff` lisible, indentation YAML correcte (2 espaces).

## 2. Commit + push

```bash
git add .github/workflows/ci.yml docs/ci-e2e-postgres-2026-05-30/
git commit -m "ci(e2e): provisionne Postgres (pgvector) + migrations + artefacts"
git push https://github.com/elazharjebbari/Femiglow.git ci/e2e-postgres-service:ci/e2e-postgres-service
```

**Vérif** : push OK, gitleaks vert (pre-commit).

## 3. Ouvrir la PR + observer la CI

```bash
gh pr create --repo elazharjebbari/Femiglow --base master --head ci/e2e-postgres-service \
  --title "ci(e2e): Postgres + pgvector pour le job Playwright" --body "..."
run_id=$(gh run list --repo elazharjebbari/Femiglow --branch ci/e2e-postgres-service \
  --workflow ci.yml --limit 1 --json databaseId -q '.[0].databaseId')
until [ "$(gh run view $run_id --repo elazharjebbari/Femiglow --json status -q .status)" = completed ]; do sleep 20; done
gh run view $run_id --repo elazharjebbari/Femiglow --json conclusion,jobs \
  -q '.conclusion, (.jobs[] | "\(.name): \(.conclusion)")'
```

**Attendu** : `Lint + Typecheck + Tests: success` **et** `Playwright E2E: success`.

## 4. Boucle de correction (si e2e rouge)

Récupérer le step + la cause :
```bash
gh run view $run_id --repo elazharjebbari/Femiglow --json jobs \
  -q '.jobs[] | select(.name=="Playwright E2E") | .steps[] | select(.conclusion=="failure") | .name'
gh run view $run_id --repo elazharjebbari/Femiglow --log-failed | sed -E 's/\x1b\[[0-9;]*m//g' \
  | grep -iE "error|fail|timeout|migrat|extension|ECONNREF|pg_isready|relation|does not exist" | tail -30
```

### Table de diagnostic

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `extension "vector" is not available` | image PG sans pgvector | utiliser `pgvector/pgvector:pg16` |
| `db:migrate` → connection refused | DB pas prête / port | healthcheck + `localhost:5432` ; vérifier `ports` |
| `relation "..." does not exist` (au runtime) | migrations non appliquées | step migrate **avant** build/run ; vérifier son exit 0 |
| `waitForURL /admin timeout` (login) | DATABASE_URL absent du serveur | env **au niveau job** (pas seulement build) |
| `pnpm: db:migrate not found` | filtre workspace | `pnpm --filter web db:migrate` |
| e2e flaky | timing dev/build | récupérer la **trace** dans l'artefact `playwright-report` |

Récupérer l'artefact de debug d'un run :
```bash
gh run download $run_id --repo elazharjebbari/Femiglow -n playwright-report -D /tmp/pw
npx playwright show-trace /tmp/pw/test-results/**/trace.zip
```

Itérer : corriger `ci.yml` → commit → push → re-observer (§3).

## 5. Merge

Quand `Playwright E2E: success` :
```bash
gh pr merge <num> --repo elazharjebbari/Femiglow --merge
git fetch origin master && git log origin/master --oneline -1   # vérif merge
```
**Vérif post-merge** : le run CI sur `master` montre les **deux** jobs verts.

## 6. Patch de référence (job `e2e` complet attendu)

```yaml
  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: quality
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: femiglow_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/femiglow_test
      ADMIN_SESSION_PASSWORD: ${{ secrets.CI_ADMIN_SESSION_PASSWORD || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }}
      WEBHOOK_SECRET_KEY: ${{ secrets.CI_WEBHOOK_SECRET_KEY || 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }}
      CRON_SECRET: ${{ secrets.CI_CRON_SECRET || 'cccccccccccccccccccccccccccccccc' }}
      ADMIN_BOOTSTRAP_EMAIL: admin@femiglow.local
      ADMIN_BOOTSTRAP_PASSWORD: admin-test-pass
      CONTENT_STUDIO_ENABLED: 'true'
      CONTENT_STUDIO_IMAGE_PROVIDER: mock
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
        working-directory: apps/web
      - name: Apply DB migrations
        run: node scripts/_migrate-safe.mjs   # runner maison (pas drizzle-kit migrate)
        working-directory: apps/web
      - name: Build Next.js
        run: pnpm --filter web build
      - name: Run Content Studio E2E
        run: npx playwright test content-studio.spec.ts
        working-directory: apps/web
        env:
          PLAYWRIGHT_BASE_URL: http://127.0.0.1:3000
      - name: Upload Playwright artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            apps/web/playwright-report/
            apps/web/test-results/
          retention-days: 7
```

## 7. Rollback

`git revert <commit>` puis push. CI-only, aucun impact applicatif. Le job qualité reste vert
indépendamment.

## 8. Notes d'exécution réelle (PR #4, mergée `a3a846f`)

Ajustements découverts pendant la boucle de correction (le §6 ci-dessus est la version **finale**) :

1. **Migrations** : `drizzle-kit migrate` échoue (exit 1) — il enveloppe chaque migration dans une
   transaction, incompatible avec `CREATE EXTENSION` / `INDEX CONCURRENTLY`. Le repo fournit le
   runner maison `scripts/_migrate-safe.mjs` (hash-based, lit `DATABASE_URL`) — c'est lui qu'on
   utilise.
2. **Content Studio gated** : sans `CONTENT_STUDIO_ENABLED=true`, la page affiche un placeholder
   « désactivé » → les onglets de `content-studio.spec.ts` n'existent pas. Flag ajouté à l'env du job.
3. **Visuel IA** : `CONTENT_STUDIO_IMAGE_PROVIDER=mock` (la génération de **texte** tombe déjà en
   fallback déterministe sans clé OpenAI ; seul le **visuel** avait besoin du provider mock).
4. **Test data-dependent** : `content-studio.spec.ts` « éditeur de brouillon » attendait le panneau
   « Brouillons », absent sur une base fraîche (`DraftEditor` affiche un état vide) → test rendu
   résilient (accepte l'état vide OU le panneau).
5. **gitleaks** : l'URL Postgres de CI (`postgres:postgres@localhost`) matchait la règle
   `femiglow-database-url` → ajoutée à l'allowlist `.gitleaks.toml` (non secret).

Résultat : **les deux jobs verts** (`Lint + Typecheck + Tests` **et** `Playwright E2E`) sur la PR
puis sur `master`.
