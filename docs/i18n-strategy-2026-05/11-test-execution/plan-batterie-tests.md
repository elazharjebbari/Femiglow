# Plan d'exécution — Batterie de tests i18n FemiGlow

> **Cœur opérationnel** du sous-dossier `11-test-execution/`.
> Décrit **comment exécuter** la batterie de tests dense décrite dans `07-tests/`, **en 8 vagues séquentielles**, chacune avec ses objectifs, ses commandes, ses critères de sortie et ses pièges.
>
> Audience : dev qui pilote la batterie, QA qui constate, lead technique qui signe les exit criteria.
> Durée totale estimée : ~50-90 min en local (single machine), ~25 min en CI (parallèle).

## Sommaire

- [Section 1 — Philosophie de la robustesse](#section-1--philosophie-de-la-robustesse)
- [Section 2 — Découpage en vagues](#section-2--découpage-en-vagues)
  - [Wave 1 — Foundation tests](#wave-1--foundation-tests-unit-helpers)
  - [Wave 2 — Component tests](#wave-2--component-tests-rtl--rsc)
  - [Wave 3 — Integration tests](#wave-3--integration-tests-msw--api--db)
  - [Wave 4 — E2E flows](#wave-4--e2e-flows-playwright--3-locales)
  - [Wave 5 — Visual regression](#wave-5--visual-regression-snapshots-par-locale)
  - [Wave 6 — A11y RTL](#wave-6--a11y-rtl-axe--keyboard--lang-attribute)
  - [Wave 7 — Performance](#wave-7--performance-bundle--lcp--lazy-loading)
  - [Wave 8 — Robustness](#wave-8--robustness-fuzz--chaos--edge-cases)
- [Section 3 — Commandes maître](#section-3--commandes-maître)
- [Section 4 — Output et reporting](#section-4--output-et-reporting)
- [Annexes](#annexes)

---

## Section 1 — Philosophie de la robustesse

### 1.1 Qualité > Quantité

Le brief utilisateur est explicite : **« on s'en fou du nombre de tests ce qui compte c'est la robustesse »**.

Cela signifie concrètement :

| Approche **quantité** (à éviter) | Approche **robustesse** (à privilégier) |
|---|---|
| 500 tests qui assertent `expect(result).toBeTruthy()` | 50 tests qui assertent shape exacte + edge cases |
| 1 test par traduction de label (`'Découvrir' === 'Découvrir'`) | 1 test de drift `keys(fr.json) == keys(ar.json)` |
| Couverture lines uniquement | Couverture branches + mutations + edge cases |
| Tests qui dorment (toujours green) | Tests qui ont déjà attrapé un vrai bug |
| Pyramide aplatie (E2E partout) | Pyramide stricte : unit > component > integration > E2E |

### 1.2 Focus edge cases

Pour chaque feature i18n, on couvre les 5 types d'edge cases minimum :

| Type | Exemple FemiGlow |
|---|---|
| **Empty input** | `resolveLocale('')` → `'fr'` (default), pas crash |
| **Null/undefined** | `formatCurrency(null, 'fr')` → `''` ou throw contrôlé |
| **Boundaries** | `formatCurrency(0, 'fr')` → `'0,00 MAD'`, `formatCurrency(Number.MAX_SAFE_INTEGER, 'ar')` |
| **Invalid format** | `resolveLocale('/xx/kit')` (locale inconnue) → fallback |
| **Concurrent state** | Switch locale au milieu d'un fetch SSR → pas de mix FR/AR sur la page |

### 1.3 Fuzz testing

Pour les helpers critiques, on injecte des inputs aléatoires :

```ts
// Exemple : resolveLocale avec inputs fuzz
import fc from 'fast-check';

it('resolveLocale ne crash jamais avec inputs aléatoires', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = resolveLocale(input);
      expect(['fr', 'ar', 'en']).toContain(result); // toujours une locale valide
    }),
    { numRuns: 1000 },
  );
});
```

Cibles fuzz V1 :
- `resolveLocale(input)` — 1000 runs strings random
- `matchLocale(input)` — 500 runs BCP-47 random
- `formatCurrency(amount, locale)` — 500 runs floats random
- `parseLocaleFromPath(path)` — 500 runs paths random

### 1.4 Mutation testing (optionnel V2)

Pour les helpers les plus critiques, on peut activer `stryker-js` :

```bash
pnpm exec stryker run --mutate "src/lib/i18n/**/*.ts"
```

Si 90% des mutants sont tués, on a la preuve que les tests détectent les bugs (pas juste de la couverture lines). En V1 i18n, **on ne lance pas Stryker** (coût ~30 min CI), mais on l'ajoute en V2 si on suspecte des "tests qui dorment".

### 1.5 Robustness anti-patterns

- ❌ **Tester l'implémentation** (`expect(useTranslations).toHaveBeenCalledWith(...)`) au lieu du comportement utilisateur (`expect(screen.getByRole('button')).toHaveTextContent('...')`)
- ❌ **Snapshots du HTML brut** sans filtre → re-render = diff = test cassé pour rien
- ❌ **Tests qui passent en local mais fail en CI** → pas robuste = à fixer immédiatement
- ❌ **Vérifier "le titre n'est pas vide"** sans vérifier "le titre est cohérent avec la clé attendue"
- ❌ **Couverture 100% sans tests d'edge cases** → bug en prod, "pourtant 100% coverage"

---

## Section 2 — Découpage en vagues

### Vue d'ensemble

| Wave | Nom | Layer | Tests cibles | Durée locale | Durée CI |
|---|---|---|---|---|---|
| 1 | Foundation | Unit | ~80 | ~2 min | ~1 min |
| 2 | Component | Unit + RTL | ~50 | ~5 min | ~3 min |
| 3 | Integration | MSW + DB | ~40 | ~6 min | ~4 min |
| 4 | E2E flows | Playwright | ~50 spec × 3 locales | ~25 min | ~10 min |
| 5 | Visual regression | Playwright snapshot | 36 snapshots | ~8 min | ~5 min |
| 6 | A11y RTL | axe-core + Playwright | ~18 scans | ~4 min | ~3 min |
| 7 | Performance | Lighthouse + bundle | 3 locales + bundle | ~5 min | ~3 min |
| 8 | Robustness | Fuzz + chaos | ~20 (intensifs) | ~10 min | ~5 min |
| **Total** | | | **~280 tests** | **~65 min** | **~34 min** |

### Convention de notation

Pour chaque wave, on documente :
- **Objectif** : ce qu'on cherche à valider (en 1 phrase)
- **Périmètre** : fichiers/features couverts
- **Tests à exécuter** : avec IDs renvoyant à `07-tests/test-matrix.csv`
- **Commande pnpm** : copy-pastable
- **Variables d'environnement** : si requises
- **Durée estimée** : locale dev (M1/Linux 32 GB)
- **Output attendu** : ce qu'on devrait voir
- **Exit criterion** : condition de passage à la wave suivante
- **Anti-patterns** : pièges spécifiques

---

### Wave 1 — Foundation tests (unit helpers)

#### Objectif

Valider que **toutes les briques pures** de la couche i18n fonctionnent en isolation : helpers, formatters, config, types.

C'est la fondation. Si Wave 1 fail, **on ne lance jamais les vagues suivantes** : tout le reste est construit dessus.

#### Périmètre

| Fichier | Coverage cible | Type |
|---|---|---|
| `src/lib/i18n/config.ts` | 100% | Const + isRtl |
| `src/lib/i18n/resolveLocale.ts` | 100% | Path > cookie > header > default |
| `src/lib/i18n/matchLocale.ts` | 95% | BCP-47 matching |
| `src/lib/i18n/formatters.ts` | 95% | Date / currency / number / percent / relative |
| `src/lib/i18n/pluralRules.ts` | 90% | ICU plural cases |
| `src/lib/checkout/i18n/dictionary.ts` | 100% | CHA-231 régression |
| `messages/{fr,ar,en}.json` | shape Zod | Snapshot keys |

#### Tests à exécuter (référence test-matrix.csv)

- **T001-T011** — `resolveLocale` + `matchLocale`
- **T012-T030** — `formatters` + `pluralRules`
- **T031-T035** — `config` + `types`
- **T036-T038** — `WizardDictionary` (régression CHA-231)
- **T039-T043** — `messages` Zod shape + keys snapshot

Total : ~43 tests unit selon matrice + ~37 tests dérivés (edge cases additionnels) = **~80 tests**.

#### Commande

```bash
# Lancement séquentiel
pnpm --filter @femiglow/web test:unit -- src/lib/i18n

# Avec coverage
pnpm --filter @femiglow/web test:coverage -- src/lib/i18n

# Reporter verbose pour debug
pnpm --filter @femiglow/web test:unit -- src/lib/i18n --reporter=verbose
```

Alias `package.json` à ajouter :

```json
{
  "scripts": {
    "test:i18n:wave1": "vitest run --config vitest.config.ts src/lib/i18n src/lib/checkout/i18n messages"
  }
}
```

#### Variables d'environnement

Aucune (tests purs).

#### Durée estimée

- Local (M1) : **~2 min**
- CI (4 workers) : **~1 min**

#### Output attendu

```
 RUN  v2.1.2 /Users/.../template-femiglow/apps/web

 ✓ src/lib/i18n/config.test.ts (12)
 ✓ src/lib/i18n/resolveLocale.test.ts (18)
 ✓ src/lib/i18n/matchLocale.test.ts (8)
 ✓ src/lib/i18n/formatters.test.ts (24)
 ✓ src/lib/i18n/pluralRules.test.ts (6)
 ✓ src/lib/checkout/i18n/dictionary.test.ts (5)
 ✓ messages/messages.shape.test.ts (4)
 ✓ messages/keys.snapshot.test.ts (3)

 Test Files  8 passed (8)
      Tests  80 passed (80)
   Start at  10:32:14
   Duration  1.87s (transform 234ms, setup 12ms, collect 421ms, tests 1.18s)

 % Coverage report from v8
-----------------------------------------------|---------|----------|---------|---------|
File                                           | % Stmts | % Branch | % Funcs | % Lines |
-----------------------------------------------|---------|----------|---------|---------|
 src/lib/i18n/config.ts                        |   100   |   100    |   100   |   100   |
 src/lib/i18n/resolveLocale.ts                 |   100   |   95.83  |   100   |   100   |
 src/lib/i18n/matchLocale.ts                   |   97.5  |   91.66  |   100   |   97.5  |
 src/lib/i18n/formatters.ts                    |   96.42 |   88.88  |   100   |   96.42 |
 src/lib/i18n/pluralRules.ts                   |   91.66 |   83.33  |   100   |   91.66 |
 src/lib/checkout/i18n/dictionary.ts           |   100   |   100    |   100   |   100   |
```

#### Exit criterion

- [ ] 100% tests green
- [ ] Coverage `lib/i18n/*` ≥ 90% lines
- [ ] Coverage `lib/checkout/i18n/dictionary.ts` = 100%
- [ ] Aucun `.skip` ou `.only` resté dans les fichiers
- [ ] Aucun snapshot obsolete (`vitest --run` ne propose pas d'update)

Si exit criterion non atteint → boucle correction (cf. `boucle-correction.md` § Phase 1).

#### Anti-patterns Wave 1

- ❌ Tester l'API `Intl.NumberFormat` elle-même (lib JS, déjà testée)
- ❌ Mock `Date.now()` sans `vi.useFakeTimers()` (non déterministe)
- ❌ Importer `messages/fr.json` brut sans parsing Zod (test d'IO, pas de logique)
- ❌ Coupler les tests de `resolveLocale` au middleware (helper pur, doit être testé isolé)
- ❌ Tester chaque clé `messages.json` une par une (faire un snapshot de la shape)

#### Exemples d'edge cases Wave 1

```ts
// resolveLocale edge cases
it.each([
  ['', 'fr'],                     // empty
  ['/', 'fr'],                    // root
  ['/fr', 'fr'],                  // path FR
  ['/ar/kit', 'ar'],              // path AR
  ['/xx/kit', 'fr'],              // unknown locale → fallback
  ['/FR/kit', 'fr'],              // case insensitive
  ['/fr-MA/kit', 'fr'],           // BCP-47 → base
  ['//ar//kit', 'ar'],            // double slashes
  ['/ar?lang=en', 'ar'],          // query param ignored
  [null as any, 'fr'],            // null
  [undefined as any, 'fr'],       // undefined
])('resolveLocale(%s) returns %s', (input, expected) => {
  expect(resolveLocale(input)).toBe(expected);
});

// formatCurrency edge cases
it.each([
  [0, 'fr', '0,00 MAD'],
  [0.01, 'fr', '0,01 MAD'],
  [-100, 'fr', '-100,00 MAD'],
  [Number.MAX_SAFE_INTEGER, 'fr', /MAD$/],  // pas crash sur very large
  [NaN, 'fr', '—'],                          // sentinel value
  [Infinity, 'fr', '—'],
])('formatCurrency(%s, %s) = %s', (amount, locale, expected) => {
  if (expected instanceof RegExp) {
    expect(formatCurrency(amount, locale)).toMatch(expected);
  } else {
    expect(formatCurrency(amount, locale)).toBe(expected);
  }
});
```

---

### Wave 2 — Component tests (RTL + RSC)

#### Objectif

Valider que les **composants React i18n** rendent correctement par locale, gèrent les interactions (keyboard, click), et exposent les bonnes ARIA attributes.

Une wave 2 verte garantit que **l'UI i18n n'est pas cassée au niveau composant**. Si elle fail, ce n'est pas la peine de tester l'intégration ou l'E2E.

#### Périmètre

| Composant | Tests | Coverage cible |
|---|---|---|
| `<LocaleSwitcher />` | render × 3 locales + open/close + select + keyboard | 85% |
| `<Header />` (parts i18n) | nav menu localisée + locale dans CTA | 80% |
| `<Footer />` (parts i18n) | links légaux + copyright | 80% |
| `<LangAttribute />` | `<html lang="...">` + `dir="rtl"` | 100% |
| `<HreflangTags />` | `<link rel="alternate" hreflang="..." />` | 90% |
| `<LocaleAware />` (HOC) | injecte `locale` prop | 80% |
| Wizard steps (FR/AR keys) | régression CHA-231 | 90% |
| Forms (newsletter, contact, lead) | placeholders + validations localisées | 80% |

#### Tests à exécuter

- **T044-T060** — LocaleSwitcher (render, open/close, keyboard, aria)
- **T061-T070** — Header + Footer i18n
- **T071-T075** — LangAttribute + HreflangTags
- **T076-T085** — Wizard FR/AR
- **T086-T095** — Forms localisés

Total : ~50 tests component.

#### Commande

```bash
# Lancement séquentiel
pnpm --filter @femiglow/web test:unit -- src/components/i18n src/components/header src/components/footer

# Watch mode local (rapide pendant dev)
pnpm --filter @femiglow/web test:unit -- src/components/i18n --watch
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave2": "vitest run src/components/i18n src/components/header src/components/footer src/components/wizard src/components/forms"
  }
}
```

#### Variables d'environnement

```bash
# Forcer le timezone pour déterminisme (sinon dates AR différentes selon machine)
TZ=Africa/Casablanca pnpm test:i18n:wave2
```

#### Durée estimée

- Local (M1) : **~5 min**
- CI (4 workers) : **~3 min**

#### Output attendu

```
 RUN  v2.1.2 /Users/.../template-femiglow/apps/web

 ✓ src/components/i18n/LocaleSwitcher.test.tsx (17)
 ✓ src/components/i18n/LangAttribute.test.tsx (4)
 ✓ src/components/i18n/HreflangTags.test.tsx (5)
 ✓ src/components/header/Header.i18n.test.tsx (8)
 ✓ src/components/footer/Footer.i18n.test.tsx (6)
 ✓ src/components/wizard/WizardStep.i18n.test.tsx (10)
 ✓ src/components/forms/LeadForm.i18n.test.tsx (6)

 Test Files  7 passed (7)
      Tests  56 passed (56)
   Duration  4m 47s
```

#### Exit criterion

- [ ] 100% tests green
- [ ] Coverage `components/i18n/*` ≥ 85%
- [ ] Coverage `components/header,footer,wizard,forms` ≥ 80%
- [ ] Snapshots à jour (3 par composant × locale)
- [ ] Aucun warning console (`console.warn`, `console.error`) pendant les tests

#### Anti-patterns Wave 2

- ❌ `screen.getByText('Découvrir')` → couplé à FR, casse en AR
- ✅ `screen.getByRole('button', { name: /locale_switcher.label/ })` + provider mocké
- ❌ Render sans `NextIntlClientProvider` wrapper → crash sur `useTranslations`
- ✅ Helper `renderWithIntl(<Component />, { locale: 'ar' })`
- ❌ Snapshot complet du DOM → 200 lignes, illisible en diff
- ✅ Snapshot ciblé (`expect(switcher).toMatchInlineSnapshot()`) avec mask
- ❌ Tester `useEffect` (dépend de React internals) au lieu du résultat utilisateur

#### Exemples de tests Wave 2

```tsx
// LocaleSwitcher.test.tsx
import { renderWithIntl } from '@/test/helpers/i18n/render-with-i18n';

describe('LocaleSwitcher', () => {
  it.each(['fr', 'ar', 'en'] as const)('renders trigger with %s label', async (locale) => {
    const { getByRole } = renderWithIntl(<LocaleSwitcher />, { locale });
    const trigger = getByRole('button', { name: /locale.switcher/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('shows aria-current on active locale in dropdown', async () => {
    const user = userEvent.setup();
    const { getByRole, getAllByRole } = renderWithIntl(<LocaleSwitcher />, { locale: 'ar' });
    await user.click(getByRole('button', { name: /locale.switcher/i }));
    const items = getAllByRole('menuitemradio');
    const activeItem = items.find((el) => el.getAttribute('aria-current') === 'true');
    expect(activeItem).toHaveTextContent('العربية');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { getByRole, queryByRole } = renderWithIntl(<LocaleSwitcher />, { locale: 'fr' });
    await user.click(getByRole('button'));
    expect(getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

---

### Wave 3 — Integration tests (MSW + API + DB)

#### Objectif

Valider les **routes API i18n** + **middleware locale** + **DB operations** dans un environnement contrôlé (MSW + DB de test).

Une wave 3 verte garantit que la couche serveur fonctionne avant qu'on lance l'E2E lourd.

#### Périmètre

| Endpoint | Tests cibles | Coverage |
|---|---|---|
| `GET /api/i18n/coverage` | 200 / 401 / 429 / shape | 90% |
| `GET /api/i18n/missing-keys?locale=ar` | 200 / pagination / filter | 90% |
| `POST /api/admin/i18n/upsert-message` | 200 / 401 / 422 / audit log | 90% |
| `POST /api/admin/i18n/locales` | CRUD locales | 85% |
| `POST /api/admin/i18n/export?format=csv` | export | 80% |
| `POST /api/admin/i18n/import` | import + diff | 80% |
| `POST /api/i18n/locale/switch` | cookie set + redirect | 95% |
| `middleware.ts` (locale logic) | path > cookie > header → locale + redirect | 100% |
| DB `i18nLocales` repo | CRUD + soft delete | 90% |
| DB `i18nTranslationKeys` repo | upsert + retrieve | 90% |
| DB `i18nTranslationValues` repo | upsert + audit | 90% |

#### Tests à exécuter

- **T096-T120** — Routes API i18n (coverage, missing-keys, upsert, locale switch)
- **T121-T130** — Middleware locale resolution
- **T131-T145** — Repos DB

Total : ~40 tests integration.

#### Commande

```bash
# Lancement avec MSW + DB test
pnpm --filter @femiglow/web test:int -- src/app/api/i18n src/app/api/admin/i18n middleware.test src/lib/i18n/repos

# Lancement séparé route par route (debug)
pnpm --filter @femiglow/web test:int -- src/app/api/admin/i18n/upsert-message/route.test.ts
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave3": "vitest run --config vitest.integration.config.ts src/app/api/i18n src/app/api/admin/i18n src/lib/i18n/repos"
  }
}
```

#### Variables d'environnement

```bash
# DB de test (séparée de la DB dev)
DATABASE_URL_TEST=postgresql://localhost:5432/femiglow_test
TEST_USE_MSW=true
TEST_SEED=true  # seed avant lancement
```

#### Setup pré-wave 3

```bash
# Reset + seed DB test
pnpm --filter @femiglow/web db:test:reset
pnpm --filter @femiglow/web db:test:migrate
pnpm --filter @femiglow/web db:test:seed -- --i18n-fixtures
```

#### Durée estimée

- Local (M1) : **~6 min** (incluant setup DB)
- CI (4 workers) : **~4 min**

#### Output attendu

```
 RUN  v2.1.2 /Users/.../template-femiglow/apps/web

 ✓ src/app/api/i18n/coverage/route.test.ts (8)
 ✓ src/app/api/i18n/missing-keys/route.test.ts (6)
 ✓ src/app/api/admin/i18n/upsert-message/route.test.ts (10)
 ✓ src/app/api/admin/i18n/locales/route.test.ts (5)
 ✓ src/app/api/admin/i18n/export/route.test.ts (4)
 ✓ src/app/api/admin/i18n/import/route.test.ts (4)
 ✓ src/app/api/i18n/locale/switch/route.test.ts (5)
 ✓ middleware.test.ts (15)
 ✓ src/lib/i18n/repos/locales.repo.test.ts (6)

 Test Files  9 passed (9)
      Tests  63 passed (63)
   Duration  5m 38s
```

#### Exit criterion

- [ ] 100% tests green
- [ ] Coverage routes API ≥ 90%
- [ ] Coverage middleware.ts (locale logic) = 100%
- [ ] DB de test rollback propre après run (pas de fuite entre tests)
- [ ] Aucun handler MSW orphelin (`server.resetHandlers()` partout)

#### Anti-patterns Wave 3

- ❌ Mocker la DB avec `vi.mock('@/lib/db')` global → on ne teste plus rien d'intégration
- ✅ Utiliser une vraie DB Postgres en local avec un schéma `test` séparé
- ❌ Partager un état DB entre tests (test 1 crée user → test 2 lit user)
- ✅ Chaque test crée + cleanup ses fixtures (`beforeEach` + `afterEach`)
- ❌ Tester le middleware via Playwright (trop lent, refait pour l'intégration)
- ✅ Tester le middleware via `NextRequest` mockée

#### Exemples de tests Wave 3

```ts
// middleware.test.ts
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('middleware locale resolution', () => {
  it.each([
    // [url, cookie, acceptLanguage, expectedRedirect, expectedLocale]
    ['/contact', undefined, undefined, '/fr/contact', 'fr'],
    ['/contact', 'NEXT_LOCALE=ar', undefined, '/ar/contact', 'ar'],
    ['/contact', undefined, 'en-US,en;q=0.9', '/en/contact', 'en'],
    ['/ar/contact', undefined, undefined, null, 'ar'],
    ['/fr/contact', 'NEXT_LOCALE=ar', undefined, null, 'fr'], // path wins
    ['/xx/contact', undefined, undefined, '/fr/xx/contact', 'fr'],
  ])('url=%s cookie=%s header=%s → redirect=%s locale=%s', async (url, cookie, header, expectedRedirect, expectedLocale) => {
    const req = new NextRequest(`http://localhost${url}`, {
      headers: {
        ...(cookie && { cookie }),
        ...(header && { 'accept-language': header }),
      },
    });
    const response = await middleware(req);
    if (expectedRedirect) {
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain(expectedRedirect);
    } else {
      expect(response.headers.get('x-locale')).toBe(expectedLocale);
    }
  });
});
```

---

### Wave 4 — E2E flows (Playwright × 3 locales)

#### Objectif

Valider les **flows utilisateur critiques** dans un vrai navigateur, sur chaque locale, avec layout RTL pour AR.

C'est la wave la plus coûteuse. On la lance **uniquement après que les waves 1-3 soient vertes**.

#### Périmètre

| Flow | Locales | Spec file |
|---|---|---|
| Visit + switch locale + reload | FR/AR/EN | `e2e/i18n/locale-switcher.spec.ts` |
| Cookie `NEXT_LOCALE` persistance | FR/AR/EN | `e2e/i18n/cookie-persist.spec.ts` |
| Deep link `/ar/kit?utm=xyz` préserve UTM | AR | `e2e/i18n/deep-link-utm.spec.ts` |
| 404 localisée | FR/AR/EN | `e2e/i18n/404-localized.spec.ts` |
| Wizard checkout complet (5 steps) | FR/AR/EN | `e2e/i18n/wizard-checkout.spec.ts` |
| Newsletter signup | FR/AR/EN | `e2e/i18n/newsletter.spec.ts` |
| Lead form contact | FR/AR/EN | `e2e/i18n/lead-form.spec.ts` |
| Admin dashboard i18n | FR | `e2e/i18n/admin-dashboard.spec.ts` |
| Hreflang tags présents | FR/AR/EN | `e2e/i18n/hreflang.spec.ts` |
| `<html lang="..." dir="...">` correct | FR/AR/EN | `e2e/i18n/lang-attribute.spec.ts` |
| Mid-funnel locale switch (préserve panier) | FR↔AR | `e2e/i18n/mid-funnel-switch.spec.ts` |
| Login admin + locale persistance | FR/AR/EN | `e2e/i18n/admin-login-locale.spec.ts` |
| Search + filter localisés | FR/AR/EN | `e2e/i18n/search.spec.ts` |

Total : ~50 specs × 3 locales (en moyenne) = ~150 runs E2E.

#### Tests à exécuter

- **T200-T250** — E2E flows critical

#### Commande

```bash
# Lancement complet (3 projects en parallèle)
pnpm --filter @femiglow/web test:e2e -- e2e/i18n

# Un seul project (locale)
pnpm --filter @femiglow/web test:e2e -- e2e/i18n --project=chromium-fr
pnpm --filter @femiglow/web test:e2e -- e2e/i18n --project=chromium-ar
pnpm --filter @femiglow/web test:e2e -- e2e/i18n --project=chromium-en

# Spec unique pour debug
pnpm --filter @femiglow/web test:e2e -- e2e/i18n/wizard-checkout.spec.ts --headed --debug

# Mode UI Playwright (debug visuel)
pnpm --filter @femiglow/web test:e2e -- e2e/i18n --ui
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave4": "playwright test e2e/i18n --reporter=list,html",
    "test:i18n:wave4:fr": "playwright test e2e/i18n --project=chromium-fr",
    "test:i18n:wave4:ar": "playwright test e2e/i18n --project=chromium-ar",
    "test:i18n:wave4:en": "playwright test e2e/i18n --project=chromium-en"
  }
}
```

#### Variables d'environnement

```bash
# Base URL du serveur Next.js dev/staging
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Si CI distant, utiliser staging
PLAYWRIGHT_BASE_URL=https://staging.femiglow.com

# Workers parallèles (CI uniquement)
CI=true   # active 4 workers par défaut
```

#### Setup pré-wave 4

```bash
# 1. Installer browsers Playwright
pnpm exec playwright install --with-deps chromium

# 2. Démarrer Next.js dev (autre terminal) ou utiliser webServer config
pnpm --filter @femiglow/web dev

# 3. Attendre que le serveur soit prêt
curl -f http://localhost:3000/fr || echo "Serveur pas prêt"
```

Ou avec `webServer` Playwright config (recommandé) :

```ts
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'pnpm --filter @femiglow/web dev',
    url: 'http://localhost:3000/fr',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

#### Durée estimée

- Local (M1, 4 workers parallèle) : **~25 min**
- CI (4 workers, 3 projects) : **~10 min**

#### Output attendu

```
Running 150 tests using 4 workers

  ✓ e2e/i18n/locale-switcher.spec.ts:3:1 › switches FR to AR and preserves URL (4.2s)
  ✓ e2e/i18n/cookie-persist.spec.ts:8:1 › cookie NEXT_LOCALE survives reload (3.1s)
  ✓ e2e/i18n/wizard-checkout.spec.ts:15:1 › full wizard FR (12.4s)
  ...

  150 passed (10m 24s)

To open last HTML report run:
  npx playwright show-report
```

#### Exit criterion

- [ ] 100% tests green sur **3 runs consécutifs** (anti-flaky)
- [ ] 0 test marqué `.skip` sans ticket associé
- [ ] Pas de timeout > 30s par test (sinon spec mal écrite)
- [ ] Tous les screenshots de failure réviewés
- [ ] HTML report archivé pour audit (`playwright-report/`)

#### Anti-patterns Wave 4

- ❌ `page.getByText('Découvrir')` → FR-only, casse en AR
- ✅ `page.getByTestId('locale-switcher-button')` ou `page.getByRole('button', { name: /locale.switcher/i })`
- ❌ Ne pas mock les API externes (Sendgrid, Stripe) → flaky
- ✅ Mock via `page.route('**/api/external/**', ...)`
- ❌ `await page.waitForTimeout(1000)` → race condition cachée
- ✅ `await page.waitForLoadState('networkidle')` ou `await expect(locator).toBeVisible()`
- ❌ Stocker des selectors hardcodés dans plein de specs
- ✅ Pattern Page Object (`e2e/pom/HomePage.ts`, `e2e/pom/WizardPage.ts`)

#### Exemples de tests Wave 4

```ts
// e2e/i18n/wizard-checkout.spec.ts
import { test, expect } from '@playwright/test';
import { WizardPage } from '../pom/WizardPage';

test.describe('@critical wizard checkout multi-locale', () => {
  for (const locale of ['fr', 'ar', 'en'] as const) {
    test(`completes wizard in ${locale}`, async ({ page }) => {
      const wizard = new WizardPage(page, locale);
      await wizard.goto();
      await wizard.fillStep1({ email: 'test@femiglow.ma', phone: '+212600000000' });
      await wizard.goToStep2();
      await wizard.fillStep2({ city: 'Casablanca', address: '12 rue Idriss' });
      await wizard.goToStep3();
      await wizard.selectShipping('standard');
      await wizard.goToStep4();
      await wizard.selectPayment('cod');
      await wizard.goToStep5();
      await wizard.confirm();
      await expect(page).toHaveURL(new RegExp(`/${locale}/order/confirmation`));
      await expect(page.getByTestId('order-confirmation-message')).toBeVisible();
      // Validation locale-aware
      const html = await page.locator('html').first();
      await expect(html).toHaveAttribute('lang', locale);
      if (locale === 'ar') {
        await expect(html).toHaveAttribute('dir', 'rtl');
      }
    });
  }
});
```

---

### Wave 5 — Visual regression (snapshots par locale)

#### Objectif

Détecter les **régressions visuelles** par locale, en particulier sur le layout RTL en arabe (logical properties Tailwind).

Une wave 5 verte garantit que le visuel n'a pas drift de manière inattendue.

#### Périmètre

| Page | Locales | Viewports |
|---|---|---|
| `/{locale}/` (home) | FR/AR/EN | desktop 1280 + mobile 375 |
| `/{locale}/kit` | FR/AR/EN | desktop 1280 + mobile 375 |
| `/{locale}/maison` | FR/AR/EN | desktop 1280 + mobile 375 |
| `/{locale}/journal` | FR/AR/EN | desktop 1280 + mobile 375 |
| `/{locale}/checkout` (step 1) | FR/AR/EN | desktop 1280 + mobile 375 |
| `/{locale}/admin/i18n/dashboard` | FR | desktop 1280 |

Total : 5 pages × 3 locales × 2 viewports + 1 admin = **31 snapshots**.

#### Tests à exécuter

- **T251-T280** — Visual snapshots i18n

#### Commande

```bash
# Run visual contre baseline existante
pnpm --filter @femiglow/web test:visual

# Update baseline (après refactor légitime, jamais sans review)
pnpm --filter @femiglow/web test:visual -- --update-snapshots

# Pour une seule page (debug)
pnpm --filter @femiglow/web test:visual -- e2e/visual/home.visual.spec.ts --project=chromium-ar
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave5": "playwright test e2e/visual --grep i18n --reporter=list,html"
  }
}
```

#### Variables d'environnement

```bash
# Threshold pixel diff (à ajuster selon stabilité)
PW_VISUAL_THRESHOLD=0.2  # 0.2 = 20% pixels max diff

# Si CI Linux et baseline macOS, désactivé
SKIP_VISUAL_ON_NON_LINUX=true
```

#### Setup pré-wave 5

```bash
# Vérifier que les baselines existent
ls apps/web/e2e/visual/__snapshots__/

# Si pas de baseline, générer (uniquement la première fois)
pnpm test:visual -- --update-snapshots
```

#### Durée estimée

- Local (M1) : **~8 min**
- CI (4 workers) : **~5 min**

#### Output attendu

```
Running 31 tests using 4 workers

  ✓ e2e/visual/home.visual.spec.ts:5:1 › home FR desktop (3.2s)
  ✓ e2e/visual/home.visual.spec.ts:5:1 › home AR desktop (3.4s)
  ✓ e2e/visual/home.visual.spec.ts:5:1 › home EN desktop (3.1s)
  ...

  31 passed (4m 53s)
```

Si diff détecté :

```
  ✗ e2e/visual/kit.visual.spec.ts:8:1 › kit AR desktop
    Screenshot comparison failed:

    1247 pixels (ratio 0.0023 of all image pixels) are different

    Expected: kit-ar-desktop-linux.png
    Received: kit-ar-desktop-linux-actual.png
    Diff:     kit-ar-desktop-linux-diff.png
```

#### Exit criterion

- [ ] 0 diff inattendu (tous les diffs sont review et approuvés ou snapshot update)
- [ ] Baseline régénérée si refactor visuel légitime (avec PR séparée)
- [ ] HTML report archivé avec screenshots avant/après
- [ ] Mask correctement appliqué sur éléments dynamiques (date, heure, prix volatil)

#### Anti-patterns Wave 5

- ❌ Snapshot full page sans `mask` des éléments dynamiques → flaky pour 1 pixel de date
- ✅ `await page.locator('main').screenshot({ mask: [page.locator('[data-dynamic]')] })`
- ❌ `--update-snapshots` direct en CI sans review → on légitime des régressions
- ✅ Update en local + commit + diff PR review
- ❌ Threshold 0% pixel diff → flaky (sub-pixel rendering OS-dépendant)
- ✅ Threshold raisonnable 0.2-0.5%
- ❌ Snapshots stockés dans Git (sans LFS) → repo bloat
- ✅ Git LFS pour `.png` snapshots

#### Exemples de tests Wave 5

```ts
// e2e/visual/kit.visual.spec.ts
import { test, expect } from '@playwright/test';

const LOCALES = ['fr', 'ar', 'en'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 667 },
] as const;

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    test(`kit ${locale} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${locale}/kit`);
      await page.waitForLoadState('networkidle');

      // Hide volatile elements
      await page.addStyleTag({
        content: `
          [data-volatile], time, [data-testid="cart-count"] { visibility: hidden !important; }
        `,
      });

      await expect(page).toHaveScreenshot(`kit-${locale}-${viewport.name}.png`, {
        fullPage: true,
        mask: [page.locator('[data-dynamic]')],
        maxDiffPixelRatio: 0.005,
      });
    });
  }
}
```

---

### Wave 6 — A11y RTL (axe + keyboard + lang attribute)

#### Objectif

Garantir que l'application est **accessible WCAG 2.1 AA** par locale, en particulier sur le layout RTL en arabe (focus order, dir attribute, keyboard navigation).

#### Périmètre

| Page | Locale | Tests |
|---|---|---|
| `/{locale}/` (home) | FR/AR/EN | axe scan + keyboard + lang attr |
| `/{locale}/kit` | FR/AR/EN | axe scan + keyboard + lang attr |
| `/{locale}/checkout` (step 1) | FR/AR/EN | axe scan + tab order + form labels |
| `/{locale}/maison` | FR/AR/EN | axe scan + keyboard |
| Header global | FR/AR/EN | LocaleSwitcher keyboard + focus visible |
| Footer global | FR/AR/EN | navigation links keyboard |

Total : 6 contexts × 3 locales = **18 scans axe** + tests keyboard dédiés.

#### Tests à exécuter

- **T281-T310** — A11y scans + keyboard navigation

#### Commande

```bash
# Lancement complet
pnpm --filter @femiglow/web test:a11y -- e2e/a11y/i18n

# Pour une locale
pnpm --filter @femiglow/web test:a11y -- e2e/a11y/i18n --project=chromium-ar
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave6": "playwright test e2e/a11y/i18n --reporter=list,html"
  }
}
```

#### Durée estimée

- Local : **~4 min**
- CI : **~3 min**

#### Output attendu

```
Running 18 tests using 4 workers

  ✓ e2e/a11y/i18n/home.a11y.spec.ts:5:1 › home FR axe scan (2.1s)
  ✓ e2e/a11y/i18n/home.a11y.spec.ts:5:1 › home AR axe scan (2.3s)
  ✓ e2e/a11y/i18n/home.a11y.spec.ts:5:1 › home EN axe scan (2.0s)
  ✓ e2e/a11y/i18n/locale-switcher.a11y.spec.ts:10:1 › keyboard navigation FR (1.5s)
  ✓ e2e/a11y/i18n/locale-switcher.a11y.spec.ts:10:1 › keyboard navigation AR (1.6s)
  ...

  18 passed (2m 47s)
```

#### Exit criterion

- [ ] 0 violation `critical` axe-core sur 18 scans
- [ ] 0 violation `serious` axe-core sur 18 scans
- [ ] Keyboard navigation 100% testée sur LocaleSwitcher
- [ ] `<html lang="...">` correct sur toutes les pages (FR/AR/EN)
- [ ] `<html dir="rtl">` correct sur les pages AR
- [ ] Focus visible avec contraste ≥ 3:1 (manuel : test sur baseline screenshots)
- [ ] Tab order logique en RTL (cf. focus-order section axe-core)

#### Anti-patterns Wave 6

- ❌ `expect(await new AxeBuilder({ page }).analyze()).toBeTruthy()` → assertion trop vague
- ✅ `expect(violations.filter(v => ['critical','serious'].includes(v.impact))).toEqual([])`
- ❌ Ignorer une violation parce que "c'est juste un warning"
- ✅ Documenter explicitement les exclusions dans la spec avec commentaire JIRA
- ❌ Tester axe sans lancer le JS de la page → faux negatives
- ✅ `await page.waitForLoadState('networkidle')` avant scan

#### Exemples de tests Wave 6

```ts
// e2e/a11y/i18n/home.a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['fr', 'ar', 'en'] as const) {
  test(`home ${locale} axe scan`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[data-volatile]')
      .analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    // Log all violations for visibility but only fail on critical/serious
    if (results.violations.length > 0) {
      console.warn(`A11y violations in ${locale}:`, results.violations.map((v) => v.id));
    }

    expect(criticalOrSerious, JSON.stringify(criticalOrSerious, null, 2)).toEqual([]);
  });

  test(`home ${locale} html lang and dir attributes`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    if (locale === 'ar') {
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    } else {
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    }
  });
}
```

---

### Wave 7 — Performance (bundle + LCP + lazy loading)

#### Objectif

Garantir que **l'introduction de i18n n'a pas dégradé les perfs** au-delà du seuil acceptable (budget +5% LCP, -2pts Lighthouse perf).

#### Périmètre

| Métrique | Cible | Outil |
|---|---|---|
| Lighthouse Performance score | ≥ 90 par locale | Lighthouse CI |
| Lighthouse Accessibility score | ≥ 95 par locale | Lighthouse CI |
| Lighthouse Best Practices | ≥ 90 | Lighthouse CI |
| Lighthouse SEO | ≥ 90 | Lighthouse CI |
| LCP (Largest Contentful Paint) | < 2.5s par locale | Lighthouse CI |
| FID (First Input Delay) | < 100ms | Lighthouse CI |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse CI |
| Bundle `messages/fr.json` | < 15 KB gzipped | bundle-analyzer |
| Bundle `messages/ar.json` | < 18 KB gzipped (caractères AR plus lourds) | bundle-analyzer |
| Bundle `messages/en.json` | < 15 KB gzipped | bundle-analyzer |
| Total JS bundle delta vs baseline | < +5% | bundle-analyzer |
| Lazy loading `messages` par locale | actif | manual check |

#### Tests à exécuter

```bash
# Lighthouse CI sur les 3 locales
pnpm --filter @femiglow/web test:perf:lighthouse

# Bundle analyzer
pnpm --filter @femiglow/web build
pnpm --filter @femiglow/web analyze

# Custom script pour comparer bundle size vs baseline
node scripts/perf/compare-bundle.mjs --baseline=.next-baseline --current=.next
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave7": "pnpm test:perf:lighthouse && node scripts/perf/check-bundle-size.mjs"
  }
}
```

#### Variables d'environnement

```bash
# URL cible Lighthouse (staging recommandé)
LHCI_URL=https://staging.femiglow.com

# Budget bundle
BUNDLE_BUDGET_DELTA_PCT=5
```

#### Setup pré-wave 7

```bash
# 1. Build production
pnpm --filter @femiglow/web build

# 2. Démarrer en mode prod
pnpm --filter @femiglow/web start &

# 3. Attendre prêt
curl -f http://localhost:3000/fr || sleep 2
```

#### Durée estimée

- Local : **~5 min**
- CI : **~3 min**

#### Output attendu

```
[Lighthouse CI]
http://localhost:3000/fr
  Performance:    93/100 ✓
  Accessibility:  96/100 ✓
  Best Practices: 92/100 ✓
  SEO:            94/100 ✓

http://localhost:3000/ar
  Performance:    91/100 ✓
  Accessibility:  96/100 ✓
  Best Practices: 92/100 ✓
  SEO:            94/100 ✓

http://localhost:3000/en
  Performance:    93/100 ✓
  Accessibility:  96/100 ✓
  Best Practices: 92/100 ✓
  SEO:            94/100 ✓

[Bundle analysis]
messages/fr.json:  12.3 KB gzipped ✓ (budget 15 KB)
messages/ar.json:  14.8 KB gzipped ✓ (budget 18 KB)
messages/en.json:  11.9 KB gzipped ✓ (budget 15 KB)

Total bundle delta: +3.2% ✓ (budget 5%)
```

#### Exit criterion

- [ ] Lighthouse Performance ≥ 90 sur 3 locales
- [ ] Lighthouse Accessibility ≥ 95 sur 3 locales
- [ ] LCP < 2.5s sur 3 locales
- [ ] CLS < 0.1 sur 3 locales
- [ ] Bundle `messages/<locale>.json` ≤ budget
- [ ] Bundle JS total delta ≤ +5% vs baseline pré-i18n
- [ ] Lazy loading `messages` confirmé (vérif dans `_app` ou layout)

#### Anti-patterns Wave 7

- ❌ Lighthouse en dev mode → score artificiellement bas
- ✅ Lighthouse en prod build (`pnpm start`)
- ❌ Comparer bundle uniquement uncompressed → trompeur (gzip réduit fortement)
- ✅ Comparer gzipped (Brotli si servi via Vercel)
- ❌ Charger tous les `messages/*.json` au layout root → bundle gonfle
- ✅ Lazy load par locale active uniquement (next-intl gère par défaut)
- ❌ Ignorer un Lighthouse à 89/100 ("c'est presque 90")
- ✅ Tâche dédiée pour passer à 90+, sinon non-compliance documentée

---

### Wave 8 — Robustness (fuzz + chaos + edge cases)

#### Objectif

Casser le système pour confirmer qu'il **ne crash pas** sur inputs hostiles, états anormaux, conditions limites.

C'est la wave finale et **la plus importante pour la robustesse** (cf. brief utilisateur).

#### Périmètre

| Catégorie | Test | Outil |
|---|---|---|
| **Fuzz inputs** | `resolveLocale` avec 1000 strings random | fast-check |
| **Fuzz inputs** | `matchLocale` avec 500 BCP-47 random | fast-check |
| **Fuzz inputs** | `formatCurrency` avec 500 floats (inclu NaN, ±Infinity) | fast-check |
| **Fuzz inputs** | `formatDate` avec 500 dates random (inclu invalid Date) | fast-check |
| **Edge case** | Très longue string (10000 chars) en messages.json | manual |
| **Edge case** | Emojis dans une traduction (`🎉 Bienvenue`) | manual |
| **Edge case** | Caractères AR spéciaux (Tatweel ـ, kashida) | manual |
| **Edge case** | Mixed direction text (LTR + RTL dans un même paragraphe) | manual |
| **Edge case** | Locale exotique demandée (`/zh/kit` non supportée) | E2E |
| **Edge case** | Cookie corrompu `NEXT_LOCALE=invalid` | E2E |
| **Edge case** | Accept-Language vide ou mal formé | unit middleware |
| **Edge case** | Path avec trailing slash + query (`/ar/kit/?utm=x`) | E2E |
| **Edge case** | Double slashes (`//ar///kit`) | E2E |
| **Edge case** | Unicode escape dans path (`/ar/k%C3%A9t`) | E2E |
| **Chaos** | Coupure réseau pendant fetch translations | Playwright + page.route |
| **Chaos** | DB timeout sur endpoint coverage | MSW timeout |
| **Chaos** | Cache invalidation race (2 upserts simultanés) | integration |
| **Chaos** | Switch locale pendant un fetch SSR (race condition) | E2E |
| **Robustness** | XSS dans un message ICU (`<script>alert(1)</script>`) | unit sanitize |
| **Robustness** | Injection RTL override (U+202E character) | unit sanitize |

Total : ~20 tests intensifs.

#### Tests à exécuter

- **T311-T330** — Robustness suite

#### Commande

```bash
# Fuzz tests
pnpm --filter @femiglow/web test:fuzz

# Chaos tests E2E
pnpm --filter @femiglow/web test:chaos

# Edge cases unit
pnpm --filter @femiglow/web test:unit -- src/lib/i18n/edge-cases
```

Alias :

```json
{
  "scripts": {
    "test:i18n:wave8": "vitest run src/lib/i18n/edge-cases && playwright test e2e/chaos --reporter=list,html"
  }
}
```

#### Variables d'environnement

```bash
# Fast-check seed (déterministe)
FAST_CHECK_SEED=42

# Nombre de runs (CI: 1000, local debug: 100)
FAST_CHECK_NUM_RUNS=1000
```

#### Durée estimée

- Local : **~10 min** (1000 fuzz runs)
- CI : **~5 min**

#### Output attendu

```
[Fuzz tests]
 ✓ resolveLocale never crashes on random input (1000 runs) (1.2s)
 ✓ matchLocale never returns invalid locale (500 runs) (0.8s)
 ✓ formatCurrency handles edge floats (500 runs) (1.5s)

[Chaos tests]
 ✓ locale switch during SSR fetch — no mix (5.3s)
 ✓ corrupted NEXT_LOCALE cookie falls back to default (3.1s)
 ✓ XSS in ICU message is escaped (1.2s)

20 passed (8m 12s)
```

#### Exit criterion

- [ ] 0 crash sur fuzz inputs (1000+ runs)
- [ ] 0 data loss sur chaos scenarios
- [ ] 0 XSS leak via messages ICU
- [ ] Tous les edge cases passent (long strings, emojis, special chars)
- [ ] Mixed direction text rendu correctement (RTL bidi algorithm)

#### Anti-patterns Wave 8

- ❌ Sauter Wave 8 sous prétexte que "le reste est vert"
- ❌ Faire un fuzz avec 10 runs (statistiquement insignifiant)
- ✅ 1000+ runs avec seed déterministe pour reproductibilité
- ❌ Mocker l'erreur réseau au niveau du test (`vi.mock`) au lieu de la simuler
- ✅ Simuler via `page.route('**/api/i18n/**', (route) => route.abort())`
- ❌ Tester XSS uniquement en E2E (lent), pas en unit (rapide)
- ✅ Tester sanitization en unit + smoke test E2E

#### Exemples de tests Wave 8

```ts
// src/lib/i18n/edge-cases/fuzz.test.ts
import fc from 'fast-check';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { formatCurrency } from '@/lib/i18n/formatters';
import { LOCALES } from '@/lib/i18n/config';

describe('Fuzz tests robustness', () => {
  it('resolveLocale never crashes and always returns a valid locale', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = resolveLocale(input);
        expect(LOCALES).toContain(result);
      }),
      { numRuns: 1000, seed: 42 },
    );
  });

  it('formatCurrency handles NaN, Infinity, very large/small numbers', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.float(), fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity)),
        fc.constantFrom(...LOCALES),
        (amount, locale) => {
          const result = formatCurrency(amount, locale);
          expect(typeof result).toBe('string');
          expect(result.length).toBeLessThan(50); // pas d'explosion
        }
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// src/lib/i18n/edge-cases/xss.test.ts
import { sanitizeMessage } from '@/lib/i18n/sanitize';

describe('XSS protection in messages', () => {
  it.each([
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
    ['javascript:alert(1)', 'alert(1)'],          // protocol stripped
    ['‮exploitRTL', 'exploitRTL'],            // U+202E stripped
  ])('sanitizes %s', (input, expected) => {
    expect(sanitizeMessage(input)).toBe(expected);
  });
});

// e2e/chaos/locale-switch-race.spec.ts
test('locale switch during SSR fetch does not mix FR/AR content', async ({ page }) => {
  await page.goto('/fr/kit');
  // Click switch to AR mais bloquer le fetch
  await page.route('**/api/i18n/**', async (route) => {
    await new Promise((r) => setTimeout(r, 2000)); // 2s delay
    route.continue();
  });
  await page.getByTestId('locale-switcher-button').click();
  await page.getByRole('menuitemradio', { name: /العربية/ }).click();
  // Page doit montrer un loading state, pas un mix
  await expect(page.getByTestId('loading-skeleton')).toBeVisible();
  await page.unroute('**/api/i18n/**');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});
```

---

## Section 3 — Commandes maître

### 3.1 Exécution séquentielle complète

```bash
# Run all 8 waves in order (échoue à la première wave rouge)
pnpm --filter @femiglow/web test:i18n:all
```

Implémentation `package.json` :

```json
{
  "scripts": {
    "test:i18n:all": "pnpm test:i18n:wave1 && pnpm test:i18n:wave2 && pnpm test:i18n:wave3 && pnpm test:i18n:wave4 && pnpm test:i18n:wave5 && pnpm test:i18n:wave6 && pnpm test:i18n:wave7 && pnpm test:i18n:wave8"
  }
}
```

### 3.2 Exécution parallèle (CI)

```bash
# Waves indépendantes en parallèle
pnpm --filter @femiglow/web test:i18n:parallel
```

GitHub Actions workflow :

```yaml
jobs:
  wave1-foundation:
    runs-on: ubuntu-latest
    steps: [..., pnpm test:i18n:wave1]
  wave2-component:
    runs-on: ubuntu-latest
    needs: wave1-foundation
    steps: [..., pnpm test:i18n:wave2]
  wave3-integration:
    runs-on: ubuntu-latest
    needs: wave1-foundation
    steps: [..., pnpm test:i18n:wave3]
  wave4-e2e:
    runs-on: ubuntu-latest
    needs: [wave2-component, wave3-integration]
    strategy:
      matrix:
        locale: [fr, ar, en]
    steps: [..., pnpm test:i18n:wave4:${{ matrix.locale }}]
  wave5-visual:
    runs-on: ubuntu-latest
    needs: wave4-e2e
    steps: [..., pnpm test:i18n:wave5]
  wave6-a11y:
    runs-on: ubuntu-latest
    needs: wave4-e2e
    steps: [..., pnpm test:i18n:wave6]
  wave7-perf:
    runs-on: ubuntu-latest
    needs: wave4-e2e
    steps: [..., pnpm test:i18n:wave7]
  wave8-robustness:
    runs-on: ubuntu-latest
    needs: [wave1-foundation, wave3-integration]
    steps: [..., pnpm test:i18n:wave8]
```

### 3.3 Exécution wave par wave (debug)

```bash
pnpm test:i18n:wave1   # Foundation
pnpm test:i18n:wave2   # Component
pnpm test:i18n:wave3   # Integration
pnpm test:i18n:wave4   # E2E
pnpm test:i18n:wave5   # Visual
pnpm test:i18n:wave6   # A11y
pnpm test:i18n:wave7   # Performance
pnpm test:i18n:wave8   # Robustness
```

### 3.4 Commandes utilitaires

```bash
# Run uniquement les tests qui ont fail au dernier run
pnpm --filter @femiglow/web test:i18n:retry-failed

# Update snapshots après refactor légitime (avec review obligatoire)
pnpm --filter @femiglow/web test:i18n:update-snapshots

# Run en mode watch (dev local)
pnpm --filter @femiglow/web test:i18n:watch

# Run avec coverage et HTML report
pnpm --filter @femiglow/web test:i18n:coverage

# Stop après le premier fail (`bail`)
pnpm --filter @femiglow/web test:i18n:bail

# Inspecter une wave en interactif Playwright
pnpm --filter @femiglow/web test:i18n:wave4 -- --ui

# Reporter JUnit XML pour CI
pnpm --filter @femiglow/web test:i18n:all -- --reporter=junit --outputFile=junit.xml
```

Voir liste complète dans `runbook-tests.md` § 3.

---

## Section 4 — Output et reporting

### 4.1 Formats d'output

| Format | Usage | Outil | Fichier |
|---|---|---|---|
| **JUnit XML** | CI ingestion, badge build | Vitest + Playwright | `junit.xml` |
| **HTML report** | Visualiser en local | Vitest + Playwright | `vitest-report/index.html`, `playwright-report/index.html` |
| **JSON coverage** | Gates CI | Vitest --coverage --reporter=json | `coverage/coverage-final.json` |
| **LCOV** | Codecov upload | Vitest --coverage --reporter=lcov | `coverage/lcov.info` |
| **Screenshots** | Visual diff archive | Playwright | `test-results/visual-diffs/` |
| **Videos** | Debug e2e fail | Playwright | `test-results/videos/` |
| **Traces** | Debug e2e fail | Playwright | `test-results/traces/` |

### 4.2 Reporting par wave

Pour chaque wave, on génère :

```
.test-execution/
├── wave-1-foundation/
│   ├── junit.xml
│   ├── coverage.json
│   └── summary.md
├── wave-2-component/
│   ├── junit.xml
│   ├── coverage.json
│   └── summary.md
├── ...
└── final-report.md
```

Le `summary.md` par wave contient :

```markdown
# Wave 1 — Foundation

- **Date** : 2026-MM-DD HH:MM
- **Durée** : 1m 47s
- **Tests** : 80 total, 80 passed, 0 failed, 0 skipped
- **Coverage** :
  - `lib/i18n/config.ts` : 100%
  - `lib/i18n/resolveLocale.ts` : 100%
  - `lib/i18n/formatters.ts` : 96.42%
- **Exit criterion** : ✓ PASSED
- **Next wave** : Wave 2 — Component
```

### 4.3 Rapport final

Cf. `communication-templates.md` Template 3 — Synthèse finale post-deploy.

Sections obligatoires :
- Vue d'ensemble (totaux par wave)
- Coverage par module
- Bugs trouvés (P0/P1/P2)
- Bugs fixés vs ouverts
- Temps cumulé d'exécution
- Recommandations pour V2

### 4.4 Archivage

```bash
# Tag Git après batterie réussie
git tag i18n-batterie-passed-2026-MM-DD
git push origin --tags

# Archive les rapports
tar czf .test-execution-2026-MM-DD.tar.gz .test-execution/
# Upload vers stockage long terme (S3, Drive, etc.)
```

---

## Annexes

### Annexe A — Matrice durée par wave (référence rapide)

| Wave | Local M1 | CI 4 workers | Bloque suite ? |
|---|---|---|---|
| 1 — Foundation | 2 min | 1 min | Oui |
| 2 — Component | 5 min | 3 min | Oui |
| 3 — Integration | 6 min | 4 min | Oui |
| 4 — E2E | 25 min | 10 min | Oui (avant 5, 6, 7) |
| 5 — Visual | 8 min | 5 min | Non |
| 6 — A11y | 4 min | 3 min | Non |
| 7 — Performance | 5 min | 3 min | Non |
| 8 — Robustness | 10 min | 5 min | Oui (avant signoff) |
| **Total séquentiel** | **65 min** | **34 min** | |
| **Total parallèle CI** | N/A | **~22 min** | |

### Annexe B — Mapping wave → fichiers source

| Wave | Source files touchés | Test files associés |
|---|---|---|
| 1 | `src/lib/i18n/*` | `src/lib/i18n/__tests__/*.test.ts` |
| 1 | `src/lib/checkout/i18n/dictionary.ts` | `src/lib/checkout/i18n/dictionary.test.ts` |
| 1 | `messages/*.json` | `messages/*.test.ts` |
| 2 | `src/components/i18n/*` | `src/components/i18n/__tests__/*.test.tsx` |
| 2 | `src/components/header/*`, `footer/*` | `src/components/*/i18n.test.tsx` |
| 3 | `src/app/api/i18n/*` | `src/app/api/i18n/**/route.test.ts` |
| 3 | `src/app/api/admin/i18n/*` | `src/app/api/admin/i18n/**/route.test.ts` |
| 3 | `middleware.ts` | `middleware.test.ts` |
| 3 | `src/lib/i18n/repos/*` | `src/lib/i18n/repos/*.test.ts` |
| 4 | App pages + flows | `e2e/i18n/*.spec.ts` |
| 5 | App pages (visual) | `e2e/visual/*.visual.spec.ts` |
| 6 | App pages (a11y) | `e2e/a11y/i18n/*.a11y.spec.ts` |
| 7 | Bundle + perf | `e2e/perf/*` + `scripts/perf/*` |
| 8 | All (edge cases) | `src/lib/i18n/edge-cases/*` + `e2e/chaos/*` |

### Annexe C — Dépendances entre waves

```
Wave 1 ──┬─→ Wave 2 ──┐
         │            │
         ├─→ Wave 3 ──┤
         │            │
         └──────────────→ Wave 8
                      │
                      ▼
                 Wave 4 ──┬─→ Wave 5
                          │
                          ├─→ Wave 6
                          │
                          └─→ Wave 7
```

- Wave 1 fondation → tout le reste en dépend
- Wave 2 et 3 indépendantes entre elles, mais dépendent de Wave 1
- Wave 4 dépend de Wave 2 + Wave 3 (composants + API)
- Waves 5, 6, 7 dépendent de Wave 4 (visite des pages)
- Wave 8 indépendante des waves 4-7 (peut tourner en parallèle)

### Annexe D — Quick reference card

```
┌─────────────────────────────────────────────────────────────┐
│                BATTERIE TESTS I18N — QUICK REF              │
├─────────────────────────────────────────────────────────────┤
│  WAVE      │  COMMAND                  │  TIME  │  EXIT     │
├─────────────────────────────────────────────────────────────┤
│  1 Foundat.│  pnpm test:i18n:wave1     │  2min  │ cov≥90%   │
│  2 Compon. │  pnpm test:i18n:wave2     │  5min  │ axe=0     │
│  3 Integ.  │  pnpm test:i18n:wave3     │  6min  │ API≥90%   │
│  4 E2E     │  pnpm test:i18n:wave4     │ 25min  │ 3runs OK  │
│  5 Visual  │  pnpm test:i18n:wave5     │  8min  │ diffs OK  │
│  6 A11y    │  pnpm test:i18n:wave6     │  4min  │ crit=0    │
│  7 Perf    │  pnpm test:i18n:wave7     │  5min  │ LH≥90     │
│  8 Robust. │  pnpm test:i18n:wave8     │ 10min  │ crash=0   │
├─────────────────────────────────────────────────────────────┤
│  ALL       │  pnpm test:i18n:all       │ 65min  │           │
│  PARALLEL  │  pnpm test:i18n:parallel  │ 22min  │  (CI)     │
└─────────────────────────────────────────────────────────────┘
```

### Annexe E — Glossaire

| Terme | Définition |
|---|---|
| **Wave** | Vague de tests groupés par couche/objectif, exécutés séquentiellement |
| **Exit criterion** | Condition de sortie d'une wave pour passer à la suivante |
| **Fuzz testing** | Injection d'inputs aléatoires pour découvrir des crashes |
| **Mutation testing** | Modification du code pour vérifier que les tests détectent le changement |
| **Flaky test** | Test qui passe et échoue de manière non-déterministe |
| **Snapshot baseline** | Image/structure de référence pour comparaison régression |
| **Mask** | Zone d'un screenshot exclue de la comparaison (éléments dynamiques) |
| **P0/P1/P2** | Sévérité d'un bug : P0 = crash, P1 = UX cassée, P2 = mineur |
| **JUnit XML** | Format de rapport CI universel, ingéré par GitHub Actions, GitLab, etc. |
