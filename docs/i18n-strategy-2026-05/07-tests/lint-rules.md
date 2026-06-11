# Lint rules — ESLint custom rules pour i18n

> Règles ESLint custom pour FemiGlow i18n. Détecte les hardcoded strings, valide le format des clés, détecte les orphelines, vérifie la coverage par locale.
> Code source TypeScript complet de chaque règle, configuration, tests.

## 1. Règles à créer

| Règle | Type | Sévérité | Description |
|---|---|---|---|
| `i18n/no-hardcoded-strings` | Detection | error | Détecte strings JSX > 3 mots non extraits |
| `i18n/key-format` | Validation | error | Enforce `<namespace>.<section>.<element>` |
| `i18n/no-orphan-keys` | Coverage | warn | Détecte clés définies mais jamais utilisées |
| `i18n/required-locales` | Coverage | warn | Détecte clé manquante dans une locale |

## 2. Package ESLint plugin

### 2.1 Structure

```
apps/web/eslint-plugin-femiglow-i18n/
├── package.json
├── README.md
├── src/
│   ├── index.ts
│   ├── rules/
│   │   ├── no-hardcoded-strings.ts
│   │   ├── key-format.ts
│   │   ├── no-orphan-keys.ts
│   │   └── required-locales.ts
│   └── utils/
│       ├── load-messages.ts
│       └── collect-keys.ts
├── tests/
│   ├── no-hardcoded-strings.test.ts
│   ├── key-format.test.ts
│   ├── no-orphan-keys.test.ts
│   └── required-locales.test.ts
└── tsconfig.json
```

### 2.2 `package.json`

```json
{
  "name": "@femiglow/eslint-plugin-i18n",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p .",
    "test": "vitest run"
  },
  "peerDependencies": {
    "eslint": "^8.0.0 || ^9.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/utils": "^7.0.0"
  },
  "devDependencies": {
    "@typescript-eslint/rule-tester": "^7.18.0"
  }
}
```

### 2.3 `src/index.ts`

```ts
// apps/web/eslint-plugin-femiglow-i18n/src/index.ts
import noHardcodedStrings from './rules/no-hardcoded-strings';
import keyFormat from './rules/key-format';
import noOrphanKeys from './rules/no-orphan-keys';
import requiredLocales from './rules/required-locales';

export const rules = {
  'no-hardcoded-strings': noHardcodedStrings,
  'key-format': keyFormat,
  'no-orphan-keys': noOrphanKeys,
  'required-locales': requiredLocales,
};

export const configs = {
  recommended: {
    plugins: ['@femiglow/i18n'],
    rules: {
      '@femiglow/i18n/no-hardcoded-strings': 'error',
      '@femiglow/i18n/key-format': 'error',
      '@femiglow/i18n/no-orphan-keys': 'warn',
      '@femiglow/i18n/required-locales': 'warn',
    },
  },
};

export default { rules, configs };
```

## 3. Règle `no-hardcoded-strings`

### 3.1 Spec

Détecter les strings de plus de 3 mots dans JSX qui ne sont pas dans :
- `t('...')` ou `useTranslations('...').t('...')`
- `<Trans>...</Trans>` (next-intl)
- Attributs techniques (`data-testid`, `className`, `id`, `type`)
- Strings ne contenant que des nombres ou caractères techniques
- Commentaires JSX

### 3.2 Source

```ts
// apps/web/eslint-plugin-femiglow-i18n/src/rules/no-hardcoded-strings.ts
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator((name) =>
  `https://docs.femiglow.ma/i18n/lint/${name}`,
);

const TECHNICAL_ATTRS = new Set([
  'className', 'id', 'data-testid', 'data-id', 'data-track',
  'type', 'name', 'placeholder', 'value', 'href',
  'rel', 'aria-hidden', 'role', 'tabIndex',
  'key', 'ref', 'src', 'alt',
]);

const ALLOWED_VALUES_REGEX = /^(\s|\d|[^a-zA-Z؀-ۿ]+|true|false|null|undefined)*$/;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 1).length;
}

