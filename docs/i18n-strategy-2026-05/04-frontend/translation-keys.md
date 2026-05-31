# Translation keys — workflow dev complet

> Comment ajouter, modifier, supprimer une clé i18n de manière sûre. Toolchain (ESLint, codegen, IDE) et pre-commit gates.

## 1. Vue d'ensemble du workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Dev modifie/crée un composant                            │
│      → besoin d'une string utilisateur                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Choisir la clé selon naming-conventions.md               │
│      ex: marketing.kit.hero.cta_secondary                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Ajouter la clé + valeur FR (source) dans                 │
│      apps/web/messages/fr.json                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Lancer codegen :                                         │
│      pnpm i18n:codegen                                       │
│      → met à jour src/types/next-intl.d.ts                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Utiliser dans le code :                                  │
│      t('marketing.kit.hero.cta_secondary')                   │
│      → TS autocomplete fonctionne                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Lancer extraction (CI / local) :                         │
│      pnpm i18n:extract-keys                                  │
│      → vérifie cohérence code ↔ messages                     │
│      → output : missing_in_messages.json, orphan_keys.json   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Pré-commit hook (Husky) :                                │
│      - i18n:validate-keys (schema JSON)                      │
│      - i18n:no-hardcoded (ESLint)                            │
│      - i18n:check-coverage (>= seuil)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  8. Push → CI gates → merge                                  │
│      AR / EN traductions arrivent via Crowdin (06-data)      │
└─────────────────────────────────────────────────────────────┘
```

## 2. Anatomie d'un `messages/[locale].json`

### 2.1 Structure type

```json
{
  "common": {
    "back": "Retour",
    "continue": "Continuer",
    "loading": "Chargement…"
  },
  "navigation": {
    "home": "Accueil",
    "kit": "Le kit",
    "rituel": "Le rituel",
    "journal": "Journal",
    "contact": "Contact"
  },
  "marketing": {
    "hero": {
      "title": "Le rituel ongles, en cinq minutes.",
      "subtitle": "Trois gestes, une saison.",
      "cta_primary": "Découvrir le kit",
      "cta_secondary": "Voir le rituel"
    },
    "kit": {
      "title": "Le kit FemiGlow",
      "description": "Sobre, posé, sans urgence factice.",
      "cta": "Commander le kit",
      "benefits": {
        "heading": "Pourquoi le kit",
        "items": [
          "Conçu au Maroc",
          "Recharges disponibles",
          "Garantie 30 jours"
        ]
      },
      "items_count": "{count, plural, =0 {Aucun article} =1 {1 article} other {# articles}}"
    },
    "faq": {
      "items": {
        "shipping": {
          "question": "Quels sont les délais ?",
          "answer": "Livraison sous 2–4 jours ouvrés au Maroc."
        }
      }
    }
  },
  "errors": {
    "404": {
      "title": "Page introuvable",
      "description": "Cette page n'existe pas ou plus.",
      "cta_home": "Retour à l'accueil"
    }
  },
  "seo": {
    "kit": {
      "title": "Le kit FemiGlow — rituel ongles",
      "description": "Découvrez le kit conçu au Maroc pour cinq minutes de soin posé.",
      "og_title": "Le kit FemiGlow",
      "og_description": "Sobre, posé, sans urgence factice."
    }
  }
}
```

### 2.2 Règles d'ordre dans le JSON

- **Tri alphabétique** des clés au sein de chaque section
- **Imbrication** : ne pas dépasser 5 niveaux (`marketing.faq.items.shipping.question` = 5 OK)
- **Listes** : utiliser des arrays pour ordres stables, des objets pour accès par identifiant
- **Pas de commentaires** : JSON pur (pas de JSON5)

Pour les méta-informations (date last update, owner), créer un fichier annexe `messages/_meta.json`.

## 3. Type-safety — module augmentation

### 3.1 Génération du `.d.ts`

```ts
// src/types/next-intl.d.ts (auto-généré par pnpm i18n:codegen)
import type messages from '../../messages/fr.json';

type Messages = typeof messages;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntlMessages extends Messages {}
}

export {};
```

### 3.2 Effet TypeScript

```tsx
const t = useTranslations('marketing.kit');

t('title');                    // OK
t('benefits.heading');         // OK
t('benefits.items.0');         // OK (array access)
t('cta_v2');                   // ERROR — clé inexistante

