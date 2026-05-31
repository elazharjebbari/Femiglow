# Strategy — Stratégie globale tests i18n

> Document de référence pour comprendre **pourquoi** on teste ce qu'on teste, **comment** on l'organise, et **où** on met les gates CI.
> Lecture conseillée AVANT d'attaquer les fichiers détaillés (`unit-vitest.md`, etc.).

## 1. Principes directeurs

### 1.1 La pyramide d'abord

Adapté du test-strategy global FemiGlow (cf. `docs/test-strategy-2026-05/02-vision-strategy.md`), appliqué à i18n :

```
                  ┌──────────────────────────────────────┐
                  │     A11y + Visual (5%)                │
                  │     axe-core + Playwright visual     │
                  ├──────────────────────────────────────┤
                  │     E2E i18n (5%)                     │
                  │     Playwright multi-locale          │
                  ├──────────────────────────────────────┤
                  │     Integration MSW (15%)             │
                  │     API admin + middleware locale    │
                  ├──────────────────────────────────────┤
                  │     Component RTL/L18n (20%)          │
                  │     RTL render + axe + snap par loc  │
                  ├──────────────────────────────────────┤
                  │     Unit (55%)                        │
                  │     helpers + formatters + hooks     │
                  └──────────────────────────────────────┘
```

**Pourquoi cette répartition** :

- Un bug de formatage (`'1 234,56 €'` au lieu de `'1,234.56 €'`) doit être attrapé en **unit** (1 ms).
- Un bug d'API i18n (route 500) doit être attrapé en **integration** (50 ms).
- Un bug d'UX (le switcher ne ferme pas au Esc) doit être attrapé en **component** (10 ms).
- Un bug de flow critique (visite `/ar/kit` → checkout AR cassé) doit être attrapé en **E2E** (15 s).
- Le reste (RTL layout) est attrapé en **visual** (10 s par snapshot).

Un test E2E pour vérifier que le mot "Découvrir" est bien traduit en arabe est **un anti-pattern**.

### 1.2 Déterminisme strict

Comme pour le reste du projet, on bannit le non-déterminisme :

```ts
// ❌ Mauvais
it('formats today', () => {
  expect(formatDate(new Date())).toBe('27 mai 2026'); // dépend de l'horloge
});

// ✅ Bon
it('formats fixed date in FR', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-27T10:00:00Z'));
  expect(formatDate(new Date(), 'fr')).toBe('27 mai 2026');
  vi.useRealTimers();
});
```

Idem pour `Math.random()`, `crypto.randomUUID()`, network, FS.

### 1.3 Isolation locale

Aucun test i18n ne doit dépendre d'un autre. Chaque test :
- Initialise sa propre matrice de locales attendues
- Reset les handlers MSW (`server.resetHandlers()` dans `afterEach`)
- Ne mute pas les fixtures partagées (`Object.freeze(LOCALES_FIXTURE)`)

### 1.4 Anti-patterns transverses i18n

| # | Anti-pattern | Pourquoi mauvais | Bon pattern |
|---|---|---|---|
| AP1 | Tester uniquement FR | AR/EN bug passe inaperçu | Boucler sur `LOCALES.forEach` |
| AP2 | Hardcoder `'fr'` partout | Couplage fort à la default | Constante `DEFAULT_LOCALE` |
| AP3 | Tester l'implémentation `next-intl` | Lib tierce, perte de temps | Tester le résultat utilisateur |
| AP4 | Charger `messages/fr.json` direct | Bypass le runtime | Passer par `getTranslations()` |
| AP5 | Pas tester le fallback | Bug silencieux en prod | Test explicite : clé AR manque → FR rendu |
| AP6 | Test "Le titre est 'Découvrir'" | Le translateur change le mot demain → test cassé | Test "Le titre n'est pas vide et < 80 chars" |
| AP7 | Pas vérifier `dir="rtl"` sur AR | RTL pas testé du tout | E2E explicite `expect(html).toHaveAttribute('dir', 'rtl')` |
| AP8 | Visual snapshot bandeau panier mobile dynamic | Flaky (timestamps, animations) | Mask via `mask: [page.locator('[data-dynamic]')]` |

## 2. Périmètre par couche

### 2.1 Unit tests (Vitest pur)

**Périmètre** :
- Helpers i18n purs : `resolveLocale`, `matchLocale`, `formatDate`, `formatCurrency`, `formatNumber`, `pluralize`
- Module `lib/i18n/config.ts` : LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, LOCALE_DIRECTIONS
- Type-safety (TypeScript) : clés inexistantes failent à la compile (test `// @ts-expect-error`)
- Plurals : 0/1/few/many/other selon ICU
- Helpers Wizard CHA-231 : `getWizardTranslation()`, dictionary integrity (FR + AR keys match)

