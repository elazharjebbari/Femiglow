# Migration historique — du FR hardcoded vers messages.json

> Comment migrer les **~600-800 strings FR hardcoded** dispersées dans `apps/web/src/` vers `messages/fr.json`, de manière méthodique, non-régressive et auditable. Plan d'extraction, outils AST, gestion des cas borderlines, rollback, estimation effort.

## 1. Contexte et volumétrie

### 1.1 État actuel (audit 27 mai 2026)

Cf. [`00-context/etat-actuel.md`](../00-context/etat-actuel.md) § 3 :

| Source | Strings FR estimés | Multilingue ? |
|---|---|---|
| Pages marketing (`/`, `/maison`, `/kit`, `/rituel`, `/contact`, `/journal`) | ~400 | ❌ |
| Headers / footers / nav | ~30 | ❌ |
| Sections marketing réutilisables (`(marketing)/sections/`) | ~100 | ❌ |
| Composants UI (`components/ui/`) | ~20 | ❌ |
| Chat widget (`components/chat/`) | ~50 | ❌ |
| Pages légales (body_md DB) | 9 templates × ~5000 mots | ❌ (sera traité via DB) |
| Emails transactionnels | ~50 templates × 200 mots | ❌ |
| Wizard checkout | 0 hardcoded | ✅ déjà CHA-231 |
| Admin (`admin/`) | ~500 strings | ❌ MAIS hors scope V1 |

**Total à migrer V1** : **~600-800 strings code** + **9 pages légales body_md** + **~50 emails** = **~700 unités de travail**.

### 1.2 Pourquoi un script AST plutôt que sed/grep

Un simple `grep "<h1>"` capture certes les strings, mais rate :

- Strings dans des **template literals** : `` `Bonjour ${user.name}` ``
- Strings dans des **props enum** : `<Button label="Continuer" />`
- Strings dans des **conditional rendering** : `{loading ? 'Chargement…' : 'Prêt'}`
- Strings dans des **constantes hors JSX** : `const TITLE = 'Le rituel'`
- Strings dans des **JSDoc** ou **commentaires** (à ignorer)

Un parser AST (TypeScript Compiler API via `ts-morph`) lit l'arbre syntaxique → comprend le contexte → ne se trompe pas.

## 2. Stratégie générale de migration

### 2.1 Approche par vagues (waves)

On découpe par **priorité métier + risque** :

```
Vague 1 (1 semaine) — Critical path
  → marketing.home, marketing.kit, navigation, common, errors
  → ~200 strings

Vague 2 (1 semaine) — Marketing complète
  → marketing.maison, marketing.rituel, marketing.contact, marketing.journal
  → ~250 strings

Vague 3 (1 semaine) — Side surfaces
  → email templates, SEO metadata, JSON-LD, footer, chat widget
  → ~200 strings

Vague 4 (en continu) — Polish
  → orphan keys cleanup, refactor pluralization, edge cases
  → ~100 strings ajustés
```

### 2.2 Critères pour chaque vague

- **Vague 1** = pages les plus visitées (`/`, `/kit`). Tester d'abord les composants high-traffic.
- **Vague 2** = compléter le marketing. À ce stade, ESLint rule peut bloquer toute nouvelle string hardcoded.
- **Vague 3** = surfaces secondaires mais visibles (SEO, emails — impact funnel).
- **Vague 4** = nettoyage continu — pas une vague datée.

## 3. Outils techniques

### 3.1 Stack d'extraction

| Outil | Rôle | Pourquoi |
|---|---|---|
| **`ts-morph`** | Parser AST TypeScript | Le plus mature pour TS/TSX, API ergonomique |
| **`fast-glob`** | Scanner les fichiers | Patterns gitignore-style |
| **`@formatjs/cli`** | Validation ICU MessageFormat | Détecte plurals/numbers incorrects |
| **`prettier`** | Format JSON output | Tri alphabétique, indentation cohérente |
| **ESLint custom rule** | `i18n/no-hardcoded-strings` | Prévient les régressions futures |
| **Husky pre-commit** | Bloque commits avec hardcode | Garde la pression à long terme |

### 3.2 Pourquoi pas `i18next-extract`