export default createRule({
  name: 'no-hardcoded-strings',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded user-facing strings in JSX (> 3 words)',
    },
    schema: [
      {
        type: 'object',
        properties: {
          minWords: { type: 'number', default: 3 },
          ignoreAttrs: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcoded: 'Hardcoded string "{{ text }}". Use t() / useTranslations() instead. Suggested key: {{ suggestion }}',
    },
  },
  defaultOptions: [{ minWords: 3 }],
  create(context, [options]) {
    const minWords = options.minWords ?? 3;
    const ignoreAttrs = new Set([...TECHNICAL_ATTRS, ...(options.ignoreAttrs ?? [])]);

    function isHardcodedText(text: string): boolean {
      if (!text) return false;
      const trimmed = text.trim();
      if (trimmed.length === 0) return false;
      if (ALLOWED_VALUES_REGEX.test(trimmed)) return false;
      if (countWords(trimmed) < minWords) return false;
      return true;
    }

    function suggestKey(text: string): string {
      const words = text.toLowerCase().trim()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join('_');
      return `<namespace>.<section>.${words}`;
    }

    return {
      JSXText(node: TSESTree.JSXText) {
        if (isHardcodedText(node.value)) {
          context.report({
            node,
            messageId: 'hardcoded',
            data: {
              text: node.value.trim().slice(0, 50),
              suggestion: suggestKey(node.value),
            },
          });
        }
      },

      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (node.name.type !== 'JSXIdentifier') return;
        const attrName = node.name.name;
        if (ignoreAttrs.has(attrName)) return;

        if (
          node.value &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string' &&
          isHardcodedText(node.value.value)
        ) {
          context.report({
            node: node.value,
            messageId: 'hardcoded',
            data: {
              text: String(node.value.value).slice(0, 50),
              suggestion: suggestKey(String(node.value.value)),
            },
          });
        }
      },
    };
  },
});
```

### 3.3 Test de la règle

```ts
// apps/web/eslint-plugin-femiglow-i18n/tests/no-hardcoded-strings.test.ts
import { RuleTester } from '@typescript-eslint/rule-tester';
import noHardcodedStrings from '../src/rules/no-hardcoded-strings';

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

ruleTester.run('no-hardcoded-strings', noHardcodedStrings, {
  valid: [
    {
      code: `function C() { return <h1>{t('marketing.hero.title')}</h1>; }`,
    },
    {
      code: `function C() { return <h1>1</h1>; }`,
    },
    {
      code: `function C() { return <span>OK</span>; }`,
    },
    {
      code: `function C() { return <img data-testid="hero-image" />; }`,
    },
    {
      code: `function C() { return <input type="text" placeholder={t('common.placeholder.email')} />; }`,
    },
  ],
  invalid: [
    {
      code: `function C() { return <h1>Découvrir notre kit FemiGlow</h1>; }`,
      errors: [{ messageId: 'hardcoded' }],
    },
    {
      code: `function C() { return <button aria-label="Cliquez pour acheter">Buy</button>; }`,
      errors: [{ messageId: 'hardcoded' }],
    },
    {
      code: `function C() { return <p>Le kit qui révèle ton éclat naturel.</p>; }`,
      errors: [{ messageId: 'hardcoded' }],
    },
  ],
});
```

## 4. Règle `key-format`

### 4.1 Spec

Enforce `<namespace>.<section>.<element>[.<modifier>]` lowercase snake_case.

Exemples valides :
- `common.back`
- `marketing.hero.title`
- `wizard.shipping.fields.address_line_1`

Exemples invalides :
- `MarketingHeroTitle` (camelCase)
- `marketing-hero-title` (kebab-case)
- `marketing.HeroTitle` (mixed)
- `hero.title` (manque namespace)
- `text1` (anonyme)

### 4.2 Source

```ts
// apps/web/eslint-plugin-femiglow-i18n/src/rules/key-format.ts
import { ESLintUtils, TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator((name) =>
  `https://docs.femiglow.ma/i18n/lint/${name}`,
);

const VALID_NAMESPACES = [
  'common', 'navigation', 'marketing', 'wizard',
  'legal', 'admin', 'email', 'errors', 'seo',
];

const KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const ANONYMOUS_REGEX = /^(text|string|msg|key|item)\d+$/;

export default createRule({
  name: 'key-format',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce i18n key format <namespace>.<section>.<element>',
    },
    schema: [
      {
        type: 'object',
        properties: {
          validNamespaces: { type: 'array', items: { type: 'string' } },
          minSegments: { type: 'number', default: 2 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidFormat: 'Key "{{ key }}" does not match format <namespace>.<section>.<element>. Use lowercase snake_case.',
      invalidNamespace: 'Key "{{ key }}" starts with invalid namespace "{{ namespace }}". Valid: {{ valid }}.',
      anonymousKey: 'Key "{{ key }}" looks anonymous. Use descriptive names.',
      tooFlat: 'Key "{{ key }}" is too flat. Use at least {{ minSegments }} segments.',
    },
  },
  defaultOptions: [{ validNamespaces: VALID_NAMESPACES, minSegments: 2 }],
  create(context, [options]) {
    const validNamespaces = new Set(options.validNamespaces ?? VALID_NAMESPACES);
    const minSegments = options.minSegments ?? 2;

    function checkKey(node: TSESTree.Node, key: string) {
      if (ANONYMOUS_REGEX.test(key)) {
        context.report({
          node,
          messageId: 'anonymousKey',
          data: { key },
        });
        return;
      }

      if (!KEY_REGEX.test(key)) {
        context.report({
          node,
          messageId: 'invalidFormat',
          data: { key },
        });
        return;
      }

      const segments = key.split('.');
      if (segments.length < minSegments) {
        context.report({
          node,
          messageId: 'tooFlat',
          data: { key, minSegments },
        });
        return;
      }

      const namespace = segments[0];
      if (!validNamespaces.has(namespace)) {
        context.report({
          node,
          messageId: 'invalidNamespace',
          data: {
            key,
            namespace,
            valid: [...validNamespaces].join(', '),
          },
        });
      }
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 't') {
          const arg = node.arguments[0];
          if (arg && arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
            checkKey(arg, arg.value);
          }
        }

        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          (node.callee.name === 'useTranslations' || node.callee.name === 'getTranslations')
        ) {
          const arg = node.arguments[0];
          if (arg && arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
            const ns = arg.value;
            if (!validNamespaces.has(ns.split('.')[0])) {
              context.report({
                node: arg,
                messageId: 'invalidNamespace',
                data: { key: ns, namespace: ns.split('.')[0], valid: [...validNamespaces].join(', ') },
              });
            }
          }
        }
      },
    };
  },
});
```

### 4.3 Test

```ts
// apps/web/eslint-plugin-femiglow-i18n/tests/key-format.test.ts
import { RuleTester } from '@typescript-eslint/rule-tester';
import keyFormat from '../src/rules/key-format';

