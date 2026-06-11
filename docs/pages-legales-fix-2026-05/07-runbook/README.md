# 07 — Runbook d'exécution

## Fichiers

| Fichier | Contenu |
|---|---|
| [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) | Suite linéaire J+0 → J+7 |
| [`verifications-staging.md`](./verifications-staging.md) | Commandes vérif staging |
| [`deploiement-prod.md`](./deploiement-prod.md) | Procédure ship prod sécurisée |

## Cheat sheet

```bash
# Démarrer dev
pnpm dev

# Tests
pnpm vitest run                              # tous
pnpm vitest run src/lib/legal/               # legal
pnpm playwright test --grep @legal-purity   # E2E

# Migration DB
pnpm db:migrate-safe

# Smoke
pnpm tsx scripts/smoke-legal-purity.ts --url <url>

# Anonymisation grep
grep -ri "souheila\|souheïla" src/app/(marketing)/

# Audit drift
psql $DATABASE_URL -c "<query §3 audit-queries.md>"
```

## Setup machine local pré-requis

```bash
# Node 20+
nvm use 20

# pnpm 9+
pnpm -v

# Env vars
grep -E "DATABASE_URL|ADMIN_BOOTSTRAP|LEGAL_VARS_V2" apps/web/.env

# Branche à jour
git fetch origin
git checkout master && git pull
```
