# Content extraction — extraire les strings hardcoded

> Comment extraire automatiquement les strings FR hardcoded dispersées dans `apps/web/src/` vers des clés normalisées dans `messages/[locale].json`. Outils AST, script TypeScript détaillé, gestion des cas spéciaux, workflow review humain.

## 1. Pourquoi un script d'extraction

### 1.1 L'alternative manuelle est intenable

Avec ~600-800 strings à extraire :
- À 1 min/string : 10-13 heures de travail mécanique.
- Avec un humain, ~3% d'oubli garanti = ~20 strings manquées.
- Drift entre clés (ex: `marketing.hero.title` ici, `home.hero.label` ailleurs).

Un script AST :
- Termine en < 2 min sur l'ensemble du codebase
- Génère des clés normalisées
- Détecte 100% des strings (selon heuristique)
- Output reviewable par le founder

### 1.2 Différence avec un simple `grep`

```bash
# grep approche naïve
grep -rE '"[A-Z][a-zà-ÿ ,]+["]' apps/web/src/
```

Problèmes :
- Capture les URLs, classnames, identifiers
- Ne distingue pas FR de EN
- Ne reconstitue pas les template literals
- Ne comprend pas le contexte (props, JSX text, return value)

Un parser AST (ts-morph) lit le code comme TypeScript le ferait.

## 2. Stack d'outils

### 2.1 Outils retenus

| Outil | Rôle | Pourquoi |
|---|---|---|
| **`ts-morph`** | Wrapper TypeScript Compiler API | API ergonomique, traversée AST simple |
| **`fast-glob`** | Pattern matching fichiers | gitignore-style, performant |
| **`@formatjs/cli` (validation)** | Valide ICU MessageFormat | Build-time check des plurals/numbers |
| **`prettier`** | Format JSON output | Indentation cohérente, tri alphabétique |
| **`eslint-plugin-formatjs` ou custom rule** | Détection runtime de hardcode | Lint-time prevention |
| **`chalk`** | Couleurs CLI output | UX du script |

### 2.2 Outils écartés et pourquoi

| Outil | Raison du rejet |
|---|---|
| **`i18n-extract`** (npm) | Patterns rigides, ne gère pas FemiGlow conventions |
| **`@formatjs/cli extract`** | Conçu pour `<FormattedMessage>` style (react-intl), pas pour FemiGlow brut |
| **`react-i18next-extract`** | Lié à i18next, pas next-intl |
| **`grep + sed`** | Trop fragile, faux positifs/négatifs nombreux |
| **`@babel/parser`** | Plus bas niveau, plus complexe pour notre besoin |

## 3. Architecture du script

### 3.1 Pipeline complet

```
┌──────────────────┐
│  Source files    │
│  (TSX/TS)        │
└────────┬─────────┘
         │ fast-glob
         ▼
┌──────────────────┐
│  ts-morph parser │
│  (AST extraction)│
└────────┬─────────┘
         │ traverse
         ▼
┌──────────────────┐       ┌──────────────────┐
│ JsxText nodes    │──┐    │ Heuristic FR     │
│ JsxAttr nodes    │──┼───▶│ filter           │
│ StringLiteral    │──┘    │ (caractères, mots)│
│ TemplateLiteral  │       └────────┬─────────┘
└──────────────────┘                │
                                    ▼
                          ┌──────────────────┐
                          │ Key generator    │
                          │ (slug + namespace)│
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ Dedup + grouping │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ JSON output      │
                          │ _extracted_      │
                          │  pending.json    │
                          └────────┬─────────┘
                                   │
                                   ▼ Review humain
                          ┌──────────────────┐
                          │ messages/fr.json │
                          └──────────────────┘
```

### 3.2 Phases du script

1. **Scan** : récupérer la liste des fichiers à parser.
2. **Parse** : transformer chaque fichier en AST.
3. **Walk** : traverser chaque AST pour identifier les nœuds candidats.
4. **Filter** : appliquer l'heuristique FR pour éliminer les non-strings.
5. **Suggest** : générer une clé normalisée pour chaque string retenue.
6. **Dedup** : regrouper les doublons (même valeur + même namespace).
7. **Output** : écrire dans `_extracted_pending.json` structuré par namespace.

## 4. Script TypeScript complet (référence — ne pas créer dans apps/web sans GO)

Localisation prévue : `apps/web/scripts/i18n/extract-strings.ts`

### 4.1 Imports et types

```ts
/**
 * Extraction automatique des strings FR hardcoded.
 *
 * Usage :
 *   pnpm i18n:extract                              # tout src/
 *   pnpm i18n:extract --scope=app/(marketing)       # juste marketing
 *   pnpm i18n:extract --scope=components/chat       # juste chat
 *   pnpm i18n:extract --dry-run                     # stdout, pas d'écriture
 *   pnpm i18n:extract --threshold=4                 # ignore strings < 4 chars
 *   pnpm i18n:extract --include-ignored             # garde aussi les low-score
 */

import {
  Project,
  SyntaxKind,
  Node,
  JsxText,
  StringLiteral,
  NoSubstitutionTemplateLiteral,
  TemplateExpression,
  SourceFile,
} from 'ts-morph';
import fg from 'fast-glob';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

interface ExtractedString {
  rawValue: string;            // Valeur brute (sans quotes)
  normalizedValue: string;     // Trimmed, single-spaced
  suggestedKey: string;        // marketing.hero.title
  namespace: string;           // marketing.hero
  context: string;             // file:line:col
  surroundingNode: string;     // 'JsxText' | 'JsxAttribute(label)' | 'StringLiteral' | 'TemplateLiteral'
  fileRelPath: string;         // app/(marketing)/page.tsx
  scoreFr: number;             // 0..1 likelihood FR
  ignored: boolean;
  reason?: string;             // Si ignored : pourquoi
  hasInterpolation?: boolean;  // Pour template literals
}

interface ExtractOptions {
  scope?: string;
  dryRun: boolean;
  threshold: number;           // min length
  includeIgnored: boolean;
}
```