- Conçu pour `i18next` (pattern `t('key')`), pas adapté à un FemiGlow encore en pré-extraction.
- Moins de flexibilité sur les conventions de naming personnalisées.
- `ts-morph` permet de TOUT contrôler.

## 4. Le script `extract-strings.ts` (référence)

Localisation prévue : `apps/web/scripts/i18n/extract-strings.ts`

### 4.1 Architecture

```ts
/**
 * Script d'extraction des strings FR hardcoded vers messages/_extracted_pending.json
 *
 * Lit src/app/(marketing) et src/components, identifie les strings FR via AST,
 * propose des clés normalisées, output JSON pour review humain.
 *
 * Usage :
 *   pnpm i18n:extract                          # tout src/
 *   pnpm i18n:extract --scope=marketing         # juste (marketing)/
 *   pnpm i18n:extract --scope=components/chat   # juste chat
 *   pnpm i18n:extract --dry-run                 # output stdout, no write
 *   pnpm i18n:extract --threshold=3             # ignore strings < 3 chars
 *
 * Output :
 *   apps/web/messages/_extracted_pending.json
 *
 * Process humain post-extract :
 *   1. Founder ouvre _extracted_pending.json
 *   2. Renomme les clés mal nommées
 *   3. Marque les non-strings (commentaires/URLs/etc.) avec _ignore: true
 *   4. Merge dans messages/fr.json
 *   5. Supprime _extracted_pending.json
 */

import { Project, SyntaxKind, Node, JsxText, StringLiteral } from 'ts-morph';
import * as fg from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ExtractedString {
  rawValue: string;
  suggestedKey: string;
  namespace: string;
  context: string;          // file:line
  surroundingNode: string;  // type de noeud parent (JsxText, JsxAttribute, etc.)
  fileRelPath: string;
  ignored: boolean;
  reason?: string;          // si ignored, pourquoi
}

const FR_HEURISTICS = {
  // Tokens fréquents en français pour scorer la probabilité
  prepositions: ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'à', 'au', 'aux'],
  conjunctions: ['et', 'ou', 'mais', 'donc', 'car'],
  // Caractères français spécifiques
  specialChars: /[éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]/,
};

const IGNORE_PATTERNS = [
  // URLs
  /^https?:\/\//,
  /^\/api\//,
  // CSS class names
  /^[a-z-_]+:[a-z-_]+/,
  // Single chars or whitespace
  /^.$/,
  /^\s+$/,
  // Identifiers / variable names
  /^[a-z_][a-zA-Z0-9_]*$/,
  // Number patterns
  /^\d+(\.\d+)?(%|px|rem|em)?$/,
  // emoji-only
  /^[\p{Emoji}\s]+$/u,
];

function isLikelyFrenchString(s: string, ctx: string): boolean {
  if (s.length < 3) return false;
  if (IGNORE_PATTERNS.some((re) => re.test(s.trim()))) return false;

  const lower = s.toLowerCase();

  // Heuristique 1 : contient un caractère français spécifique
  if (FR_HEURISTICS.specialChars.test(s)) return true;

  // Heuristique 2 : contient au moins 2 mots dont 1 préposition/article FR
  const words = lower.split(/\s+/);
  if (words.length >= 2) {
    const hasPrep = words.some((w) =>
      FR_HEURISTICS.prepositions.includes(w) ||
      FR_HEURISTICS.conjunctions.includes(w)
    );
    if (hasPrep) return true;
  }

  // Heuristique 3 : contient des mots "longs" probablement FR
  if (words.length >= 1 && words.every((w) => w.length >= 4 && /^[a-zà-ÿ]+$/i.test(w))) {
    return true;
  }

  return false;
}

function suggestKey(value: string, fileRelPath: string, namespace: string): string {
  // Slugify
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)        // max 5 mots
    .join('_');

  return `${namespace}.${slug}`;
}

function detectNamespace(fileRelPath: string): string {
  if (fileRelPath.includes('(marketing)/kit')) return 'marketing.kit';
  if (fileRelPath.includes('(marketing)/maison')) return 'marketing.maison';
  if (fileRelPath.includes('(marketing)/rituel')) return 'marketing.rituel';
  if (fileRelPath.includes('(marketing)/contact')) return 'marketing.contact';
  if (fileRelPath.includes('(marketing)/journal')) return 'marketing.journal';
  if (fileRelPath.includes('(marketing)/page.tsx')) return 'marketing.home';
  if (fileRelPath.includes('components/chat')) return 'chat';
  if (fileRelPath.includes('components/header') || fileRelPath.includes('components/footer')) return 'navigation';
  if (fileRelPath.includes('components/ui')) return 'common';
  if (fileRelPath.includes('lib/mail/templates')) return 'email';
  if (fileRelPath.includes('app/api') && fileRelPath.includes('error')) return 'errors';
  return 'misc';
}

async function extractFromProject(opts: {
  scope?: string;
  threshold: number;
  dryRun: boolean;
}): Promise<ExtractedString[]> {
  const project = new Project({
    tsConfigFilePath: 'apps/web/tsconfig.json',
  });

  const globPattern = opts.scope
    ? `apps/web/src/${opts.scope}/**/*.{ts,tsx}`
    : 'apps/web/src/**/*.{ts,tsx}';

  const files = await fg(globPattern, {
    ignore: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/node_modules/**',
      '**/__tests__/**',
      '**/test/**',
    ],
  });

  console.log(`Scanning ${files.length} files...`);

  const extracted: ExtractedString[] = [];

  for (const file of files) {
    const sf = project.addSourceFileAtPath(file);
    const fileRelPath = path.relative('apps/web/src', file);

    // 1. JsxText (texte entre <span>ICI</span>)
    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.JsxText) {
        const text = (node as JsxText).getLiteralText().trim();
        if (!text) return;
        if (text.length < opts.threshold) return;
        if (!isLikelyFrenchString(text, fileRelPath)) return;

        const namespace = detectNamespace(fileRelPath);
        extracted.push({
          rawValue: text,
          suggestedKey: suggestKey(text, fileRelPath, namespace),
          namespace,
          context: `${file}:${node.getStartLineNumber()}`,
          surroundingNode: 'JsxText',
          fileRelPath,
          ignored: false,
        });
      }

      // 2. JsxAttribute (props string : <Button label="ICI" />)
      if (node.getKind() === SyntaxKind.JsxAttribute) {
        const attr = node.asKind(SyntaxKind.JsxAttribute);
        if (!attr) return;
        const init = attr.getInitializer();
        if (!init) return;
        if (init.getKind() === SyntaxKind.StringLiteral) {
          const literal = (init as StringLiteral).getLiteralValue();
          const attrName = attr.getName();

          // Liste blanche : props qui contiennent du texte visible
          const TEXT_PROPS = ['label', 'placeholder', 'title', 'alt', 'aria-label', 'heading', 'description'];
          if (!TEXT_PROPS.includes(attrName)) return;
          if (literal.length < opts.threshold) return;
          if (!isLikelyFrenchString(literal, fileRelPath)) return;

          const namespace = detectNamespace(fileRelPath);
          extracted.push({
            rawValue: literal,
            suggestedKey: suggestKey(literal, fileRelPath, namespace),
            namespace,
            context: `${file}:${node.getStartLineNumber()} (prop: ${attrName})`,
            surroundingNode: `JsxAttribute(${attrName})`,
            fileRelPath,
            ignored: false,
          });
        }
      }

      // 3. StringLiteral hors JSX (const, return statement)
      if (node.getKind() === SyntaxKind.StringLiteral && !isInJsx(node)) {
        const literal = (node as StringLiteral).getLiteralValue();
        if (literal.length < opts.threshold) return;
        if (!isLikelyFrenchString(literal, fileRelPath)) return;

        const namespace = detectNamespace(fileRelPath);
        extracted.push({
          rawValue: literal,
          suggestedKey: suggestKey(literal, fileRelPath, namespace),
          namespace,
          context: `${file}:${node.getStartLineNumber()}`,
          surroundingNode: 'StringLiteral',
          fileRelPath,
          ignored: false,
        });
      }
    });
  }

  return dedupe(extracted);
}

function isInJsx(node: Node): boolean {
  let cur: Node | undefined = node.getParent();
  while (cur) {
    if (
      cur.getKind() === SyntaxKind.JsxElement ||
      cur.getKind() === SyntaxKind.JsxOpeningElement ||
      cur.getKind() === SyntaxKind.JsxAttribute
    ) return true;
    cur = cur.getParent();
  }
  return false;
}

function dedupe(items: ExtractedString[]): ExtractedString[] {
  const seen = new Map<string, ExtractedString>();
  for (const item of items) {
    const key = `${item.rawValue}::${item.namespace}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// Main
