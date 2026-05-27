# Snapshot tests — Drift detection messages + composants

> Tests snapshots Vitest pour FemiGlow i18n.
> Couvre : structure des `messages.json` (drift detection), composants rendus FR vs AR, types générés.

## 1. Quand utiliser les snapshots

Les snapshots sont utiles pour :
- **Détecter un drift** entre `fr.json` et `ar.json` (clés divergent)
- **Détecter un changement de shape** d'un composant rendu par locale
- **Détecter un changement** dans les types générés (`IntlMessages` interface)
- **Audit visuel** de la sortie HTML d'un composant

Les snapshots **ne sont pas** :
- Un remplacement pour tests d'assertions précises
- Un proof of correctness (un snapshot vert ne dit pas si c'est juste, juste si ça n'a pas changé)
- Une référence éternelle (à update quand le change est volontaire)

## 2. Snapshot shape de `messages/*.json`

### 2.1 Pourquoi : drift detection

Quand un dev ajoute une clé en FR (`marketing.hero.cta_v2`), il doit aussi l'ajouter en AR et EN. Sinon :
- Le visiteur AR voit `[marketing.hero.cta_v2]` brut
- L'app perd en cohérence

→ Un snapshot des **clés** (pas des valeurs) attrape ce drift automatiquement.

### 2.2 Test : keys snapshot

```ts
// messages/keys.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import frMessages from './fr.json';
import arMessages from './ar.json';
import enMessages from './en.json';

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
  return keys.sort();
}

describe('messages keys snapshot', () => {
  it('FR keys snapshot (source of truth)', () => {
    const keys = collectKeys(frMessages);
    expect(keys).toMatchSnapshot();
  });

  it('AR keys match FR (no drift)', () => {
    const frKeys = collectKeys(frMessages);
    const arKeys = collectKeys(arMessages);
    expect(arKeys).toEqual(frKeys);
  });

  it('EN keys match FR (no drift)', () => {
    const frKeys = collectKeys(frMessages);
    const enKeys = collectKeys(enMessages);
    expect(enKeys).toEqual(frKeys);
  });

  it('total keys count snapshot', () => {
    const total = collectKeys(frMessages).length;
    expect(total).toMatchInlineSnapshot('542');
  });

  it('namespaces snapshot', () => {
    const namespaces = Object.keys(frMessages).sort();
    expect(namespaces).toMatchSnapshot();
  });
});
```

### 2.3 Snapshot output `__snapshots__/keys.snapshot.test.ts.snap`

```
// Vitest Snapshot v1
exports[`messages keys snapshot > FR keys snapshot 1`] = `
[
  "common.back",
  "common.cancel",
  "common.continue",
  "common.error",
  "common.loading",
  "errors.404.cta",
  "errors.404.description",
  "errors.404.title",
  "errors.network.retry",
  "errors.network.title",
  ...
]
`;

exports[`messages keys snapshot > namespaces snapshot 1`] = `
[
  "admin",
  "common",
  "email",
  "errors",
  "legal",
  "marketing",
  "navigation",
  "seo",
  "wizard",
]
`;
```

### 2.4 Update procedure

Quand on ajoute une vraie nouvelle clé (et son AR/EN correspondants) :

```bash
# 1. Lance les tests, le snapshot keys échoue
pnpm test -- messages/keys.snapshot.test.ts

# 2. Vérifier le diff dans le terminal
# 3. Si correct, update :
pnpm test -- messages/keys.snapshot.test.ts -u

# 4. Commit le .snap modifié avec les .json
git add messages/*.json messages/__snapshots__/
git commit -m "feat(i18n): add marketing.hero.cta_v2 key"
```

## 3. Snapshot composants par locale

### 3.1 Pourquoi

Un composant rendu en FR et AR doit avoir une shape HTML cohérente. Un snapshot par locale attrape :
- Un changement involontaire dans la structure
- Un `dir="rtl"` oublié
- Une classe Tailwind RTL oubliée
- Un attribut ARIA en français non traduit

### 3.2 Test snapshot avec `renderToString`