### 4.2 Heuristique de détection FR

```ts
const FR_PREPOSITIONS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'à', 'au', 'aux',
  'en', 'dans', 'sur', 'avec', 'sans', 'pour', 'par', 'vers',
]);

const FR_CONJUNCTIONS = new Set(['et', 'ou', 'mais', 'donc', 'or', 'ni', 'car']);

const FR_PRONOUNS = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'votre', 'notre', 'vos', 'nos']);

const FR_VERBS_COMMON = new Set([
  'est', 'sont', 'avoir', 'être', 'faire', 'aller', 'voir', 'savoir',
  'pouvoir', 'falloir', 'vouloir', 'venir', 'devoir', 'prendre',
  'continuer', 'enregistrer', 'envoyer', 'annuler', 'confirmer',
]);

const FR_SPECIAL_CHARS = /[éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]/;

const IGNORE_REGEX_PATTERNS = [
  /^https?:\/\//,                  // URLs
  /^\/api\//,                       // API paths
  /^[a-z-_]+:[a-z-_]+/i,            // CSS classes (responsive)
  /^[a-z_$][a-zA-Z0-9_$]*$/,        // JS identifiers
  /^\d+(\.\d+)?(%|px|rem|em|vh|vw)?$/, // Numbers / measurements
  /^[#@.]/,                          // Selectors, refs
  /^[<>\/=].+/,                      // HTML tags fragments
];

function scoreFrLikelihood(s: string): number {
  if (s.length < 3) return 0;
  if (IGNORE_REGEX_PATTERNS.some((re) => re.test(s.trim()))) return 0;
  if (/^[A-Z_]+$/.test(s)) return 0;  // CONSTANTS

  let score = 0;
  const lower = s.toLowerCase();
  const words = lower.split(/\s+/);

  // +0.5 : caractère français spécifique
  if (FR_SPECIAL_CHARS.test(s)) score += 0.5;

  // +0.3 par préposition/conjonction/pronoun trouvé (max +0.4)
  let prepCount = 0;
  for (const w of words) {
    if (FR_PREPOSITIONS.has(w) || FR_CONJUNCTIONS.has(w) || FR_PRONOUNS.has(w)) {
      prepCount++;
      if (prepCount >= 2) break;
    }
  }
  score += Math.min(prepCount * 0.2, 0.4);

  // +0.2 : verbe commun
  if (words.some((w) => FR_VERBS_COMMON.has(w))) score += 0.2;

  // +0.1 : multi-mots
  if (words.length >= 3) score += 0.1;

  // +0.15 : commence par majuscule (probable phrase)
  if (/^[A-ZÀ-Ÿ]/.test(s)) score += 0.15;

  // Plafonner à 1.0
  return Math.min(score, 1.0);
}

function isLikelyFrenchString(s: string): boolean {
  return scoreFrLikelihood(s) >= 0.4;
}
```

### 4.3 Détection du namespace par fichier

```ts
const NAMESPACE_RULES: Array<{ pattern: RegExp; namespace: string }> = [
  { pattern: /\(marketing\)\/page\.tsx$/, namespace: 'marketing.home' },
  { pattern: /\(marketing\)\/kit/, namespace: 'marketing.kit' },
  { pattern: /\(marketing\)\/maison/, namespace: 'marketing.maison' },
  { pattern: /\(marketing\)\/rituel/, namespace: 'marketing.rituel' },
  { pattern: /\(marketing\)\/contact/, namespace: 'marketing.contact' },
  { pattern: /\(marketing\)\/journal/, namespace: 'marketing.journal' },
  { pattern: /components\/chat/, namespace: 'chat' },
  { pattern: /components\/header/, namespace: 'navigation' },
  { pattern: /components\/footer/, namespace: 'navigation' },
  { pattern: /components\/ui/, namespace: 'common' },
  { pattern: /lib\/mail\/templates/, namespace: 'email' },
  { pattern: /not-found\.tsx$/, namespace: 'errors.404' },
  { pattern: /error\.tsx$/, namespace: 'errors.500' },
  { pattern: /\/legal\//, namespace: 'legal' },
];

function detectNamespace(fileRelPath: string): string {
  for (const rule of NAMESPACE_RULES) {
    if (rule.pattern.test(fileRelPath)) {
      return rule.namespace;
    }
  }
  return 'misc';
}
```

### 4.4 Génération de clé