const args = process.argv.slice(2);
const scope = args.find((a) => a.startsWith('--scope='))?.split('=')[1];
const threshold = parseInt(args.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '3', 10);
const dryRun = args.includes('--dry-run');

(async () => {
  const extracted = await extractFromProject({ scope, threshold, dryRun });
  console.log(`Extracted ${extracted.length} unique strings`);

  if (dryRun) {
    console.log(JSON.stringify(extracted, null, 2));
    return;
  }

  // Group by namespace for output
  const grouped: Record<string, ExtractedString[]> = {};
  for (const e of extracted) {
    const ns = e.namespace.split('.')[0];
    if (!grouped[ns]) grouped[ns] = [];
    grouped[ns].push(e);
  }

  const outputPath = 'apps/web/messages/_extracted_pending.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    _meta: {
      extractedAt: new Date().toISOString(),
      totalCount: extracted.length,
      scope: scope ?? 'all',
      thresholdChars: threshold,
    },
    extracted: grouped,
  }, null, 2));

  console.log(`Written to ${outputPath}`);
})();
```

### 4.2 Output exemple

```json
{
  "_meta": {
    "extractedAt": "2026-05-27T15:00:00Z",
    "totalCount": 612,
    "scope": "all",
    "thresholdChars": 3
  },
  "extracted": {
    "marketing": [
      {
        "rawValue": "Le rituel ongles, en cinq minutes.",
        "suggestedKey": "marketing.home.le_rituel_ongles_en_cinq",
        "namespace": "marketing.home",
        "context": "apps/web/src/app/(marketing)/page.tsx:42",
        "surroundingNode": "JsxText",
        "fileRelPath": "app/(marketing)/page.tsx",
        "ignored": false
      },
      {
        "rawValue": "Trois gestes, une saison.",
        "suggestedKey": "marketing.home.trois_gestes_une_saison",
        "namespace": "marketing.home",
        "context": "apps/web/src/app/(marketing)/page.tsx:43",
        "surroundingNode": "JsxText",
        "fileRelPath": "app/(marketing)/page.tsx",
        "ignored": false
      }
    ],
    "navigation": [
      {
        "rawValue": "Accueil",
        "suggestedKey": "navigation.accueil",
        "namespace": "navigation",
        "context": "apps/web/src/components/header.tsx:18",
        "surroundingNode": "JsxText",
        "fileRelPath": "components/header.tsx",
        "ignored": false
      }
    ]
  }
}
```

## 5. Process review humain

### 5.1 Étape 1 — Founder ouvre `_extracted_pending.json`

Le fichier peut faire ~600 lignes. Workflow :

1. Tri par namespace (l'output l'est déjà).
2. Pour chaque entry :
   - Renommer `suggestedKey` si trop verbeux ou mal nommé.
   - Marquer `ignored: true` + ajouter `reason` si c'est un faux positif (URL, classname, etc.).
   - Reclassifier `namespace` si nécessaire (`misc` → quelque chose de plus précis).

### 5.2 Étape 2 — Validation des clés

Critères :

- ✅ La clé suit `<namespace>.<section>.<element>` (cf. `naming-conventions.md`).
- ✅ La clé est unique (pas de doublon dans le fichier final `messages/fr.json`).
- ✅ Pas plus de 5 niveaux de profondeur.
- ✅ Valeur source bien capturée (pas de troncature).

### 5.3 Étape 3 — Merge dans `messages/fr.json`

Script helper (à créer dans Phase 1) :

```bash
pnpm i18n:merge-extracted
```

Qui :

1. Lit `_extracted_pending.json` (review humaine validée).
2. Filtre `ignored: true`.
3. Construit l'arbre JSON nested (`marketing.hero.title` → `marketing: { hero: { title: ... }}`).
4. Merge dans `messages/fr.json` (préserve ce qui existe déjà).
5. Trie alphabétiquement.
6. Run prettier.
7. Optionnel : supprime `_extracted_pending.json`.

### 5.4 Étape 4 — Refactor des fichiers source

Pour chaque entry mergée, remplacer le hardcode par `t('key')` :

**Avant** :
```tsx
// apps/web/src/app/(marketing)/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>Le rituel ongles, en cinq minutes.</h1>
      <p>Trois gestes, une saison.</p>
    </main>
  );
}
```

**Après** :
```tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('marketing.home');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </main>
  );
}
```

⚠️ Cette étape est **manuelle**, fichier par fichier. Pourquoi pas auto :

- Risque de casser le JSX dans des conditional rendering.
- Variabilité d'appel (`t('...')` vs `t.rich('...')` vs `getTranslations` côté server).
- Besoin de tester chaque page après le refactor.

**Estimation** : ~ 5-10 fichiers par jour si soigné = 1-2 semaines pour 100 fichiers.

## 6. Cas borderlines à gérer

### 6.1 String concatenation

```tsx
const greeting = "Bonjour " + user.name + ", bienvenue.";
```

**Solution** : ICU MessageFormat avec placeholder.

```json
// messages/fr.json
{ "common.greeting": "Bonjour {name}, bienvenue." }
```

```tsx
t('common.greeting', { name: user.name });
```

### 6.2 Template literal

```tsx
const msg = `Vous avez ${count} articles dans votre panier.`;
```

**Solution** : ICU plural.

```json
{
  "marketing.cart.items_count": "{count, plural, =0 {Panier vide} one {1 article dans votre panier} other {# articles dans votre panier}}"
}
```

```tsx
t('marketing.cart.items_count', { count });
```

### 6.3 Conditional rendering

```tsx
<button>
  {loading ? 'Chargement…' : 'Continuer'}
