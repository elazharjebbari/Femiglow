# ESLint

## Configuration

`apps/web/.eslintrc.json` :

```jsonc
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:jsx-a11y/recommended",
    "plugin:tailwindcss/recommended",
    "prettier"
  ],
  "parserOptions": {
    "project": ["./tsconfig.json"]
  },
  "plugins": ["unused-imports", "no-relative-import-paths"],
  "rules": {
    // Imports
    "unused-imports/no-unused-imports": "error",
    "no-relative-import-paths/no-relative-import-paths": [
      "error",
      { "allowSameFolder": true, "rootDir": "src", "prefix": "@" }
    ],

    // Sécurité — anti SQL injection / leaks
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["**/db/client", "**/db/schema"],
            "importNamePattern": "^sql$",
            "message": "Utilisez Drizzle paramétré, pas sql.raw()."
          }
        ]
      }
    ],
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
        "message": "sql.raw() interdit avec input utilisateur."
      },
      {
        "selector": "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        "message": "dangerouslySetInnerHTML interdit (XSS)."
      }
    ],

    // Type safety
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",

    // Hygiène
    "no-console": ["error", { "allow": ["error"] }],

    // a11y plus strict que le défaut
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/no-autofocus": "warn"
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.test.tsx", "test/**/*"],
      "rules": {
        "no-console": "off",
        "@typescript-eslint/no-non-null-assertion": "off"
      }
    },
    {
      "files": ["scripts/**/*"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

## Règles spécifiques au projet

### Pas d'import relatif au-delà du même dossier

```ts
// ❌
import { Button } from '../../../components/ui/Button';

// ✅
import { Button } from '@/components/ui/Button';
```

### Pas de `console.log`

```ts
// ❌
console.log('debug:', something);

// ✅ (pour erreurs uniquement)
console.error('Admin error:', error);

// ✅ (logging structuré applicatif)
logger.info({ event: 'lead.created', meta: ... });
```

### Pas de `dangerouslySetInnerHTML`

Si du HTML doit absolument être rendu (cas extrême), passer par
`DOMPurify.sanitize()` avec une whitelist explicite. Approbation
sécurité requise dans la PR.

### Promesses non awaitées

```ts
// ❌ — la promesse peut planter silencieusement
asyncOperation();

// ✅
await asyncOperation();
// ou explicitement fire-and-forget :
void asyncOperation();
```

## Exécution

```bash
pnpm lint               # vérifie tout
pnpm lint --fix         # auto-fix
pnpm lint:report        # JSON pour CI
```

## CI

```yaml
- name: Lint
  run: pnpm lint
```

Échec ⇒ PR rouge.

## Tests

```ts
// .eslintrc.test.ts (smoke)
import { ESLint } from 'eslint';

it('config loads without error', async () => {
  const eslint = new ESLint();
  const config = await eslint.calculateConfigForFile('src/app/page.tsx');
  expect(config).toBeDefined();
});
```