```ts
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // diacritiques
    .replace(/[^a-z0-9\s]/g, '')             // ponctuation
    .trim()
    .split(/\s+/)
    .slice(0, 5)                              // max 5 mots
    .join('_')
    .substring(0, 50);                        // max 50 chars
}

function suggestKey(value: string, namespace: string, context: string): string {
  // Cas particuliers : strings très courtes -> on garde verbatim
  const SHORT_KEYS_MAP: Record<string, string> = {
    'Retour': 'back',
    'Continuer': 'continue',
    'Annuler': 'cancel',
    'Enregistrer': 'save',
    'Supprimer': 'delete',
    'Confirmer': 'confirm',
    'Fermer': 'close',
    'Oui': 'yes',
    'Non': 'no',
    'Accueil': 'home',
    'Contact': 'contact',
  };

  if (SHORT_KEYS_MAP[value]) {
    // Force namespace 'common' si court verbatim
    if (namespace.startsWith('common') || namespace.startsWith('navigation')) {
      return `${namespace}.${SHORT_KEYS_MAP[value]}`;
    }
  }

  const slug = slugify(value);
  if (!slug) {
    // Fallback : utiliser le context (file:line)
    return `${namespace}.unknown_${context.replace(/[^a-z0-9]/gi, '_')}`;
  }
  return `${namespace}.${slug}`;
}
```

### 4.5 Walk de l'AST

```ts
function extractFromSourceFile(
  sf: SourceFile,
  opts: ExtractOptions,
): ExtractedString[] {
  const filePath = sf.getFilePath();
  const fileRelPath = path.relative(path.resolve('apps/web/src'), filePath);
  const namespace = detectNamespace(fileRelPath);
  const results: ExtractedString[] = [];

  sf.forEachDescendant((node) => {
    // 1. JsxText (texte direct dans JSX)
    if (node.getKind() === SyntaxKind.JsxText) {
      const text = (node as JsxText).getLiteralText();
      const trimmed = text.trim();
      if (!trimmed || trimmed.length < opts.threshold) return;
      const score = scoreFrLikelihood(trimmed);
      if (score < 0.4 && !opts.includeIgnored) return;

      results.push({
        rawValue: trimmed,
        normalizedValue: trimmed.replace(/\s+/g, ' '),
        suggestedKey: suggestKey(trimmed, namespace, fileRelPath),
        namespace,
        context: `${filePath}:${node.getStartLineNumber()}`,
        surroundingNode: 'JsxText',
        fileRelPath,
        scoreFr: score,
        ignored: score < 0.4,
        reason: score < 0.4 ? 'Low FR likelihood' : undefined,
      });
    }

    // 2. JsxAttribute string ("label", "placeholder", etc.)
    if (node.getKind() === SyntaxKind.JsxAttribute) {
      const attr = node.asKind(SyntaxKind.JsxAttribute);
      if (!attr) return;
      const init = attr.getInitializer();
      if (!init || init.getKind() !== SyntaxKind.StringLiteral) return;

      const attrName = attr.getName();
      const TEXTUAL_PROPS = new Set([
        'label', 'placeholder', 'title', 'alt',
        'aria-label', 'aria-description', 'heading',
        'description', 'subtitle', 'caption',
      ]);

      if (!TEXTUAL_PROPS.has(attrName)) return;

      const literal = (init as StringLiteral).getLiteralValue();
      if (literal.length < opts.threshold) return;
      const score = scoreFrLikelihood(literal);
      if (score < 0.4 && !opts.includeIgnored) return;

      results.push({
        rawValue: literal,
        normalizedValue: literal,
        suggestedKey: suggestKey(literal, namespace, fileRelPath),
        namespace,
        context: `${filePath}:${node.getStartLineNumber()} (prop: ${attrName})`,
        surroundingNode: `JsxAttribute(${attrName})`,
        fileRelPath,
        scoreFr: score,
        ignored: score < 0.4,
      });
    }

    // 3. StringLiteral hors JSX (const, return)
    if (node.getKind() === SyntaxKind.StringLiteral && !isInsideJsxElement(node)) {
      const literal = (node as StringLiteral).getLiteralValue();
      if (literal.length < opts.threshold) return;
      const score = scoreFrLikelihood(literal);
      if (score < 0.4 && !opts.includeIgnored) return;

      // Skip si déjà dans un t() call (déjà i18n-ed)
      if (isInsideTranslationCall(node)) return;

      results.push({
        rawValue: literal,
        normalizedValue: literal,
        suggestedKey: suggestKey(literal, namespace, fileRelPath),
        namespace,
        context: `${filePath}:${node.getStartLineNumber()}`,
        surroundingNode: 'StringLiteral',
        fileRelPath,
        scoreFr: score,
        ignored: score < 0.4,
      });
    }

    // 4. NoSubstitutionTemplateLiteral ( `simple template` )
    if (node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const text = (node as NoSubstitutionTemplateLiteral).getLiteralValue();
      if (text.length < opts.threshold) return;
      const score = scoreFrLikelihood(text);
      if (score < 0.4 && !opts.includeIgnored) return;

      results.push({
        rawValue: text,
        normalizedValue: text,
        suggestedKey: suggestKey(text, namespace, fileRelPath),
        namespace,
        context: `${filePath}:${node.getStartLineNumber()}`,
        surroundingNode: 'TemplateLiteral',
        fileRelPath,
        scoreFr: score,
        ignored: score < 0.4,
      });
    }

    // 5. TemplateExpression ( `Bonjour ${name}` )
    // Plus complexe : on extrait les "head" + "spans middle" text parts
    if (node.getKind() === SyntaxKind.TemplateExpression) {
      const tpl = node as TemplateExpression;
      const head = tpl.getHead().getLiteralText();
      const middles = tpl.getTemplateSpans().map((s) => s.getLiteral().getLiteralText());
      const allText = [head, ...middles].filter((t) => t.trim().length > 0).join(' ');

      if (allText.length < opts.threshold) return;
      const score = scoreFrLikelihood(allText);
      if (score < 0.4 && !opts.includeIgnored) return;

      // Convertir en ICU MessageFormat : `Bonjour ${name}` → "Bonjour {name}"
      // Mais on a besoin du nom des variables interpolées
      const spans = tpl.getTemplateSpans();
      const placeholders = spans.map((s, i) => {
        const expr = s.getExpression().getText();
        return `{${expr.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '')}}`;
      });

      let icuValue = head;
      spans.forEach((s, i) => {
        icuValue += placeholders[i] + s.getLiteral().getLiteralText();
      });

      results.push({
        rawValue: icuValue,
        normalizedValue: icuValue,
        suggestedKey: suggestKey(allText, namespace, fileRelPath),
        namespace,
        context: `${filePath}:${node.getStartLineNumber()}`,
        surroundingNode: 'TemplateExpression',
        fileRelPath,
        scoreFr: score,
        ignored: score < 0.4,
        hasInterpolation: true,
      });
    }
  });

  return results;
}

function isInsideJsxElement(node: Node): boolean {
  let cur: Node | undefined = node.getParent();
  while (cur) {
    const kind = cur.getKind();
    if (
      kind === SyntaxKind.JsxElement ||
      kind === SyntaxKind.JsxOpeningElement ||
      kind === SyntaxKind.JsxSelfClosingElement
    ) return true;
    cur = cur.getParent();
  }
  return false;
}

function isInsideTranslationCall(node: Node): boolean {
  // Détecte si on est dans un t('...'), useTranslations(...)('...'), etc.
  const call = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
  if (!call) return false;
  const expr = call.getExpression().getText();
  return ['t', 'getTranslations', 'translate'].some((fn) => expr.startsWith(fn) || expr.endsWith(`.${fn}`));
}
```