**Outils** :
- `vitest 2.1.2`
- `vi.mock('next-intl/server')` pour mock `getTranslations` quand on teste un helper qui l'appelle

**Cible runtime** : < 1.5 min CI total

**Coverage target** : 90% (helpers), 95% (formatters), 100% (config)

### 2.2 Component tests (Vitest + RTL)

**Périmètre** :
- `<LocaleSwitcher />` : render, interactions, aria, keyboard
- `<Header />` (parties i18n) : affiche menu localisé selon locale
- Composants page : `<Hero locale="ar">` rendu RTL
- Mocking `next-intl` côté client via `NextIntlClientProvider` wrapper de test
- Tests snapshots par locale (3 snapshots par composant)

**Outils** :
- `@testing-library/react`
- `@testing-library/user-event`
- `next-intl/testing` (provider wrapper officiel)

**Cible runtime** : < 3 min CI total

**Coverage target** : 80% (composants), 85% (LocaleSwitcher critique)

### 2.3 Integration tests (Vitest + MSW)

**Périmètre** :
- Routes API i18n : `GET /api/i18n/coverage`, `GET /api/i18n/missing-keys`, `POST /api/admin/i18n/upsert-message`, `POST /api/i18n/locale/switch`
- Middleware `middleware.ts` : pattern path > cookie > Accept-Language
- DB queries : `i18nLocales`, `i18nTranslationKeys`, `i18nTranslationValues`
- MSW handlers réutilisables pour les API i18n
- Test de fallback : si `/api/i18n/missing-keys?locale=ar` renvoie une clé manquante, l'app fallback sur FR

**Outils** :
- `vitest 2.1.2`
- `msw 2.14`
- `@testing-library/react` pour tests qui montent un composant avec mock fetch

**Cible runtime** : < 4 min CI total

**Coverage target** : 90% (routes API + middleware)

### 2.4 E2E tests (Playwright)

**Périmètre** :
- Scenarios bilingues : `/fr/kit` → switch AR → `/ar/kit` avec layout RTL
- Wizard checkout par locale (FR/AR/EN)
- 404 localisée
- hreflang tags présents
- Cookie `NEXT_LOCALE` persistance après reload
- Keyboard navigation switcher complète

**Outils** :
- `@playwright/test 1.48`
- Selectors via `data-testid` (jamais `getByText` car FR-dépendant)
- Custom fixtures Playwright pour set cookie locale rapide

**Cible runtime** : < 10 min CI total

**Coverage** : pas une métrique pour E2E, plutôt **couverture scenario** (cf. `test-matrix.csv`)

### 2.5 Visual regression (Playwright)

**Périmètre** :
- Snapshots `toHaveScreenshot()` par locale sur 5 pages critiques :
  1. `/{locale}/` (home)
  2. `/{locale}/kit`
  3. `/{locale}/maison`
  4. `/{locale}/checkout` (step 1)
  5. `/{locale}/admin/i18n/dashboard`
- Comparaison FR vs AR : audit visuel manuel + screenshots side-by-side
- Mask des éléments dynamiques (date, panier compteur, timestamp)

**Outils** :
- `playwright-core` avec `toHaveScreenshot()`
- Baseline stockée dans `e2e/visual/__snapshots__/{platform}/`

**Cible runtime** : < 5 min CI total

### 2.6 A11y tests (axe-core + Playwright)

**Périmètre** :
- WCAG 2.1 AA : 0 violation `critical` ou `serious`
- Tests par locale (FR/AR/EN)
- Keyboard navigation : Tab, Enter, Esc, Arrow Up/Down
- `lang` attribute sur `<html>`
- Focus order RTL (inversé en AR)
- aria-current sur locale active
- aria-expanded sur dropdown switcher

**Outils** :
- `@axe-core/playwright 4.11`
- Helpers : `expectNoA11yViolations(page, { tags: ['wcag2a', 'wcag2aa'] })`

**Cible runtime** : intégrée dans E2E (~3 min surcharge)

## 3. Gates CI

### 3.1 Workflow `.github/workflows/i18n-tests.yml`