const ruleTester = new RuleTester({ parser: '@typescript-eslint/parser' });

ruleTester.run('key-format', keyFormat, {
  valid: [
    { code: `t('common.back')` },
    { code: `t('marketing.hero.title')` },
    { code: `t('wizard.shipping.fields.address_line_1')` },
    { code: `useTranslations('marketing')` },
    { code: `useTranslations('navigation')` },
  ],
  invalid: [
    {
      code: `t('MarketingHeroTitle')`,
      errors: [{ messageId: 'invalidFormat' }],
    },
    {
      code: `t('marketing-hero-title')`,
      errors: [{ messageId: 'invalidFormat' }],
    },
    {
      code: `t('hero.title')`,
      errors: [{ messageId: 'invalidNamespace' }],
    },
    {
      code: `t('common')`,
      errors: [{ messageId: 'tooFlat' }],
    },
    {
      code: `t('text1')`,
      errors: [{ messageId: 'anonymousKey' }],
    },
    {
      code: `useTranslations('foo')`,
      errors: [{ messageId: 'invalidNamespace' }],
    },
  ],
});
```

## 5. Règle `no-orphan-keys`

### 5.1 Spec

Charger `messages/fr.json`, collecter toutes les clés. Scanner les fichiers `.tsx/.ts` du projet pour trouver les `t('...')`. Si une clé existe dans le JSON mais n'est jamais utilisée → warning.

### 5.2 Source

```ts
// apps/web/eslint-plugin-femiglow-i18n/src/rules/no-orphan-keys.ts
import { ESLintUtils, TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import fs from 'node:fs';
import path from 'node:path';

const createRule = ESLintUtils.RuleCreator((name) =>
  `https://docs.femiglow.ma/i18n/lint/${name}`,
);

const usedKeysGlobal = new Set<string>();
let frKeysCache: Set<string> | null = null;

function loadFrKeys(messagesPath: string): Set<string> {
  if (frKeysCache) return frKeysCache;
  const content = fs.readFileSync(path.resolve(messagesPath, 'fr.json'), 'utf8');
  const messages = JSON.parse(content);
  const keys = collectKeys(messages);
  frKeysCache = new Set(keys);
  return frKeysCache;
}

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

export default createRule({
  name: 'no-orphan-keys',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect i18n keys defined but never used',
    },
    schema: [
      {
        type: 'object',
        properties: {
          messagesPath: { type: 'string', default: './messages' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      orphanKey: 'Orphan key "{{ key }}" is defined but never used in code.',
    },
  },
  defaultOptions: [{ messagesPath: './messages' }],
  create(context, [options]) {
    const messagesPath = options.messagesPath ?? './messages';

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;

        if (node.callee.name === 't') {
          const arg = node.arguments[0];
          if (arg && arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
            usedKeysGlobal.add(arg.value);
          }
        }

        if (node.callee.name === 'useTranslations' || node.callee.name === 'getTranslations') {
          const arg = node.arguments[0];
          if (arg && arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
            const namespace = arg.value;
            const allKeys = loadFrKeys(messagesPath);
            for (const k of allKeys) {
              if (k.startsWith(namespace + '.')) usedKeysGlobal.add(k);
            }
          }
        }
      },

      'Program:exit'(): void {
        if (process.env.ESLINT_I18N_FINAL_PASS !== '1') return;

        const allKeys = loadFrKeys(messagesPath);
        const orphans = [...allKeys].filter(k => !usedKeysGlobal.has(k));

        for (const orphan of orphans) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'orphanKey',
            data: { key: orphan },
          });
        }
      },
    };
  },
});
```

### 5.3 Limitation

Cette règle a une limitation : ESLint analyse les fichiers un par un, donc la "pass finale" ne fonctionne pas naturellement. Solution :

```bash
# Script séparé : extract used keys, compare avec FR
node scripts/check-orphan-i18n-keys.mjs
```

```js
// scripts/check-orphan-i18n-keys.mjs
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