### 4.6 Dedup et output

```ts
function dedupe(items: ExtractedString[]): ExtractedString[] {
  const seen = new Map<string, ExtractedString>();
  for (const item of items) {
    const key = `${item.normalizedValue}::${item.namespace}`;
    if (seen.has(key)) {
      // Garder le score le plus haut
      const existing = seen.get(key)!;
      if (item.scoreFr > existing.scoreFr) {
        seen.set(key, item);
      }
    } else {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
    return a.suggestedKey.localeCompare(b.suggestedKey);
  });
}

function writeOutput(items: ExtractedString[], scope: string, threshold: number): void {
  const grouped: Record<string, ExtractedString[]> = {};
  for (const it of items) {
    const ns = it.namespace.split('.')[0];
    if (!grouped[ns]) grouped[ns] = [];
    grouped[ns].push(it);
  }

  const outputPath = path.resolve('apps/web/messages/_extracted_pending.json');
  const output = {
    _meta: {
      extractedAt: new Date().toISOString(),
      totalCount: items.length,
      ignoredCount: items.filter((i) => i.ignored).length,
      scope,
      thresholdChars: threshold,
      scriptVersion: '1.0.0',
    },
    extracted: grouped,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(chalk.green(`[i18n:extract] Written to ${outputPath}`));
  console.log(chalk.cyan(`  Total : ${items.length}`));
  console.log(chalk.cyan(`  Active: ${items.filter((i) => !i.ignored).length}`));
  console.log(chalk.gray(`  Ignored: ${items.filter((i) => i.ignored).length}`));
}
```

### 4.7 Main bootstrap

```ts
async function main(opts: ExtractOptions) {
  console.log(chalk.blue('[i18n:extract] Starting...'));
  console.log(chalk.gray(`  scope = ${opts.scope ?? 'all'}`));
  console.log(chalk.gray(`  threshold = ${opts.threshold}`));
  console.log(chalk.gray(`  dryRun = ${opts.dryRun}`));

  const globPattern = opts.scope
    ? `apps/web/src/${opts.scope}/**/*.{ts,tsx}`
    : 'apps/web/src/**/*.{ts,tsx}';

  const files = await fg(globPattern, {
    ignore: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      '**/node_modules/**',
      '**/__tests__/**',
      '**/test/**',
      '**/messages/**',
    ],
    absolute: true,
  });

  console.log(chalk.cyan(`Scanning ${files.length} files...`));

  const project = new Project({
    tsConfigFilePath: 'apps/web/tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  });

  for (const file of files) {
    project.addSourceFileAtPath(file);
  }

  let allResults: ExtractedString[] = [];
  for (const sf of project.getSourceFiles()) {
    try {
      const fileResults = extractFromSourceFile(sf, opts);
      allResults = allResults.concat(fileResults);
    } catch (err) {
      console.warn(chalk.yellow(`[skip] ${sf.getFilePath()}: ${(err as Error).message}`));
    }
  }

  const deduped = dedupe(allResults);

  console.log(chalk.green(`Extracted ${deduped.length} unique candidates`));
  console.log(chalk.green(`  Active : ${deduped.filter((d) => !d.ignored).length}`));
  console.log(chalk.gray(`  Ignored: ${deduped.filter((d) => d.ignored).length}`));

  if (opts.dryRun) {
    console.log(chalk.yellow('\n--dry-run : no file written'));
    console.log(JSON.stringify(deduped.slice(0, 30), null, 2));
    return;
  }

  writeOutput(deduped, opts.scope ?? 'all', opts.threshold);
}

// CLI
const args = process.argv.slice(2);
const opts: ExtractOptions = {
  scope: args.find((a) => a.startsWith('--scope='))?.split('=')[1],
  dryRun: args.includes('--dry-run'),
  threshold: parseInt(args.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '3', 10),
  includeIgnored: args.includes('--include-ignored'),
};

main(opts).catch((err) => {
  console.error(chalk.red('[i18n:extract] FAILED'), err);
  process.exit(1);
});
```