```yaml
name: i18n tests
on:
  pull_request:
    paths:
      - 'apps/web/src/lib/i18n/**'
      - 'apps/web/src/components/i18n/**'
      - 'apps/web/messages/**'
      - 'apps/web/src/app/api/i18n/**'
      - 'apps/web/src/app/api/admin/i18n/**'
      - 'apps/web/middleware.ts'

jobs:
  unit-integration:
    name: vitest unit + integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter @femiglow/web test:unit -- src/lib/i18n
      - run: pnpm --filter @femiglow/web test:int -- src/app/api/i18n src/app/api/admin/i18n middleware
      - run: pnpm --filter @femiglow/web test:coverage
      - run: node scripts/check-i18n-coverage.mjs # gate

  e2e-critical:
    name: playwright e2e critical
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm --filter @femiglow/web test:e2e -- e2e/i18n --grep '@critical'

  visual:
    name: playwright visual
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm --filter @femiglow/web test:visual -- --project=chromium-fr
      - run: pnpm --filter @femiglow/web test:visual -- --project=chromium-ar
      - run: pnpm --filter @femiglow/web test:visual -- --project=chromium-en

  coverage-translations:
    name: coverage clés
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: node scripts/coverage-translations.mjs
```

### 3.2 Gates bloquants vs warning

| Gate | Bloquant | Seuil |
|---|---|---|
| Vitest unit tous verts | Oui | 0 fail |
| Vitest integration tous verts | Oui | 0 fail |
| Playwright e2e critical | Oui | 0 fail |
| Coverage `lib/i18n/` ≥ 90% | Oui | < 90% → fail |
| Coverage `components/i18n/` ≥ 80% | Non (warn) | < 80% → warning Slack |
| Visual snapshots zéro diff | Oui (sur PR) | 0 pixel diff > threshold |
| Axe violations | Oui | 0 critical, 0 serious |
| Coverage FR = 100% | Oui | < 100% → fail |
| Coverage AR ≥ 90% | Non (warn) | < 90% → warning Slack |
| Coverage EN ≥ 90% | Non (warn) | < 90% → warning Slack |

### 3.3 Pre-commit hooks (Husky)

```bash
# .husky/pre-commit
pnpm --filter @femiglow/web lint:i18n  # ESLint rules custom
pnpm --filter @femiglow/web typecheck  # type-safety
```

ESLint rules custom (cf. `lint-rules.md`) :
- `i18n/no-hardcoded-strings` — error
- `i18n/key-format` — error
- `i18n/no-orphan-keys` — warn
- `i18n/required-locales` — warn

## 4. Mémoire vs perf

### 4.1 Coût mémoire des messages

- `messages/fr.json` : ~12 KB gzipped (~50 KB unzipped)
- `messages/ar.json` : ~14 KB gzipped (taille caractères arabes ~+15%)
- `messages/en.json` : ~12 KB gzipped

Pour les tests :
- En unit/component : import direct des JSON (rapide, sync)
- En integration : fetch via MSW handler (réaliste)
- En E2E : chargé par le serveur Next dev (réel)

### 4.2 Coût des snapshots

- 5 pages × 3 locales × 2 viewports (desktop + mobile) = **30 snapshots PNG**
- Taille moyenne : ~150 KB / snapshot = **~4.5 MB total**
- Stockés dans Git LFS pour éviter de polluer le repo

### 4.3 Parallélisation Playwright

```ts
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
  projects: [
    { name: 'chromium-fr', use: { locale: 'fr-FR' } },
    { name: 'chromium-ar', use: { locale: 'ar-MA' } },
    { name: 'chromium-en', use: { locale: 'en-US' } },
  ],
});
```

3 projects en parallèle → temps total ~= temps du plus long.

## 5. Coverage targets détaillé

### 5.1 Code coverage (vitest --coverage)

| Path | Target | Justif |
|---|---|---|
| `src/lib/i18n/config.ts` | 100% | Petit, critique |
| `src/lib/i18n/resolveLocale.ts` | 100% | Tous les cas de fallback |
| `src/lib/i18n/formatters.ts` | 95% | Edge cases monnaie zéro |
| `src/lib/i18n/matchLocale.ts` | 95% | BCP-47 matching |
| `src/lib/i18n/pluralRules.ts` | 90% | ICU plural cases |
| `src/components/i18n/LocaleSwitcher.tsx` | 85% | Critique UX |
| `src/components/i18n/LangAttribute.tsx` | 100% | Simple, 100% testable |
| `src/app/api/i18n/coverage/route.ts` | 90% | Auth + DB + rate-limit |
| `src/app/api/i18n/missing-keys/route.ts` | 90% | Idem |
| `src/app/api/admin/i18n/upsert-message/route.ts` | 90% | Critique write |
| `src/app/api/admin/i18n/locales/route.ts` | 85% | Critical CRUD |
| `src/app/api/admin/i18n/export/route.ts` | 80% | Lourde, mocks CSV |
| `src/app/api/admin/i18n/import/route.ts` | 80% | Idem |
| `src/app/api/i18n/locale/switch/route.ts` | 95% | Cookie + locale enum |
| `middleware.ts` (parts locale) | 100% | Critical, exécuté à chaque req |
| `src/lib/checkout/i18n/dictionary.ts` | 100% | CHA-231 régression |

