# 07 — Runbook d'exécution

Runbook opérationnel pour exécuter le plan d'action étape par étape.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) | Suite linéaire d'instructions J+0 → J+7 |
| [`verifications-staging.md`](./verifications-staging.md) | Commandes de vérification staging |
| [`deploiement-prod.md`](./deploiement-prod.md) | Procédure ship prod détaillée |

## Conventions du runbook

- **Format** : chaque commande prête à copier-coller dans le terminal
- **Vérifications** : sortie attendue de chaque commande explicitée
- **Env** : variables d'env documentées
- **Rollback** : pointeur vers `06-plan-action/rollback.md` à chaque étape risquée

## Setup machine local pré-requis

Avant de commencer :

```bash
# 1. Node 20+ activé (cf. .nvmrc à créer si absent)
node -v  # doit afficher v20.x ou v22.x
nvm use 20  # si nvm

# 2. pnpm 9+
pnpm -v  # doit afficher 9.x

# 3. Variables env locales
cd apps/web
cat .env | grep -E "DATABASE_URL|ADMIN|CHAT"

# 4. DB locale accessible
psql $DATABASE_URL -c "SELECT 1"

# 5. Branche à jour
git fetch origin
git checkout master
git pull
```

## Cheat sheet commandes critiques

```bash
# Démarrer dev server
pnpm dev

# Tests
pnpm vitest run                # tous
pnpm vitest run path/to/file   # un fichier
pnpm vitest watch              # mode watch

# Playwright
pnpm playwright test                       # tous
pnpm playwright test --grep @chat-purity  # tags spécifiques
pnpm playwright test --ui                  # mode interactif

# Type check + lint
pnpm typecheck
pnpm lint

# Drizzle
pnpm drizzle-kit generate --name <name>
pnpm drizzle-kit migrate
pnpm drizzle-kit check

# Smoke
pnpm tsx scripts/smoke-chat-purity.ts
```