## 5. Gestion des cas spéciaux

### 5.1 Props enum (variant, color, type)

**Cas** :
```tsx
<Button variant="primary" color="emerald" type="submit" label="Continuer" />
```

**Souhait** : extraire `Continuer`, ignorer `primary`, `emerald`, `submit`.

**Solution** : whitelist des props textuels dans `TEXTUAL_PROPS`. Les autres props sont ignorés par le script.

### 5.2 Conditional rendering

**Cas** :
```tsx
<button>
  {loading ? 'Chargement…' : 'Continuer'}
</button>
```

**Détection** : 2 StringLiteral nodes dans un ConditionalExpression. Le script les capture indépendamment.

**Output proposé** :
```json
[
  { "rawValue": "Chargement…", "suggestedKey": "common.chargement" },
  { "rawValue": "Continuer", "suggestedKey": "common.continuer" }
]
```

**Action review** : renommer en `common.loading` et `common.continue`, garder les deux.

### 5.3 String concatenation

**Cas** :
```tsx
const msg = 'Bonjour ' + user.name + ', bienvenue.';
```

**Détection** : 2 StringLiteral séparés (`'Bonjour '` et `', bienvenue.'`). Le script les capture séparément mais leur cohabitation montre qu'ils devraient être une ICU.

**Action review** : le founder doit MANUELLEMENT :
1. Marquer les 2 fragments `ignored: true` dans `_extracted_pending.json`
2. Créer une nouvelle entrée avec ICU :
   ```json
   {
     "rawValue": "Bonjour {name}, bienvenue.",
     "suggestedKey": "common.greeting_user",
     "namespace": "common",
     "manual": true
   }
   ```
3. Refactor le code en `t('common.greeting_user', { name: user.name })`

**Pourquoi pas automatique** : risque de mal recomposer si le ` + ` n'est pas évident. Mieux laisser au humain.

### 5.4 Template literals avec interpolation

**Cas** :
```tsx
const msg = `Vous avez ${count} articles dans votre panier.`;
```

**Détection** : `TemplateExpression` node. Le script extrait le texte autour des `${...}` et propose une ICU.

**Output auto-généré** :
```json
{
  "rawValue": "Vous avez {count} articles dans votre panier.",
  "suggestedKey": "marketing.cart.items_in_cart",
  "namespace": "marketing.cart",
  "hasInterpolation": true,
  "surroundingNode": "TemplateExpression"
}
```

**Action review** : le founder doit :
1. Convertir en plural ICU si pertinent :
   ```json
   "marketing.cart.items_count": "{count, plural, =0 {Panier vide} one {Vous avez 1 article dans votre panier.} other {Vous avez # articles dans votre panier.}}"
   ```

### 5.5 t.rich placeholders

**Cas** :
```tsx
<p>
  Notre <strong>kit</strong> est <em>limité</em>.
</p>
```

**Détection** : `JsxText` "Notre ", "kit", " est ", "limité", "." → 5 morceaux.

**Action review humaine** : c'est un cas borderline. Le founder doit :
1. Marquer les 5 morceaux `ignored: true`
2. Créer une entrée manuelle avec rich text tags :
   ```json
   {
     "suggestedKey": "marketing.kit.scarcity",
     "rawValue": "Notre <bold>kit</bold> est <italic>limité</italic>.",
     "namespace": "marketing.kit"
   }
   ```
3. Refactor avec `t.rich` :
   ```tsx
   t.rich('marketing.kit.scarcity', {
     bold: (chunks) => <strong>{chunks}</strong>,
     italic: (chunks) => <em>{chunks}</em>,
   });
   ```

### 5.6 Constantes hors composant

**Cas** :
```tsx
// apps/web/src/lib/checkout/payment-methods.ts
export const PAYMENT_METHODS = [
  { id: 'cmi', label: 'Carte bancaire' },
  { id: 'cod', label: 'Paiement à la livraison' },
];
```

**Détection** : `StringLiteral` capturés hors JSX. Le script les détecte si `isInsideJsxElement` retourne false.

**Output** :
```json
[
  { "rawValue": "Carte bancaire", "suggestedKey": "wizard.payment.method.cmi" },
  { "rawValue": "Paiement à la livraison", "suggestedKey": "wizard.payment.method.cod" }
]
```

**Action review** : refactor en fonction.

```tsx
export const getPaymentMethods = (t: Translator) => [
  { id: 'cmi', label: t('wizard.payment.method.cmi') },
  { id: 'cod', label: t('wizard.payment.method.cod') },
];
```

### 5.7 Metadata Next.js

**Cas** :
```tsx
export const metadata = {
  title: 'Le kit FemiGlow',
  description: 'Tout pour un rituel ongles.',
};
```

**Détection** : ObjectLiteralExpression avec StringLiteral PropertyAssignment.

**Output** :
```json
[
  { "rawValue": "Le kit FemiGlow", "suggestedKey": "seo.kit.title", "namespace": "seo.kit" },
  { "rawValue": "Tout pour un rituel ongles.", "suggestedKey": "seo.kit.description", "namespace": "seo.kit" }
]
```