### 5.2 Coverage des clés (traductions)

Cf. `coverage-translations.md` détaillé. Vue rapide :

| Locale | Target | Bloquant | Action si < target |
|---|---|---|---|
| FR | 100% | Oui | Fail CI, bloquer merge |
| AR | ≥ 90% | Non (warn) | Slack alert, ticket Jira |
| EN | ≥ 90% | Non (warn) | Slack alert, ticket Jira |
| Nouvelle locale | ≥ 95% avant `enabled=true` | Oui | Pas activer la locale |

## 6. Non-objectifs

Ce qu'on NE fait PAS :

- ❌ **Tester la traduction sémantique** ("est-ce que 'Découvrir' = 'Discover' = 'اكتشف'") — c'est le job du translateur + revue humaine, pas du test machine.
- ❌ **Tester la perf de `Intl.DateTimeFormat`** — lib navigateur, déjà optimisée.
- ❌ **Tester le rendu de polices arabes pixel-perfect** — variation entre OS (macOS vs Windows vs Linux) trop forte, on accepte un delta visuel.
- ❌ **Tester chaque clé une par une** — on teste la **shape** (Zod) + des chemins critiques.
- ❌ **100% coverage** — diminishing returns. 90% sur helpers est la cible.
- ❌ **E2E pour valider chaque label** — la pyramide explose. On valide les flows, pas les mots.
- ❌ **Tester les caractères Unicode exotiques** (emojis dans labels, scripts non latins hors AR) — hors périmètre V1.
- ❌ **Tester chaque combinaison plural × locale × number** — on teste les cas représentatifs (0, 1, 2, 5, 11, 100), pas 1000 valeurs.

## 7. Workflow d'écriture de tests

### 7.1 Nouveau composant i18n → checklist

1. Écrire le test **avant** (TDD) ou **en même temps** (pas après)
2. Snapshot par locale FR + AR + EN
3. Vérifier `dir="rtl"` si la locale est AR
4. Vérifier `lang="ar"` sur `<html>` (test composé avec Header)
5. Vérifier axe-core 0 violation
6. Vérifier keyboard accessibility (Tab, Enter)
7. Ajouter le composant à `test-matrix.csv`

### 7.2 Nouveau endpoint API i18n → checklist

1. Créer un fichier `apps/web/src/app/api/i18n/<name>/route.test.ts`
2. Tester chaque code retour : 200, 401, 422, 429, 500
3. Tester avec MSW pour la DB ou supertest-like fetch
4. Tester rate-limiting (mock Redis ou inject la limit)
5. Tester audit log appelé sur write
6. Tester `revalidateTag` appelé sur write
7. Vérifier la shape de la réponse (Zod)
8. Ajouter au CSV

### 7.3 Nouvelle locale (ex: ES) → checklist

1. Mettre à jour `LOCALES` dans `lib/i18n/config.ts`
2. Ajouter `messages/es.json` (au moins shape complète, valeurs placeholder OK)
3. Lancer tests : `pnpm test` doit passer
4. Lancer E2E avec project Playwright `chromium-es` (config)
5. Vérifier coverage clés ≥ 95% avant d'activer
6. Snapshot visuel baseline `pnpm test:visual --project=chromium-es --update-snapshots`
7. Update `test-matrix.csv` avec lignes ES

## 8. Tooling et helpers partagés

### 8.1 Helpers communs `src/test/helpers/i18n/`

```
src/test/helpers/i18n/
├── render-with-i18n.tsx         # Wrapper RTL avec NextIntlClientProvider
├── locales-matrix.ts             # Constantes LOCALES_TEST_MATRIX
├── messages-loader.ts            # Charge fr.json/ar.json/en.json pour tests
├── playwright-i18n-fixtures.ts   # Fixtures Playwright : page.goto avec locale
├── set-locale-cookie.ts          # Helper pour set cookie dans tests
└── extract-keys.ts               # Helper pour extraire les clés d'un composant
```

