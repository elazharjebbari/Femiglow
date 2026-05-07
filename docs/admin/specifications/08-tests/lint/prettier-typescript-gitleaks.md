# Prettier, TypeScript, Gitleaks

## Prettier

`apps/web/.prettierrc.json` :

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`.prettierignore` :

```
.next
node_modules
coverage
playwright-report
test-results
pnpm-lock.yaml
*.min.js
*.min.css
```

Hook pre-commit (via Husky + lint-staged) :

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,md,css}": ["prettier --write", "eslint --fix"]
  }
}
```

## TypeScript

`apps/web/tsconfig.json` :

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,

    // Strict supplémentaire
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Pourquoi ces options strictes

| Option | Valeur ajoutée |
|---|---|
| `noUncheckedIndexedAccess` | `arr[0]` est `T \| undefined` — force la vérification |
| `exactOptionalPropertyTypes` | `{ x?: number }` n'accepte pas `{ x: undefined }` — cohérence |
| `noUnusedLocals` / `noUnusedParameters` | hygiène |
| `noImplicitReturns` | toutes les branches doivent return |

### Exécution

```bash
pnpm typecheck         # tsc --noEmit
pnpm typecheck:watch   # mode watch en dev
```

## Gitleaks

`.gitleaks.toml` (à la racine du repo) :

```toml
title = "FemiGlow gitleaks config"

[allowlist]
description = "Allowlist for known false positives"
paths = [
  "pnpm-lock.yaml",
  "tests/fixtures/.+",
  "docs/admin/specifications/05-backend/api-openapi.yaml",
]

[[rules]]
id = "femiglow-session-password"
description = "iron-session password"
regex = '''ADMIN_SESSION_PASSWORD\s*=\s*['"]?[A-Za-z0-9+/=]{20,}'''
tags = ["secret"]

[[rules]]
id = "femiglow-webhook-key"
description = "Webhook encryption key"
regex = '''WEBHOOK_SECRET_KEY\s*=\s*['"]?[A-Za-z0-9+/=]{20,}'''
tags = ["secret"]

[[rules]]
id = "femiglow-cron-secret"
description = "Cron secret"
regex = '''CRON_SECRET\s*=\s*['"]?[A-Za-z0-9+/=]{20,}'''
tags = ["secret"]

[[rules]]
id = "femiglow-database-url"
description = "Postgres connection string"
regex = '''postgres(ql)?:\/\/[^\s'"]+'''
tags = ["secret"]
```

Pre-commit hook :

```bash
# .husky/pre-commit
gitleaks protect --staged --redact -v
```

CI :

```yaml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Stratégie

| Outil | Pre-commit | CI | Échec |
|---|---|---|---|
| Prettier | oui (`--write`) | (vérification implicite) | non bloquant local, cf. lint |
| ESLint | oui (`--fix`) | oui | bloque si erreur |
| TypeScript | non (lent) | oui | bloque |
| Gitleaks | oui (`protect`) | oui (full scan) | bloque |

## Tests

| Type | Fichier |
|---|---|
| Smoke | `lint-config.test.ts` (charge eslint config sans erreur) |
| CI dry-run | `pnpm lint --max-warnings 0` |