</button>
```

**Solution** : deux clés distinctes ou ICU select.

```json
{
  "common.loading": "Chargement…",
  "common.continue": "Continuer"
}
```

```tsx
<button>{loading ? t('common.loading') : t('common.continue')}</button>
```

### 6.4 t.rich (HTML embedded)

```tsx
<p>
  Notre <strong>kit</strong> est <em>limité</em>.
</p>
```

**Solution** : `t.rich` avec marqueurs.

```json
{
  "marketing.kit.scarcity": "Notre <bold>kit</bold> est <italic>limité</italic>."
}
```

```tsx
t.rich('marketing.kit.scarcity', {
  bold: (c) => <strong>{c}</strong>,
  italic: (c) => <em>{c}</em>,
});
```

### 6.5 Props enum (Button variants)

```tsx
<Button variant="primary" label="Continuer" />
```

**Cas A** : `label` est traduisible → extraire.
```tsx
<Button variant="primary" label={t('common.continue')} />
```

**Cas B** : `variant` est un literal type, PAS traduisible. Le script l'ignore via whitelist.

### 6.6 Plain strings dans des objets

```tsx
const features = [
  { icon: '🌿', title: 'Naturel', description: 'Ingrédients tracés' },
  { icon: '⏱', title: '5 minutes', description: 'Rituel rapide' },
];
```

**Solution** : déplacer en JSON.

```json
{
  "marketing.kit.features.0.title": "Naturel",
  "marketing.kit.features.0.description": "Ingrédients tracés",
  "marketing.kit.features.1.title": "5 minutes",
  "marketing.kit.features.1.description": "Rituel rapide"
}
```

Ou (mieux) : extraire en objet structuré JSON puis traduire les valeurs textuelles.

### 6.7 Metadata Next.js

```tsx
export const metadata: Metadata = {
  title: 'Le kit FemiGlow — Rituel ongles 5 minutes',
  description: 'Tout pour un rituel ongles complet.',
};
```

**Solution** : `generateMetadata` async.

```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });
  return {
    title: t('title'),
    description: t('description'),
  };
}
```

### 6.8 SQL / inline JSON

```tsx
const PAYMENT_LABELS = {
  CMI: 'Carte bancaire',
  COD: 'Paiement à la livraison',
};
```

**Solution** : extraire les valeurs.

```json
{
  "wizard.payment.method.cmi": "Carte bancaire",
  "wizard.payment.method.cod": "Paiement à la livraison"
}
```

```tsx
const PAYMENT_LABELS = (t: Translator) => ({
  CMI: t('wizard.payment.method.cmi'),
  COD: t('wizard.payment.method.cod'),
});
```

## 7. Validation manuelle systématique

### 7.1 Checklist par fichier refactoré

- [ ] Aucune string FR > 3 chars n'apparaît plus dans le fichier (sauf `_ignore` documenté).
- [ ] Imports `useTranslations` ou `getTranslations` présents.
- [ ] Snapshots Vitest mis à jour (`pnpm test --update`).
- [ ] Tests Playwright relancés sur la page concernée.
- [ ] Rendu visuel identique (compare avant/après dans browser).
- [ ] Pas de drift markup (HTML structure identique).

### 7.2 ESLint rule en gate

`apps/web/.eslintrc.json` :

```json
{
  "rules": {
    "i18n/no-hardcoded-strings": ["error", {
      "ignoreProps": ["variant", "color", "icon", "name", "id", "type"],
      "minLength": 3,
      "frenchHeuristic": true
    }]
  }
}
```

Bloque tout PR qui réintroduit des strings FR hardcoded > 3 chars.

### 7.3 CI gates

```yaml
# .github/workflows/i18n-check.yml
name: i18n coverage
on:
  pull_request:
    paths: ['apps/web/src/**', 'apps/web/messages/**']

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm i18n:validate-keys      # Schema valid
      - run: pnpm i18n:check-coverage     # FR=100%, AR/EN >= 90%
      - run: pnpm i18n:no-orphan-keys     # Pas de clés mortes
      - run: pnpm eslint apps/web/src     # Aucun hardcode FR