const tFaq = useTranslations('marketing.faq.items.shipping');
tFaq('question');              // OK
tFaq('inexistant');            // ERROR
```

### 3.3 Commande codegen

```bash
# package.json
{
  "scripts": {
    "i18n:codegen": "tsx scripts/i18n/codegen.ts"
  }
}
```

Le script `codegen.ts` :
1. Lit `messages/fr.json`
2. Vérifie qu'il est valide JSON
3. Écrit `src/types/next-intl.d.ts` (avec import du JSON)
4. Optionnel : valide aussi que `messages/ar.json` et `messages/en.json` n'ont pas de clés en plus que FR

À lancer manuellement après ajout/suppression de clé. Le hook `pre-commit` le lance aussi en background pour catch les oublis.

### 3.4 Tip — type union dynamique

Pour passer des clés calculées (rare mais possible) :

```ts
type FaqItemId = 'shipping' | 'returns' | 'payment';

function FaqItem({ id }: { id: FaqItemId }) {
  const t = useTranslations('marketing.faq.items');
  return (
    <>
      <h3>{t(`${id}.question` as const)}</h3>
      <p>{t(`${id}.answer` as const)}</p>
    </>
  );
}
```

Le `as const` aide TS à inférer la chaîne littérale.

## 4. ESLint rule custom — `i18n/no-hardcoded-strings`

### 4.1 Objectif

Bloquer en CI tout commit avec une string utilisateur > 2 mots non passée par `t()`.

### 4.2 Logique de détection

```ts
// .eslint/rules/i18n-no-hardcoded-strings.js (extrait pseudo)
module.exports = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (!text) return;
        if (text.length < 3) return; // skip "x", "›", etc.
        if (/^[\d\s\W]*$/.test(text)) return; // skip numbers/symbols
        if (text.split(/\s+/).length < 2) return; // skip single words
        context.report({
          node,
          message: `Hardcoded string "${text}" — utiliser t('namespace.key')`,
        });
      },
      Literal(node) {
        // Détecte aussi les <button title="Cliquer ici"> etc.
        const parent = node.parent;
        if (parent.type !== 'JSXAttribute') return;
        const attrName = parent.name.name;
        if (!['title', 'alt', 'aria-label', 'placeholder'].includes(attrName)) return;
        if (typeof node.value !== 'string') return;
        if (node.value.split(/\s+/).length < 2) return;
        context.report({
          node,
          message: `Hardcoded attribute "${node.value}" — utiliser t('namespace.key')`,
        });
      },
    };
  },
};
```

### 4.3 Configuration

```js
// .eslintrc.cjs
module.exports = {
  plugins: ['i18n'],
  rules: {
    'i18n/no-hardcoded-strings': 'error', // bloque en CI
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/test/**', '**/mocks/**', '**/fixtures/**'],
      rules: { 'i18n/no-hardcoded-strings': 'off' },
    },
    {
      files: ['apps/web/src/app/admin/**'],
      rules: { 'i18n/no-hardcoded-strings': 'off' }, // admin reste FR V1
    },
  ],
};
```

### 4.4 Exceptions whitelist

Pour les strings techniques inévitables (noms propres, codes), utiliser un commentaire eslint-disable contextuel :

```tsx
// eslint-disable-next-line i18n/no-hardcoded-strings -- marque, intraduisible
<span>FemiGlow Maison</span>
```

Une whitelist globale est aussi possible via option de la rule :

```js
'i18n/no-hardcoded-strings': ['error', {
  ignoredStrings: ['FemiGlow', 'WhatsApp', 'CMI', 'COD'],
}],
```

## 5. CLI `pnpm i18n:extract-keys`

### 5.1 Mission

Vérifier la cohérence entre :
- Clés utilisées dans le code (via `t('...')` calls)
- Clés présentes dans `messages/fr.json`
- Clés présentes dans `messages/ar.json` et `messages/en.json`

### 5.2 Output

```
$ pnpm i18n:extract-keys

[i18n] Scanning apps/web/src/**/*.{ts,tsx} ...
[i18n] Found 542 t() calls.
[i18n] Loaded messages/fr.json (542 keys).
[i18n] Loaded messages/ar.json (423 keys).
[i18n] Loaded messages/en.json (245 keys).

✓ FR coverage: 100% (542/542)
⚠ AR coverage: 78% (423/542) — 119 missing keys
⚠ EN coverage: 45% (245/542) — 297 missing keys

Missing in messages/ar.json:
  - marketing.hero.cta_v2 (FR: "Découvrir maintenant")
  - marketing.kit.faq.shipping.question
  - errors.network.retry
  ... (116 more, see missing_ar.json)

Orphan keys (in messages but unused in code):
  - marketing.hero.old_subtitle
  - common.deprecated_label

Wrote: .i18n-cache/missing_ar.json
Wrote: .i18n-cache/missing_en.json
Wrote: .i18n-cache/orphan_keys.json
```

### 5.3 Implémentation simplifiée

```ts
// scripts/i18n/extract-keys.ts
import { Project } from 'ts-morph';
import fs from 'node:fs/promises';

const project = new Project({ tsConfigFilePath: 'apps/web/tsconfig.json' });
const sourceFiles = project.getSourceFiles('apps/web/src/**/*.{ts,tsx}');

const usedKeys = new Set<string>();

for (const sf of sourceFiles) {
  sf.forEachDescendant((node) => {
    if (node.getKindName() !== 'CallExpression') return;
    const callExpr = node.asKindOrThrow(/* CallExpression */);
    const exprText = callExpr.getExpression().getText();
    // Détecte t(...), tHero(...), getTranslations namespace, etc.
    if (!/^t\b|^tHero\b|^tFaq\b/.test(exprText)) return;
    const [keyArg] = callExpr.getArguments();
    if (!keyArg) return;
    const keyValue = keyArg.getText().replace(/['"`]/g, '');
    usedKeys.add(keyValue);
  });
}

const fr = JSON.parse(await fs.readFile('apps/web/messages/fr.json', 'utf8'));
const flatFr = flattenKeys(fr);
const orphan = flatFr.filter((k) => !usedKeys.has(k));
const missingInCode = [...usedKeys].filter((k) => !flatFr.includes(k));

console.log('Orphan keys:', orphan);
console.log('Used keys not in messages:', missingInCode);
```

### 5.4 Mode `--fix`

```bash
pnpm i18n:extract-keys --fix
```

Effets :
- Ajoute les clés manquantes dans `messages/fr.json` avec valeur placeholder `[TODO: marketing.kit.hero.cta_v2]`
- Supprime les orphelines confirmées (avec backup en `.i18n-cache/`)

Recommandé en local seulement (jamais en CI).

## 6. Setup IDE (VSCode)

### 6.1 Extension recommandée

`i18n-ally` (lokalise.i18n-ally) — extension VSCode populaire qui :
- Affiche la valeur de la traduction inline dans le code
- Permet de hover sur `t('marketing.kit.title')` et voir FR/AR/EN
- Détecte les clés manquantes
- Permet d'éditer un JSON traduction en mode form

### 6.2 Configuration VSCode

`.vscode/settings.json` :

```json
{
  "i18n-ally.localesPaths": ["apps/web/messages"],
  "i18n-ally.keystyle": "nested",
  "i18n-ally.sortKeys": true,
  "i18n-ally.namespace": true,
  "i18n-ally.pathMatcher": "{locale}.json",
  "i18n-ally.enabledParsers": ["json"],
  "i18n-ally.enabledFrameworks": ["next-intl"],
  "i18n-ally.displayLanguage": "fr",
  "i18n-ally.sourceLanguage": "fr",
  "i18n-ally.indent": 2,
  "i18n-ally.preferredDelimiter": ".",
  "i18n-ally.review.gitCommit": true,
  "i18n-ally.review.user.email": "${git.user.email}"
}
```

### 6.3 Snippets utiles

`.vscode/snippets.code-snippets` :

```json
{
  "Translation hook RSC": {
    "scope": "typescriptreact",
    "prefix": "ti18n-rsc",
    "body": [
      "const t = await getTranslations('${1:namespace}');"
    ]
  },
  "Translation hook Client": {
    "scope": "typescriptreact",
    "prefix": "ti18n-client",
    "body": [
      "const t = useTranslations('${1:namespace}');"
    ]
  },
  "Translation call": {
    "scope": "typescriptreact",
    "prefix": "tt",
    "body": [
      "{t('${1:key}')}"
    ]
  }
}
```

### 6.4 Autocomplete TS

Avec `src/types/next-intl.d.ts` correctement généré, l'IDE autocomplete les clés dès `t('` :

```tsx
const t = useTranslations('marketing.kit');
t('
  ┌──────────────────────────────────┐
  │ ▸ benefits.heading               │
  │ ▸ benefits.items.0               │
  │ ▸ benefits.items.1               │
  │ ▸ benefits.items.2               │
  │ ▸ cta                            │
  │ ▸ description                    │
  │ ▸ items_count                    │
  │ ▸ title                          │
  └──────────────────────────────────┘
```

## 7. Pre-commit hook (Husky)

### 7.1 Setup

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint --filter=web
pnpm i18n:validate-keys
pnpm i18n:check-coverage --threshold-fr=100 --threshold-ar=0 --threshold-en=0
```

### 7.2 Niveaux de strictesse

| Phase | FR seuil | AR seuil | EN seuil |
|---|---|---|---|
| Phase 1 (foundation) | 100% | 0% | 0% |
| Phase 2 (extraction) | 100% | 0% | 0% |
| Phase 3 (CMS multi) | 100% | 50% | 30% |
| Phase 4 (AR active) | 100% | 90% | 50% |
| Phase 5 (workflow stable) | 100% | 95% | 80% |
| Phase 7 (production) | 100% | 98% | 95% |

Le seuil augmente progressivement à mesure que Crowdin remplit les traductions.

### 7.3 Bypass d'urgence

```bash
git commit --no-verify -m "WIP: hotfix sans i18n"
```

À éviter sauf hotfix critique. Le CI bloquera quand même au push.

## 8. Workflow ajout d'une clé — exemple complet

Scénario : on ajoute une bannière promo "Offre limitée" sur la home, avec un bouton "En profiter".

### 8.1 Étape 1 — choisir les clés

Selon `naming-conventions.md` :

```
marketing.promo_banner.headline    → "Offre limitée"
marketing.promo_banner.subtext     → "Le rituel ongles à -15% jusqu'au 30 juin"
marketing.promo_banner.cta         → "En profiter"
marketing.promo_banner.dismiss_aria → "Fermer la bannière"
```

### 8.2 Étape 2 — éditer `messages/fr.json`

```json
{
  "marketing": {
    "promo_banner": {
      "headline": "Offre limitée",
      "subtext": "Le rituel ongles à -15% jusqu'au 30 juin",
      "cta": "En profiter",
      "dismiss_aria": "Fermer la bannière"
    }
  }
}
```

### 8.3 Étape 3 — codegen

```bash
pnpm i18n:codegen
# → met à jour src/types/next-intl.d.ts
```

### 8.4 Étape 4 — créer le composant

```tsx
// src/components/marketing/PromoBanner.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function PromoBanner() {
  const t = useTranslations('marketing.promo_banner');
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label={t('headline')}
      className="bg-amber-50 ps-4 pe-4 py-3 flex items-center gap-3"
    >
      <div className="grow">
        <p className="font-semibold">{t('headline')}</p>
        <p className="text-sm text-muted-foreground">{t('subtext')}</p>
      </div>
      <button type="button">{t('cta')}</button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={t('dismiss_aria')}
      >
        ×
      </button>
    </aside>
  );
}
```

### 8.5 Étape 5 — ajouter dans la home

```tsx
// src/app/[locale]/(marketing)/page.tsx
import { PromoBanner } from '@/components/marketing/PromoBanner';

export default function HomePage() {
  return (
    <>
      <PromoBanner />
      {/* ... */}
    </>
  );
}
```

### 8.6 Étape 6 — créer ticket traduction

Dans Crowdin (cf. `06-data-strategy/`), créer un task linké au PR avec :
- Liste des 4 nouvelles clés
- Contexte UX : screenshot du composant en FR
- Tone : "voix FemiGlow sobre, pas d'urgence factice — éviter !!!"

### 8.7 Étape 7 — tests

```ts
// PromoBanner.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import { PromoBanner } from '../PromoBanner';

describe('PromoBanner', () => {
  function setup() {
    return render(
      <NextIntlClientProvider locale="fr" messages={messagesFr}>
        <PromoBanner />
      </NextIntlClientProvider>,
    );
  }

  it('shows FR headline and CTA', () => {
    setup();
    expect(screen.getByText('Offre limitée')).toBeVisible();
    expect(screen.getByRole('button', { name: 'En profiter' })).toBeVisible();
  });

  it('hides on dismiss', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Fermer la bannière'));
    expect(screen.queryByText('Offre limitée')).toBeNull();
  });

  it('has accessible dismiss label', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Fermer la bannière' }))
      .toHaveAttribute('aria-label', 'Fermer la bannière');
  });
});
```

### 8.8 Étape 8 — commit

```bash
git add apps/web/messages/fr.json
git add apps/web/src/types/next-intl.d.ts
git add apps/web/src/components/marketing/PromoBanner.tsx
git add apps/web/src/app/[locale]/(marketing)/page.tsx
git add apps/web/src/components/marketing/PromoBanner.test.tsx
git commit -m "I18N-12: add promo banner with 4 i18n keys (FR canonical)"
```

Pre-commit hook s'exécute → tous gates passent → commit OK.

## 9. Renommer une clé (rare)

Procédure stricte (sans casser AR/EN traduction Crowdin) :

### 9.1 Phase 1 — soft deprecation

Dans `messages/fr.json` :

```json
{
  "marketing": {
    "kit": {
      "old_cta": "Découvrir",     // DEPRECATED, à supprimer après 2 sem
      "cta_primary": "Découvrir"  // nouvelle clé
    }
  }
}
```

Dans `messages/_deprecated.json` :

```json
{
  "marketing.kit.old_cta": {
    "deprecated_at": "2026-05-27",
    "replaced_by": "marketing.kit.cta_primary",
    "remove_after": "2026-06-10"
  }
}
```

### 9.2 Phase 2 — migration code

Tous les `t('marketing.kit.old_cta')` → `t('marketing.kit.cta_primary')`.

### 9.3 Phase 3 — purge

Après confirmation (Sentry n'a remonté aucun usage de l'ancienne) :
- Supprimer `marketing.kit.old_cta` de FR/AR/EN
- Supprimer entry de `_deprecated.json`
- Update changelog `messages/CHANGELOG.md`

## 10. Anti-patterns

### 10.1 Clé construite dynamiquement non-typée

```tsx
// MAUVAIS
const key = `marketing.${section}.${item}`;
t(key); // TS pleure, codegen ne voit rien
```

**Bon** : utiliser une union typée.

```tsx
type Section = 'kit' | 'rituel';
type Item = 'title' | 'cta';
function getString(section: Section, item: Item) {
  return useTranslations()(`marketing.${section}.${item}` as const);
}
```

### 10.2 Clé trop générique

```json
{ "common": { "title": "Bonjour" } }  // MAUVAIS, ambigu
```

**Bon** : namespace précis.

```json
{ "marketing.hero.title": "Bonjour" }
```

### 10.3 Strings dans le code de tests

Si un test inclut "Bonjour" hardcodé, ESLint déclenche faux positifs. Solution : whitelist `**/*.test.tsx`.

### 10.4 JSON désordonné

Commit qui mélange clés sans tri → diffs Git énormes, merge conflicts garantis. Forcer tri alphabétique via `pnpm i18n:format`.

## 11. Outils CLI résumé

| Commande | Action |
|---|---|
| `pnpm i18n:codegen` | Génère `src/types/next-intl.d.ts` depuis `messages/fr.json` |
| `pnpm i18n:format` | Trie alphabétiquement les clés dans tous les `messages/*.json` |
| `pnpm i18n:extract-keys` | Scan code → vérifie coverage + orphan |
| `pnpm i18n:extract-keys --fix` | Idem + auto-add placeholders FR |
| `pnpm i18n:validate-keys` | Lint structure JSON contre `translation-keys-schema.json` |
| `pnpm i18n:check-coverage` | % traduit par locale (avec seuil bloquant) |
| `pnpm i18n:export-csv --locale=ar` | Export pour traducteur externe |
| `pnpm i18n:import-csv` | Import retour traducteur |

## 12. Checklist ajout d'une clé

- [ ] Clé respecte `naming-conventions.md` (lowercase, hiérarchique, point séparateur, max 5 niveaux)
- [ ] Valeur FR ajoutée dans `messages/fr.json` (tri alphabétique respecté)
- [ ] `pnpm i18n:codegen` lancé → `src/types/next-intl.d.ts` à jour
- [ ] Usage dans le code passe TS check (autocomplete OK)
- [ ] Pas de typo dans la clé (test Vitest snapshot ne casse pas)
- [ ] Si la string contient des placeholders (`{name}`), tests interpolation OK
- [ ] `pnpm i18n:extract-keys` ne signale ni orphan ni missing
- [ ] ESLint `i18n/no-hardcoded-strings` ne trouve plus de string en dur autour
- [ ] Ticket Crowdin créé pour traduction AR/EN
- [ ] PR description : capture FR + commentaire "AR/EN à venir via Crowdin"
- [ ] Coverage FR = 100% après commit