```tsx
// src/components/sections/Hero.snapshot.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithI18n } from '@/test/helpers/i18n/render-with-i18n';
import { LOCALES_TEST_MATRIX } from '@/test/helpers/i18n/locales-matrix';
import { Hero } from './Hero';

describe('<Hero /> snapshots par locale', () => {
  it.each(LOCALES_TEST_MATRIX)('snapshot %s', (locale) => {
    const { container } = renderWithI18n(<Hero />, { locale });
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(LOCALES_TEST_MATRIX)('Hero classes locale-aware %s', (locale) => {
    const { container } = renderWithI18n(<Hero />, { locale });
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatchSnapshot();
  });
});
```

### 3.3 Snapshot output `__snapshots__/Hero.snapshot.test.tsx.snap`

```
exports[`<Hero /> snapshots par locale > snapshot fr 1`] = `
<section
  class="hero ms-0 md:ms-4 text-start"
  data-testid="hero-section"
>
  <h1
    class="text-4xl font-display"
  >
    Le kit qui révèle ton éclat.
  </h1>
  <p
    class="text-lg text-rose-700"
  >
    Soins ciblés en 5 minutes.
  </p>
  <a
    class="cta-primary"
    data-testid="hero-cta"
    href="/fr/kit"
  >
    Découvrir
  </a>
</section>
`;

exports[`<Hero /> snapshots par locale > snapshot ar 1`] = `
<section
  class="hero ms-0 md:ms-4 text-start"
  data-testid="hero-section"
>
  <h1
    class="text-4xl font-display"
  >
    الطقم الذي يكشف إشراقتك.
  </h1>
  <p
    class="text-lg text-rose-700"
  >
    عناية مركزة في 5 دقائق.
  </p>
  <a
    class="cta-primary"
    data-testid="hero-cta"
    href="/ar/kit"
  >
    اكتشف
  </a>
</section>
`;
```

### 3.4 Stratégie : inline snapshot pour petits composants

Pour les très petits composants, inline snapshot est plus lisible :