```

## 8. Rollback plan

### 8.1 Si une régression apparaît post-refactor

**Cas 1 — une string ne s'affiche pas (clé manquante)**

```
Symptôme : <h1>{t('marketing.hero.title')}</h1> affiche "marketing.hero.title"
```

Root cause : clé absente de `messages/fr.json`.

Fix immédiat :
```bash
git revert <commit-refactor>
# Push hotfix
```

Fix propre :
1. Identifier la clé manquante.
2. Ajouter dans `messages/fr.json`.
3. Re-déployer.

**Cas 2 — fallback infini (loop)**

```
Symptôme : page très lente, log Sentry "i18n.fallback_used" en boucle
```

Root cause : `fallback_locale` chain mal configurée (ex: `fr → en → fr`).

Fix :
```sql
UPDATE i18n_locales SET fallback_locale = NULL WHERE code = 'fr';
```

**Cas 3 — toute la page est en clés brutes**

```
Symptôme : "marketing.hero.title" partout au lieu du texte.
```

Root cause : `NextIntlClientProvider` mal câblé ou `getRequestConfig` cassé.

Fix immédiat : revert le commit ou désactiver i18n via feature flag.

### 8.2 Feature flag pour rollback global

```bash
# Désactiver i18n côté Vercel
vercel env add I18N_ENABLED production
# Saisir: false