const files = await glob('src/**/*.{ts,tsx}');
const usedKeys = new Set();
const useTranslationsNs = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  const tRegex = /\bt\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = tRegex.exec(content))) {
    usedKeys.add(match[1]);
  }

  const utRegex = /useTranslations\(['"]([^'"]+)['"]\)/g;
  while ((match = utRegex.exec(content))) {
    useTranslationsNs.add(match[1]);
  }
}

const fr = JSON.parse(fs.readFileSync('messages/fr.json', 'utf8'));
const allKeys = collectKeys(fr);

for (const ns of useTranslationsNs) {
  for (const k of allKeys) {
    if (k.startsWith(ns + '.')) usedKeys.add(k);
  }
}

const orphans = allKeys.filter(k => !usedKeys.has(k));

if (orphans.length > 0) {
  console.warn(`Found ${orphans.length} orphan keys:`);
  for (const k of orphans) console.warn(`  - ${k}`);
  process.exit(1);
}

console.log('No orphan keys');

function collectKeys(obj, prefix = '') {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v, path));
    else keys.push(path);
  }
  return keys;
}
```

## 6. Règle `required-locales`

### 6.1 Spec

Quand une clé existe dans `fr.json` mais pas dans `ar.json` ou `en.json`, warning.

### 6.2 Source (script)

Cette vérification est typiquement faite par un **script Node** plutôt qu'une règle ESLint (car ESLint analyse le code TS, pas les JSON globaux).

```js
// scripts/check-required-locales.mjs
import fs from 'node:fs';

const LOCALES = ['fr', 'ar', 'en'];
const messages = {};
for (const loc of LOCALES) {
  messages[loc] = JSON.parse(fs.readFileSync(`messages/${loc}.json`, 'utf8'));
}

function collectKeys(obj, prefix = '') {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v, path));
    else keys.push(path);
  }
  return keys;
}

const frKeys = new Set(collectKeys(messages.fr));
const missingPerLocale = {};

for (const loc of LOCALES) {
  if (loc === 'fr') continue;
  const locKeys = new Set(collectKeys(messages[loc]));
  const missing = [...frKeys].filter(k => !locKeys.has(k));
  if (missing.length > 0) {
    missingPerLocale[loc] = missing;
  }
}

if (Object.keys(missingPerLocale).length === 0) {
  console.log('All locales have all FR keys');
  process.exit(0);
}

console.warn('Missing keys per locale:');
for (const [loc, keys] of Object.entries(missingPerLocale)) {
  console.warn(`\n  ${loc} (${keys.length} missing):`);
  for (const k of keys.slice(0, 20)) console.warn(`    - ${k}`);
  if (keys.length > 20) console.warn(`    ... and ${keys.length - 20} more`);
}