```tsx
// src/components/common/LocaleLabel.snapshot.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithI18n } from '@/test/helpers/i18n/render-with-i18n';
import { LocaleLabel } from './LocaleLabel';

describe('<LocaleLabel /> inline snapshots', () => {
  it('FR label', () => {
    const { container } = renderWithI18n(<LocaleLabel locale="fr" />, { locale: 'fr' });
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="locale-label"
      >
        Français
      </span>
    `);
  });

  it('AR label', () => {
    const { container } = renderWithI18n(<LocaleLabel locale="ar" />, { locale: 'fr' });
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="locale-label"
      >
        Arabe
      </span>
    `);
  });
});
```

## 4. Snapshot des types générés

### 4.1 Pourquoi

`next-intl` permet de générer une interface TypeScript `IntlMessages` à partir des messages.json. Cette interface doit rester stable.

### 4.2 Script de génération

```ts
// scripts/generate-i18n-types.mjs
import fs from 'node:fs';
import path from 'node:path';

const fr = JSON.parse(fs.readFileSync('messages/fr.json', 'utf8'));

function generateInterface(obj, depth = 0): string {
  const indent = '  '.repeat(depth);
  let result = '{\n';
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) {
      result += `${indent}  ${k}: ${generateInterface(v, depth + 1)};\n`;
    } else {
      result += `${indent}  ${k}: string;\n`;
    }
  }
  result += `${indent}}`;
  return result;
}

const interfaceCode = `// Generated by scripts/generate-i18n-types.mjs
export interface IntlMessages ${generateInterface(fr)}
`;

fs.writeFileSync('src/lib/i18n/types.generated.ts', interfaceCode);
```

### 4.3 Test snapshot des types

```ts
// src/lib/i18n/types.generated.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Generated types snapshot', () => {
  it('IntlMessages interface snapshot', () => {
    const filePath = path.resolve(__dirname, './types.generated.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toMatchSnapshot();
  });

  it('interface contains all namespaces', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './types.generated.ts'), 'utf8');
    expect(content).toMatch(/common:/);
    expect(content).toMatch(/marketing:/);
    expect(content).toMatch(/wizard:/);
    expect(content).toMatch(/legal:/);
    expect(content).toMatch(/admin:/);
    expect(content).toMatch(/email:/);
    expect(content).toMatch(/errors:/);
    expect(content).toMatch(/seo:/);
    expect(content).toMatch(/navigation:/);
  });
});
```

## 5. Snapshot dictionnaire Wizard CHA-231

### 5.1 Test snapshot du WizardDictionary

```ts
// src/lib/checkout/i18n/dictionary.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { WIZARD_DICTIONARIES } from './dictionary';

describe('WizardDictionary snapshots', () => {
  it('FR dictionary structure', () => {
    expect(Object.keys(WIZARD_DICTIONARIES.fr).sort()).toMatchSnapshot();
  });

  it('AR dictionary structure (same shape)', () => {
    expect(Object.keys(WIZARD_DICTIONARIES.ar).sort()).toMatchSnapshot();
  });

  it('total key count snapshot', () => {
    function countKeys(obj: unknown): number {
      if (typeof obj !== 'object' || obj === null) return 1;
      let count = 0;
      for (const v of Object.values(obj as Record<string, unknown>)) {
        count += countKeys(v);
      }
      return count;
    }

    const frCount = countKeys(WIZARD_DICTIONARIES.fr);
    const arCount = countKeys(WIZARD_DICTIONARIES.ar);
    expect(frCount).toMatchInlineSnapshot('72');
    expect(arCount).toEqual(frCount);
  });
});
```

## 6. Snapshot Server Components

### 6.1 Pourquoi

Avec App Router et RSC, les composants peuvent être server-rendered. On peut snapshot leur HTML output.

```tsx
// src/app/[locale]/page.server.snapshot.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import HomePage from './page';
import { NextIntlClientProvider } from 'next-intl';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

describe('Home page server snapshots', () => {
  it('FR home server-rendered HTML', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <HomePage params={{ locale: 'fr' }} />
      </NextIntlClientProvider>,
    );
    expect(html).toMatchSnapshot();
  });

  it('AR home server-rendered HTML', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="ar" messages={arMessages}>
        <HomePage params={{ locale: 'ar' }} />
      </NextIntlClientProvider>,
    );
    expect(html).toMatchSnapshot();
  });
});
```

## 7. Politique de mise à jour des snapshots

### 7.1 Quand updater

| Situation | Action |
|---|---|
| Nouvelle clé ajoutée en FR + AR + EN | `pnpm test -u` puis review |
| Renommage d'une clé | `pnpm test -u` puis review |
| Composant UI redesigné | `pnpm test -u` puis review HTML diff dans la PR |
| Types regenerés | `pnpm test -u` puis review interface diff |
| Bug fix qui change le rendu | `pnpm test -u` puis review |
| Le snapshot a divergé mais le code n'a pas changé | **INVESTIGUER**, ne pas update |

### 7.2 Review obligatoire dans PR

Toute PR qui modifie des `.snap` doit avoir :
- Au moins **2 reviewers**
- Un check visuel du diff snapshot
- Une justification dans la description PR

### 7.3 Anti-pattern : "update everything"

```bash
# ❌ Mauvais — fait taire tous les tests sans regarder
pnpm test -u

# ✅ Bon — update le fichier ciblé après review du diff
pnpm test -- messages/keys.snapshot.test.ts -u
```

## 8. Snapshots vs assertions explicites

### 8.1 Préférer assertion quand on connaît la valeur

```tsx
// ❌ Snapshot pour un test simple
it('renders correct CTA href', () => {
  const { container } = renderWithI18n(<Hero />, { locale: 'fr' });
  expect(container.querySelector('a')?.getAttribute('href')).toMatchSnapshot();
});

// ✅ Assertion explicite
it('renders correct CTA href', () => {
  const { container } = renderWithI18n(<Hero />, { locale: 'fr' });
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/fr/kit');
});
```

### 8.2 Quand le snapshot vaut le coup

- HTML complet d'un composant complexe (10+ éléments)
- Liste très longue (toutes les clés i18n)
- Diff "structurel" plus important que valeur précise

## 9. Coverage spécifique snapshots

### 9.1 Coverage des snapshots dans CI

```bash
# Vérifier qu'aucun snapshot n'est obsolète (existe mais pas utilisé)
pnpm vitest run --reporter=verbose --no-coverage 2>&1 | grep "obsolete"
```

CI fail si snapshot obsolète détecté → forcer à les supprimer.

### 9.2 Configuration vitest

```ts
// vitest.config.ts (extrait)
export default defineConfig({
  test: {
    snapshotSerializers: ['./src/test/serializers/i18n-serializer.ts'],
    snapshotFormat: {
      printBasicPrototype: false,
      escapeString: false,
    },
  },
});
```

### 9.3 Serializer custom pour i18n

```ts
// src/test/serializers/i18n-serializer.ts
import type { SnapshotSerializer } from 'vitest';

const i18nSerializer: SnapshotSerializer = {
  test(value: unknown): boolean {
    return typeof value === 'object' && value !== null && '__i18n' in value;
  },
  serialize(value: { __i18n: { locale: string; namespace: string; key: string } }): string {
    const { locale, namespace, key } = value.__i18n;
    return `i18n[${locale}::${namespace}.${key}]`;
  },
};

export default i18nSerializer;
```

## 10. Anti-patterns snapshots

1. **Snapshot le `messages/fr.json` complet** : trop verbeux (~50 KB), drift detect inutile. Préférer snapshot des **keys** seulement.
2. **Snapshot une date dynamique** : `new Date()` casse à chaque run. Mocker l'horloge.
3. **Pas reviewer le diff** dans la PR : on update aveuglément.
4. **Snapshots obsolètes** : oubliés en cas de delete de test, gonflent le repo.
5. **Snapshot un composant qui contient une UUID** : non-déterministe, mocker.
6. **Snapshot HTML très long** : > 100 lignes = preuve qu'on snapshot trop de chose.
7. **Pas snapshot AR** : on vérifie FR seulement, AR drift invisible.
8. **Update --update-all sans rien lire** : "test passe" devient un alibi.

## 11. Patterns avancés

### 11.1 Snapshot par cas (`.each`)

```tsx
it.each(LOCALES_TEST_MATRIX)('Hero snapshot %s', (locale) => {
  const { container } = renderWithI18n(<Hero />, { locale });
  expect(container.firstChild).toMatchSnapshot();
});
```

Produit 3 snapshots dans un même `.snap` file :

```
exports[`Hero snapshot fr > 1`] = ...
exports[`Hero snapshot ar > 1`] = ...
exports[`Hero snapshot en > 1`] = ...
```

### 11.2 Custom matcher pour shape

```ts
// src/test/matchers/to-match-i18n-shape.ts
import { expect } from 'vitest';

expect.extend({
  toMatchI18nShape(received: unknown, expected: { locales: string[]; keys: string[] }) {
    const messages = received as Record<string, unknown>;
    const messageKeys = collectKeys(messages);
    const missing = expected.keys.filter(k => !messageKeys.includes(k));
    const extras = messageKeys.filter(k => !expected.keys.includes(k));

    if (missing.length === 0 && extras.length === 0) {
      return { pass: true, message: () => 'i18n shape matches' };
    }
    return {
      pass: false,
      message: () => `i18n shape mismatch:\n  missing: ${missing.join(', ')}\n  extras: ${extras.join(', ')}`,
    };
  },
});

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v, path));
    else keys.push(path);
  }
  return keys;
}
```

Usage :

```ts
expect(arMessages).toMatchI18nShape({
  locales: ['ar'],
  keys: expectedKeysList,
});
```

## 12. Commandes

```bash
# Run snapshots only
pnpm --filter @femiglow/web test -- snapshot

# Update tous les snapshots
pnpm --filter @femiglow/web test -u

# Update un fichier spécifique
pnpm --filter @femiglow/web test -- src/components/Hero.snapshot.test.tsx -u

# Detect obsolete
pnpm --filter @femiglow/web test -- --reporter=verbose 2>&1 | grep obsolete

# CI mode : fail si snapshot non-committed
CI=1 pnpm --filter @femiglow/web test
```

## 13. Checklist snapshot i18n

- [ ] Snapshot des keys, pas des values
- [ ] Snapshot par locale via `it.each(LOCALES_TEST_MATRIX)`
- [ ] Inline snapshot pour petits composants
- [ ] Pas de snapshot avec date/UUID dynamique
- [ ] PR avec snapshot updates a un reviewer dédié
- [ ] Description PR explique le diff snapshot
- [ ] Snapshot des types générés `IntlMessages`
- [ ] Snapshot du WizardDictionary structure (CHA-231)
- [ ] CI fail sur obsolete snapshot
- [ ] Custom matcher `toMatchI18nShape` utilisé pour assertions structurelles
- [ ] Pas de `pnpm test -u` aveugle, toujours review