### 8.2 Constantes partagées

```ts
// src/test/helpers/i18n/locales-matrix.ts
export const LOCALES_TEST_MATRIX = ['fr', 'ar', 'en'] as const;
export const DEFAULT_LOCALE = 'fr';
export const RTL_LOCALES = ['ar'] as const;

export const LOCALE_LABELS = {
  fr: { native: 'Français', english: 'French' },
  ar: { native: 'العربية', english: 'Arabic' },
  en: { native: 'English', english: 'English' },
} as const;
```

### 8.3 MSW handlers réutilisables

Cf. `integration-msw.md` détaillé. Aperçu :

```ts
// src/test/msw/handlers/i18n.ts
import { http, HttpResponse } from 'msw';

export const i18nHandlers = [
  http.get('/api/i18n/coverage', () => HttpResponse.json({ data: { locales: [...] } })),
  http.get('/api/i18n/missing-keys', ({ request }) => { ... }),
  http.post('/api/admin/i18n/upsert-message', async ({ request }) => { ... }),
  http.post('/api/i18n/locale/switch', async ({ request, cookies }) => { ... }),
];
```

## 9. Rythme d'exécution

| Phase | Tests | Outils | Durée locale | CI |
|---|---|---|---|---|
| Pre-commit | Lint + typecheck | ESLint + tsc | < 30 s | non (local) |
| PR open | Unit + Integration | Vitest + MSW | < 2 min | oui |
| PR open | Component | Vitest + RTL | < 3 min | oui |
| PR open | E2E critical | Playwright | < 5 min | oui |
| PR open | Visual | Playwright snapshot | < 5 min | oui |
| PR open | Coverage clés | Script Node | < 30 s | oui |
| Nightly | E2E full + Visual full | Playwright | < 25 min | oui |
| Weekly | Coverage report HTML | Vitest --coverage | < 5 min | oui |

## 10. Anti-patterns

1. **Tests qui dépendent de `process.env`** — utiliser `vi.stubEnv()` explicitement.
2. **Tests qui mutent le filesystem** — utiliser `os.tmpdir()` + cleanup.
3. **Snapshots dans le code des tests** — `toMatchSnapshot()` fichier à part.
4. **E2E qui réinitialise la DB chaque test** — utiliser une fixture session unique.
5. **Mock global de `next-intl`** — préférer un mock par test ciblé.
6. **`data-testid` mal nommés** : préférer `locale-switcher-button` à `btn1`.
7. **Vitest sans `--reporter=dot` en CI** — log verbose pollue les logs.
8. **Playwright sans `--reporter=html`** — diff impossible à debug sans report.
9. **Tester avec une seule fenêtre de viewport** — couvrir au minimum desktop + mobile.

## 11. Critères "test i18n bien écrit"

✅ **A**rrange-**A**ct-**A**ssert structure claire
✅ **F**ast (< 100 ms unit, < 1 s integration, < 30 s e2e)
✅ **I**solé (peut tourner seul, en parallèle, dans n'importe quel ordre)
✅ **R**eproductible (déterministe, 0 flaky)
✅ **S**elf-validating (assertions explicites, pas de `console.log`)
✅ **T**imely (écrit avec le code, pas après)
✅ **M**ulti-locale : boucle sur LOCALES, pas hardcoded FR
✅ **RTL-aware** : si UI, teste AR aussi

## 12. Documentation de référence externe

- next-intl testing guide : https://next-intl-docs.vercel.app/docs/workflows/testing
- Playwright multi-locale : https://playwright.dev/docs/emulation#locale--timezone
- MSW v2 docs : https://mswjs.io/docs/
- axe-core rules : https://dequeuniversity.com/rules/axe/4.10
- WCAG 2.1 AA : https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- ICU Plural Rules : https://cldr.unicode.org/index/cldr-spec/plural-rules

## 13. Checklist de validation phase 6

- [ ] Pyramide expliquée à l'équipe (15 min)
- [ ] `src/test/helpers/i18n/` créé avec les fichiers prévus
- [ ] `src/test/msw/handlers/i18n.ts` créé
- [ ] CI workflow `.github/workflows/i18n-tests.yml` actif
- [ ] Coverage gates configurés et testés
- [ ] ESLint rules custom activées (4 rules)
- [ ] Baselines visuelles générées par locale
- [ ] Test matrix CSV reviewée par QA + lead
- [ ] Pre-commit hooks Husky en place
- [ ] Documentation de référence partagée dans #dev-femiglow