# Vercel redeploy
vercel --prod
```

Middleware :
```ts
// apps/web/middleware.ts
if (process.env.I18N_ENABLED !== 'true') {
  // Bypass locale routing : fallback comportement legacy FR-only
  return NextResponse.next();
}
```

→ Cf. `08-plan-action/rollback.md` pour plan détaillé.

### 8.3 Backup avant chaque vague

```bash
# Avant Vague 1
git tag pre-i18n-wave-1
git push --tags

# Branch dédiée
git checkout -b feat/i18n-wave-1
```

Si problème : `git checkout pre-i18n-wave-1` ou `git revert` ciblé.

## 9. Estimation effort détaillée

### 9.1 Par activité

| Activité | Volume | Durée unitaire | Total |
|---|---|---|---|
| Setup script `extract-strings.ts` | 1 fois | 1.5 j | 1.5 j |
| Run extraction + review humaine | 600-800 strings | 0.5 min/string | 5-7 j |
| Refactor des composants (replace par `t()`) | ~100 fichiers | 30 min/fichier | 6-7 j |
| Tests unit relancés + snapshots | ~50 tests | 5 min/test | 0.5 j |
| Tests Playwright relancés | ~50 specs | 2 min/spec | 0.3 j |
| ESLint rule custom écriture | 1 fois | 1 j | 1 j |
| CI gates configuration | 1 fois | 0.5 j | 0.5 j |
| Buffer + imprévus | 20% | — | 3 j |
| **TOTAL** | | | **~18 jours (4 semaines)** |

### 9.2 Par persona

| Persona | Tâches | Durée |
|---|---|---|
| **Dev backend** | Script extract + ESLint rule + CI | 5 j |
| **Dev frontend** | Refactor composants + tests | 8 j |
| **Founder** | Review extracted + validation clés | 3 j |
| **QA** | Tests denses + regression | 2 j |

### 9.3 Comparaison avec autres approches

| Approche | Effort | Risque | Quality output |
|---|---|---|---|
| **Script AST + review manuel** (recommandé) | 4 sem | Faible | Élevée |
| Manuel pur (sans script) | 8-10 sem | Élevé (oublis) | Variable |
| Auto-translate API (DeepL) sans review | 1-2 sem | Très élevé (qualité) | Médiocre |
| Sub-contract complet à agence | 3-4 sem | Moyen (alignement marque) | Bonne si bon brief |

## 10. Pages légales — migration spécifique

### 10.1 Process spécifique

Les pages légales sont en `body_md` dans la table `legal_pages` (déjà multilingue). Le process diffère :

1. Exporter chaque page FR :
   ```sql
   SELECT slug, body_md FROM legal_pages WHERE locale='fr' AND status='published';
   ```
2. Sauvegarder en `.md` files dans `docs/legal-pages-translation-2026-05/exports/`.
3. Envoyer au traducteur (par locale).
4. Importer les retours :
   ```sql
   INSERT INTO legal_pages (id, slug, title, body_md, status, locale)
   VALUES (..., 'cgv', '[traduction]', '[traduction]', 'draft', 'ar');
   ```
5. Review founder → status='published'.

### 10.2 Templates impactés

| Slug | Volume FR | Estimation traduction par locale |
|---|---|---|
| `cgv` | 5000 mots | 8h |
| `mentions-legales` | 1500 mots | 3h |
| `confidentialite` | 3000 mots | 5h |
| `cookies` | 1000 mots | 2h |
| `retours-remboursements` | 2000 mots | 4h |
| `livraison` | 1500 mots | 3h |
| `paiement` | 1000 mots | 2h |
| `garantie` | 800 mots | 2h |
| `expedition-internationale` | 1500 mots | 3h |
| **Total par locale** | **17 300 mots** | **~32h (4 j)** |

Pour 2 locales (AR, EN) : ~64h (8 j) traducteur externe.

## 11. Emails transactionnels — migration spécifique

### 11.1 Templates impactés

Cf. `apps/web/src/lib/mail/templates/`.

| Template | Volume | Priority |
|---|---|---|
| `welcome` | 100 mots | P1 |
| `order-confirmation` | 200 mots | P0 |
| `order-shipped` | 150 mots | P0 |
| `order-delivered` | 150 mots | P0 |
| `password-reset` | 100 mots | P0 |
| `newsletter` | 300 mots | P2 |
| `cart-abandoned` | 200 mots | P1 |
| ... |  |  |

### 11.2 Approche

Templates sont déjà des fichiers `.tsx` (React Email). Process :

1. Extraire les strings via `extract-strings.ts` avec scope=`lib/mail/templates`.
2. Refactor en `t()` calls (côté server).
3. `messages/[locale].json` namespace `email.*`.

Subject lines : extra attention (max 50 chars souvent, mobile crop).

## 12. Anti-patterns à éviter

1. **Refactor + extraction dans le même commit** : impossible à reviewer. Faire 2 PRs : (a) ajout dans `messages/fr.json`, (b) refactor du composant.

2. **Modifier directement `_extracted_pending.json` et le committer** : ce fichier est temporaire. Doit être supprimé après merge.

3. **Oublier de mettre à jour les snapshots** : si tests font snapshot du rendu, le HTML change pas mais le `data-testid` peut bouger. Relancer `pnpm test --update`.

4. **Migrer admin en V1** : hors scope. Bloquer ESLint rule pour `src/app/admin/**` ou whitelist.

5. **Extraire les URLs / classnames** : faux positifs. Toujours filtrer via `IGNORE_PATTERNS`.

6. **Pas de fallback testé** : si une clé manque en AR mais pas en FR, le visiteur AR doit voir le FR. Tester explicitement.

7. **Forget pluralization** : si tu vois `${count} articles`, c'est un plural ICU, pas une string statique.

8. **Refactor sans tester** : chaque page refactorée doit être testée manuellement (browser) + automatisé (Playwright).

## 13. Métriques de progression

À tracker dans un dashboard pendant la migration :

| Métrique | Outil | Objectif fin Phase 2 |
|---|---|---|
| Strings FR hardcoded restant | `grep -rE` sur src/ | 0 dans marketing |
| Clés dans `messages/fr.json` | `jq '. | leaves | length' fr.json` | ~600-800 |
| Coverage AR | `pnpm i18n:coverage --locale=ar` | ≥ 90% |
| Coverage EN | idem | ≥ 90% |
| Fichiers refactorés | `git log --diff-filter=M --name-only` count | ~100 |
| ESLint errors `no-hardcoded` | CI report | 0 |
| Snapshot drift | `pnpm test --reporter=verbose` | 0 régressions |

## 14. Checklist de migration historique

### Phase de préparation
- [ ] Décision GO sur stratégie d'extraction
- [ ] Migration 0076 `i18n_locales` appliquée
- [ ] Script `extract-strings.ts` créé et testé sur 1 fichier
- [ ] ESLint rule `i18n/no-hardcoded-strings` écrite
- [ ] CI gates configurées
- [ ] Backup git tag créé (`pre-i18n-extraction`)

### Vague 1 — Critical path (1 sem)
- [ ] `pnpm i18n:extract --scope=app/(marketing)/page.tsx` → review
- [ ] `pnpm i18n:extract --scope=app/(marketing)/kit` → review
- [ ] Refactor home + kit
- [ ] Tests verts
- [ ] Smoke test prod-like

### Vague 2 — Marketing complète (1 sem)
- [ ] `pnpm i18n:extract --scope=app/(marketing)/maison`
- [ ] `pnpm i18n:extract --scope=app/(marketing)/rituel`
- [ ] `pnpm i18n:extract --scope=app/(marketing)/contact`
- [ ] `pnpm i18n:extract --scope=app/(marketing)/journal`
- [ ] Refactor chaque sous-route
- [ ] Tests verts

### Vague 3 — Side surfaces (1 sem)
- [ ] Emails transactionnels migrés
- [ ] SEO metadata + JSON-LD migrés
- [ ] Footer + header components migrés
- [ ] Chat widget migré (hors wizard CHA-231)

### Vague 4 — Polish (continu)
- [ ] Audit ESLint full repo
- [ ] Cleanup `_extracted_pending.json`
- [ ] Coverage 100% FR confirmée
- [ ] Doc mise à jour (CLAUDE.md, README projet)

### Post-migration
- [ ] Export CSV envoyée au traducteur
- [ ] Glossaire FemiGlow distribué
- [ ] Plan workflow translateur partagé
- [ ] Coverage tracking dashboard live
- [ ] Sentry alerts configurées (missing keys)

## 15. Références croisées

- Inventory CSV : [`./translation-keys-inventory.csv`](./translation-keys-inventory.csv)
- Workflow translateur : [`./workflow-translation.md`](./workflow-translation.md)
- Content extraction détail : [`./content-extraction.md`](./content-extraction.md)
- Naming conventions : [`../02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md)
- Translation store : [`../03-backend/translation-store.md`](../03-backend/translation-store.md)
- Plan global phases : [`../08-plan-action/phases.md`](../08-plan-action/phases.md)
- Rollback : [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md)