if (process.env.STRICT === '1') {
  process.exit(1);
}
```

## 7. Configuration ESLint

### 7.1 `.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["@femiglow/i18n"],
  "rules": {
    "@femiglow/i18n/no-hardcoded-strings": ["error", { "minWords": 3 }],
    "@femiglow/i18n/key-format": "error",
    "@femiglow/i18n/no-orphan-keys": ["warn", { "messagesPath": "./messages" }],
    "@femiglow/i18n/required-locales": "warn"
  },
  "overrides": [
    {
      "files": ["src/lib/checkout/i18n/**"],
      "rules": {
        "@femiglow/i18n/no-hardcoded-strings": "off"
      }
    },
    {
      "files": ["**/*.test.ts", "**/*.test.tsx"],
      "rules": {
        "@femiglow/i18n/no-hardcoded-strings": "off"
      }
    }
  ]
}
```

### 7.2 Scripts npm

```json
{
  "scripts": {
    "lint:i18n": "eslint src --ext .ts,.tsx --rulesdir ./eslint-plugin-femiglow-i18n/src/rules",
    "check:orphan-keys": "node scripts/check-orphan-i18n-keys.mjs",
    "check:required-locales": "node scripts/check-required-locales.mjs",
    "check:required-locales:strict": "STRICT=1 node scripts/check-required-locales.mjs"
  }
}
```

## 8. CI integration

```yaml
# .github/workflows/lint-i18n.yml
name: Lint i18n
on:
  pull_request:
    paths:
      - 'apps/web/src/**'
      - 'apps/web/messages/**'

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @femiglow/web lint:i18n
      - run: pnpm --filter @femiglow/web check:required-locales

  orphans:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @femiglow/web check:orphan-keys
        continue-on-error: true
```

## 9. Pre-commit hook

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm --filter @femiglow/web lint:i18n
pnpm --filter @femiglow/web check:required-locales

if [ $? -ne 0 ]; then
  echo "i18n lint failed. Fix issues before committing."
  exit 1
fi
```

## 10. Anti-patterns

1. **Désactiver une règle au lieu de fixer** : `// eslint-disable-next-line` doit être un dernier recours.
2. **Ignorer les warnings `no-orphan-keys`** : nettoie tous les 6 mois minimum.
3. **`minWords: 1`** trop strict : fail sur "OK", "Yes", "No".
4. **Pas de tests pour les règles ESLint** custom : régression silencieuse.
5. **Charger les JSON à chaque fichier** : performance lente, cacher.
6. **Pas exposer les options de la règle** : pas configurable, schémas vide.

## 11. Documentation pour devs

### 11.1 Comment fixer `no-hardcoded-strings`

```tsx
// ❌ Avant
function Hero() {
  return <h1>Découvrir le kit FemiGlow</h1>;
}

// ✅ Après
import { useTranslations } from 'next-intl';

function Hero() {
  const t = useTranslations('marketing.hero');
  return <h1>{t('title')}</h1>;
}
```

Puis ajouter la clé dans `messages/fr.json`, `messages/ar.json`, `messages/en.json`.

### 11.2 Comment fixer `key-format`

```tsx
// ❌
t('heroTitle')
t('marketing-hero-title')
t('hero.title')  // sans namespace valide

// ✅
t('marketing.hero.title')
t('common.back')
t('wizard.shipping.fields.address_line_1')
```

### 11.3 Comment fixer `no-orphan-keys`

Si une clé n'est plus utilisée, la supprimer de **tous** les fichiers locale (`fr.json`, `ar.json`, `en.json`).

```bash
# Trouver les usages
grep -rn "marketing.legacy.cta" src/

# Si vraiment plus utilisé, delete des 3 JSON
```

### 11.4 Comment fixer `required-locales`

```bash
# Voir les manquantes
pnpm --filter @femiglow/web check:required-locales

# Ouvrir /admin/i18n/dashboard
# Pour chaque clé manquante, ajouter la traduction
# Ou via PR direct sur messages/{locale}.json
```

## 12. Commandes

```bash
# Run all lint
pnpm --filter @femiglow/web lint:i18n

# Check orphans
pnpm --filter @femiglow/web check:orphan-keys

# Check required locales
pnpm --filter @femiglow/web check:required-locales

# Strict mode (fail CI)
STRICT=1 pnpm --filter @femiglow/web check:required-locales

# Test the plugin lui-même
pnpm --filter @femiglow/eslint-plugin-i18n test
```

## 13. Checklist ESLint rules i18n

- [ ] Package `@femiglow/eslint-plugin-i18n` créé
- [ ] Règle `no-hardcoded-strings` avec tests RuleTester
- [ ] Règle `key-format` avec tests
- [ ] Règle `no-orphan-keys` (ou script Node équivalent)
- [ ] Script `check-required-locales.mjs`
- [ ] `.eslintrc.json` étend la config recommended
- [ ] Pre-commit hook Husky configuré
- [ ] CI workflow `.github/workflows/lint-i18n.yml`
- [ ] Documentation interne pour fix chaque règle
- [ ] Tests RuleTester pour chaque règle (au moins 5 valid + 5 invalid)
- [ ] Schema JSON pour options de chaque règle
- [ ] Override pour `lib/checkout/i18n/` (CHA-231 exemption)
- [ ] Override pour fichiers tests (`*.test.ts`)