**Action review** : refactor en `generateMetadata` async.

```tsx
export async function generateMetadata({ params: { locale } }: { params: { locale: Locale } }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });
  return {
    title: t('title'),
    description: t('description'),
  };
}
```

### 5.8 SQL / inline data

**Cas** :
```tsx
const QUOTES = [
  { author: 'Yasmine', text: 'Le rituel a changé mon quotidien.' },
];
```

**Détection** : `StringLiteral` hors JSX. Le script les détecte.

**Action review** : cas particulier — souvent les "quotes" / "testimonials" sont du contenu CMS, pas de l'UI. Le founder doit :
1. Marquer comme `ignored: true` avec `reason: "Move to component_field_bindings"`
2. Migrer manuellement vers `component_field_bindings` table.

## 6. Output : structure de `_extracted_pending.json`

Format attendu :

```json
{
  "_meta": {
    "extractedAt": "2026-05-27T15:00:00.000Z",
    "totalCount": 612,
    "ignoredCount": 47,
    "scope": "all",
    "thresholdChars": 3,
    "scriptVersion": "1.0.0"
  },
  "extracted": {
    "common": [
      {
        "rawValue": "Retour",
        "normalizedValue": "Retour",
        "suggestedKey": "common.back",
        "namespace": "common",
        "context": "/Users/.../components/ui/back-button.tsx:18",
        "surroundingNode": "JsxText",
        "fileRelPath": "components/ui/back-button.tsx",
        "scoreFr": 0.65,
        "ignored": false
      }
    ],
    "marketing": [
      {
        "rawValue": "Le rituel ongles, en cinq minutes.",
        "normalizedValue": "Le rituel ongles, en cinq minutes.",
        "suggestedKey": "marketing.home.le_rituel_ongles_en_cinq",
        "namespace": "marketing.home",
        "context": "/Users/.../app/(marketing)/page.tsx:42",
        "surroundingNode": "JsxText",
        "fileRelPath": "app/(marketing)/page.tsx",
        "scoreFr": 0.95,
        "ignored": false
      }
    ],
    "navigation": [
      { "rawValue": "Accueil", "suggestedKey": "navigation.home", ... }
    ],
    "errors": [],
    "misc": [
      {
        "rawValue": "TODO: refactor",
        "namespace": "misc",
        "scoreFr": 0.3,
        "ignored": true,
        "reason": "Low FR likelihood"
      }
    ]
  }
}
```

## 7. Workflow review humain

### 7.1 Étape 1 — Ouvrir `_extracted_pending.json`

Le founder ouvre le JSON dans VSCode ou JetBrains. Recommandé : extension JSON tree viewer.

### 7.2 Étape 2 — Trier par namespace

Aller namespace par namespace. Pour chaque :
- Vérifier les clés proposées (renommer si besoin)
- Décider du `ignored` (manuellement)
- Cas particuliers : marquer `manual: true` et ajouter une note `notes_human`

### 7.3 Étape 3 — Renommer les clés mal nommées

Le script suggère `marketing.home.le_rituel_ongles_en_cinq` mais ce n'est pas idéal. Le founder renomme en `marketing.hero.title`.

### 7.4 Étape 4 — Marquer les ignorés

```json
{
  "rawValue": "primary",
  "scoreFr": 0.0,
  "ignored": true,
  "reason": "CSS variant — not a translatable string"
}
```

### 7.5 Étape 5 — Merger dans `messages/fr.json`

Script helper :

```bash
pnpm i18n:merge-extracted
```

Qui :
1. Lit `_extracted_pending.json`
2. Filtre `ignored: true`
3. Construit l'arbre JSON nested
4. Merge dans `messages/fr.json` (préserve l'existant)
5. Run `prettier --write messages/fr.json`
6. (Optionnel) supprime `_extracted_pending.json`

### 7.6 Étape 6 — Refactor les composants

Pour chaque entry mergée, remplacer le hardcode par `t('key')`. Manuel par fichier. Cf. `migration-historique.md` § 5.4.

## 8. ESLint custom rule — `i18n/no-hardcoded-strings`

### 8.1 Pourquoi

Empêcher la régression future : une fois extraction faite, bloquer toute nouvelle string FR hardcoded.

### 8.2 Implémentation (référence)

```ts
// apps/web/eslint-rules/no-hardcoded-strings.ts
import type { Rule } from 'eslint';

const SPECIAL_CHARS = /[éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]/;
const FR_WORDS = /\b(le|la|les|un|une|des|du|de|à|au|aux|et|ou|mais|donc|nous|vous|notre|votre|nos|vos)\b/i;

export const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hardcoded French strings — use t() from next-intl' },
    schema: [{
      type: 'object',
      properties: {
        ignoreProps: { type: 'array', items: { type: 'string' } },
        minLength: { type: 'number' },
        ignoreFiles: { type: 'array', items: { type: 'string' } },
      },
    }],
  },
  create(context) {
    const opts = (context.options[0] ?? {}) as {
      ignoreProps?: string[];
      minLength?: number;
      ignoreFiles?: string[];
    };
    const minLength = opts.minLength ?? 3;
    const ignoreProps = new Set(opts.ignoreProps ?? ['variant', 'color', 'type', 'name', 'id', 'icon']);

    function check(text: string, node: Rule.Node) {
      if (text.length < minLength) return;
      if (!SPECIAL_CHARS.test(text) && !FR_WORDS.test(text)) return;
      context.report({
        node,
        message: `Hardcoded French string detected: "${text.substring(0, 40)}..." — extract via t() from next-intl`,
      });
    }

    return {
      JSXText(node: any) {
        const text = node.value?.trim();
        if (text) check(text, node);
      },
      JSXAttribute(node: any) {
        if (node.value?.type !== 'Literal') return;
        if (ignoreProps.has(node.name?.name)) return;
        check(node.value.value as string, node);
      },
      Literal(node: any) {
        // Skip if inside JSX (already handled by JSXText)
        if (isInsideJsx(node)) return;
        if (typeof node.value !== 'string') return;
        check(node.value, node);
      },
    };
  },
};

function isInsideJsx(node: Rule.Node): boolean {
  let cur: any = node.parent;
  while (cur) {
    if (cur.type?.startsWith('JSX')) return true;
    cur = cur.parent;
  }
  return false;
}
```

### 8.3 Configuration ESLint

```json
// apps/web/.eslintrc.json
{
  "plugins": ["./eslint-rules/i18n"],
  "rules": {
    "i18n/no-hardcoded-strings": ["error", {
      "minLength": 4,
      "ignoreProps": ["variant", "color", "type", "name", "id", "icon", "data-testid"],
      "ignoreFiles": ["**/admin/**", "**/test/**", "**/*.test.*"]
    }]
  }
}
```

### 8.4 Pre-commit hook

```bash
# .husky/pre-commit
pnpm eslint apps/web/src --rule "i18n/no-hardcoded-strings: error"
```

Bloque tout commit qui réintroduit des hardcode.

## 9. Commandes pnpm

À ajouter dans `apps/web/package.json` :

```json
{
  "scripts": {
    "i18n:extract": "tsx scripts/i18n/extract-strings.ts",
    "i18n:extract:marketing": "tsx scripts/i18n/extract-strings.ts --scope=app/(marketing)",
    "i18n:extract:chat": "tsx scripts/i18n/extract-strings.ts --scope=components/chat",
    "i18n:extract:dry": "tsx scripts/i18n/extract-strings.ts --dry-run",
    "i18n:merge-extracted": "tsx scripts/i18n/merge-extracted.ts",
    "i18n:validate-keys": "tsx scripts/i18n/validate-keys.ts",
    "i18n:check-coverage": "tsx scripts/i18n/check-coverage.ts",
    "i18n:no-orphan-keys": "tsx scripts/i18n/no-orphan-keys.ts"
  }
}
```

## 10. Tests du script

### 10.1 Tests unitaires

`apps/web/scripts/i18n/__tests__/extract-strings.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractFromSourceFile } from '../extract-strings';

describe('extract-strings', () => {
  it('extrait JsxText FR', () => {
    const proj = new Project({ useInMemoryFileSystem: true });
    const sf = proj.createSourceFile('test.tsx', `
      export default function Page() {
        return <h1>Le rituel ongles</h1>;
      }
    `);
    const results = extractFromSourceFile(sf, {
      threshold: 3, dryRun: false, includeIgnored: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.rawValue).toBe('Le rituel ongles');
  });

  it('ignore les URLs', () => {
    const proj = new Project({ useInMemoryFileSystem: true });
    const sf = proj.createSourceFile('test.tsx', `
      const URL = 'https://femiglow.ma/contact';
      export default function Page() { return null; }
    `);
    const results = extractFromSourceFile(sf, {
      threshold: 3, dryRun: false, includeIgnored: false,
    });
    expect(results).toHaveLength(0);
  });

  it('ignore les variants enum', () => {
    const proj = new Project({ useInMemoryFileSystem: true });
    const sf = proj.createSourceFile('test.tsx', `
      export default function Page() {
        return <Button variant="primary" label="Continuer" />;
      }
    `);
    const results = extractFromSourceFile(sf, {
      threshold: 3, dryRun: false, includeIgnored: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.rawValue).toBe('Continuer');
  });

  it('détecte les template literals', () => {
    const proj = new Project({ useInMemoryFileSystem: true });
    const sf = proj.createSourceFile('test.tsx', `
      function greet(name: string) {
        return \`Bonjour \${name}, bienvenue chez FemiGlow.\`;
      }
    `);
    const results = extractFromSourceFile(sf, {
      threshold: 3, dryRun: false, includeIgnored: false,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.hasInterpolation).toBe(true);
    expect(results[0]?.rawValue).toContain('{name}');
  });
});
```

### 10.2 Tests d'intégration

Sur un sample de 20 fichiers représentatifs, vérifier que le script :
- Détecte > 95% des strings FR
- Ne génère pas plus de 5% de faux positifs
- Génère des clés conformes naming conventions

## 11. Performance et limitations

### 11.1 Temps d'exécution attendu

| Codebase size | Files scanned | Durée |
|---|---|---|
| FemiGlow actuel (~ 400 fichiers TSX/TS) | ~ 100 (après filtres) | ~ 30 sec |
| 10 000 fichiers | ~ 2 000 | ~ 3 min |

Le bottleneck est `ts-morph` (compile + AST). Si trop lent : run par scope.

### 11.2 Limitations connues

1. **Cas multi-locale source** : si on a déjà des strings AR mélangées dans le code, le script peut les manquer (heuristique FR-only). À gérer en V2.
2. **Strings dynamiques** : `[a, b, c].join(' ')` → impossible de détecter le résultat statique. Doit être refactor avant.
3. **Variables exportées** : `export const TITLE = '...'` → détecté en StringLiteral, mais le refactor nécessite de propager au consommateur.
4. **Markdown files** : pas scanné (différent format). Les `.md` content go via DB (`legal_pages`).
5. **JSDoc commentaires** : pas scanné. OK car non visible utilisateur.

### 11.3 Faux positifs / faux négatifs

| Type | Probabilité | Mitigation |
|---|---|---|
| Faux positif (string FR détectée mais non visible) | ~5% | Review humain |
| Faux négatif (string FR loupée) | ~3% | ESLint rule en CI capture la suite |
| Mauvaise clé suggérée | ~30% | Review humain renomme |
| Mauvais namespace | ~10% | Review humain reclassifie |

## 12. Métriques à tracker

| Métrique | Cible Phase 2 | Outil |
|---|---|---|
| Strings extraites au premier passage | 500+ | Output script |
| Strings retenues après review | 600-800 | `messages/fr.json` count |
| Ratio (extracted/retained) | > 0.85 | Calcul manuel |
| Temps de review humain | < 5 j ouvrés | Tracking |
| Régressions visuelles post-refactor | < 5 | Playwright visual |

## 13. Anti-patterns à éviter

1. **Run extract sans review** : qualité output dégradée. Toujours review avant merge.
2. **Renommer les clés a posteriori** : casse les 3 locales + tests. Renommer SEULEMENT pendant review initial.
3. **Inclure les fichiers admin** : V1 = scope marketing only. Filtrer `app/admin/**`.
4. **Skip le test sur un sample** : tester le script sur 1-2 fichiers représentatifs AVANT de scanner tout.
5. **Pas de version control sur `_extracted_pending.json`** : doit être tracké en git pendant la review (pour collab founder/dev).
6. **Hardcoder le path `apps/web/src`** : utiliser des constants ou `import.meta.url`.
7. **Skip ESLint rule en CI** : la rule est le gardien long-terme. Sans elle, drift garanti.
8. **Refactor en masse sans tests** : refactor 1 fichier = 1 commit = 1 review = 1 test. Pas de big bang.

## 14. Outputs attendus Phase 2 complète

| Output | Localisation | Volume |
|---|---|---|
| Script extract-strings.ts | `apps/web/scripts/i18n/` | ~ 500 lignes |
| Script merge-extracted.ts | idem | ~ 200 lignes |
| Script validate-keys.ts | idem | ~ 150 lignes |
| ESLint rule | `apps/web/eslint-rules/i18n/` | ~ 100 lignes |
| Tests | `apps/web/scripts/i18n/__tests__/` | ~ 300 lignes |
| `messages/fr.json` | `apps/web/messages/` | ~ 600-800 clés |
| `_extracted_pending.json` (temporaire) | idem | ~ 600 entrées |

## 15. Checklist d'extraction

### Préparation
- [ ] Script `extract-strings.ts` créé et testé sur 2-3 fichiers
- [ ] Heuristique FR ajustée (test sur sample)
- [ ] NAMESPACE_RULES customisé pour FemiGlow
- [ ] SHORT_KEYS_MAP rempli pour `common.*`
- [ ] CI tests verts pour le script
- [ ] Backup git tag (`pre-i18n-extraction`)

### Première extraction
- [ ] `pnpm i18n:extract --scope=app/(marketing) --dry-run` → preview
- [ ] `pnpm i18n:extract --scope=app/(marketing)` → output JSON
- [ ] Review founder du JSON
- [ ] Renames + ignored marqués
- [ ] `pnpm i18n:merge-extracted` → ajout dans `messages/fr.json`

### Extension
- [ ] `pnpm i18n:extract --scope=components/chat`
- [ ] `pnpm i18n:extract --scope=lib/mail/templates`
- [ ] `pnpm i18n:extract --scope=components/header`
- [ ] `pnpm i18n:extract --scope=components/footer`
- [ ] Tous les outputs reviewés et mergés

### Refactor
- [ ] Composants refactorés (1 par 1)
- [ ] Tests verts à chaque refactor
- [ ] Snapshots Vitest mis à jour
- [ ] Playwright visual regression vérifié

### Finalisation
- [ ] `_extracted_pending.json` supprimé
- [ ] ESLint rule activée en error
- [ ] CI gates configurées
- [ ] `messages/fr.json` à 600-800 clés
- [ ] Coverage FR = 100%
- [ ] Export envoyé au traducteur

## 16. Références croisées

- Migration historique : [`./migration-historique.md`](./migration-historique.md)
- Workflow translateur : [`./workflow-translation.md`](./workflow-translation.md)
- Inventory CSV : [`./translation-keys-inventory.csv`](./translation-keys-inventory.csv)
- Naming conventions : [`../02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md)
- Translation keys schema : [`../02-design-conception/translation-keys-schema.json`](../02-design-conception/translation-keys-schema.json)
- Sample messages : [`../02-design-conception/sample-messages-files.yaml`](../02-design-conception/sample-messages-files.yaml)
- Backend translation store : [`../03-backend/translation-store.md`](../03-backend/translation-store.md)
- Plan global Phase 2 : [`../08-plan-action/phases.md`](../08-plan-action/phases.md)
- Tests stratégie : [`../07-tests/`](../07-tests/)
