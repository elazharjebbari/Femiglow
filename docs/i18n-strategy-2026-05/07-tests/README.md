# 07 — Tests i18n FemiGlow

> Stratégie de tests dense pour l'internationalisation FemiGlow (next-intl + FR/AR/EN + RTL).
> Stack : **Vitest 2.1.2** (unit + integration) + **Playwright 1.48** (e2e + visual) + **MSW 2.14** (mocking) + **@axe-core/playwright 4.11** (a11y) + **@testing-library/react** (composants).
> Audience : devs, QA, lead technique. À lire avant d'écrire le moindre test i18n.

## TL;DR — stratégie en 6 phrases

1. **Pyramide stricte** : 60% unit > 20% component > 15% integration > 5% e2e + visual + a11y.
2. **Helpers i18n** = couverture **90% min** (déterministe, sans mock externe).
3. **Composants i18n** = couverture **80% min** (snapshots par locale + a11y axe).
4. **E2E** = scenarios bilingues uniquement sur **chemins critiques** (kit, wizard, switcher, 404).
5. **Visual regression** = baseline par locale FR/AR/EN sur 5 pages, mask les éléments dynamiques.
6. **Coverage clés** = gates CI : FR=100% **bloquant**, AR≥90% **warn**, EN≥90% **warn**.

## Sommaire

| # | Fichier | Aspect | Lecture |
|---|---|---|---|
| 1 | [`strategy.md`](./strategy.md) | Stratégie globale + pyramide + gates CI + non-objectifs | 8 min |
| 2 | [`unit-vitest.md`](./unit-vitest.md) | Tests unitaires : helpers, formatters, composants pure, hooks | 12 min |
| 3 | [`integration-msw.md`](./integration-msw.md) | Tests intégration MSW : API admin, flow upsert, fallback | 10 min |
| 4 | [`e2e-playwright.md`](./e2e-playwright.md) | Tests E2E : switcher, wizard multi-locale, hreflang, cookie | 12 min |
| 5 | [`visual-regression.md`](./visual-regression.md) | Visual : screenshots par locale, RTL audit, mask dynamic | 8 min |
| 6 | [`a11y-rtl.md`](./a11y-rtl.md) | Accessibility + RTL : axe, keyboard, lang attr, focus order | 10 min |
| 7 | [`snapshot-tests.md`](./snapshot-tests.md) | Snapshots : messages.json structure, composants FR vs AR | 6 min |
| 8 | [`lint-rules.md`](./lint-rules.md) | ESLint custom rules : no-hardcoded-strings, key-format, orphans | 10 min |
| 9 | [`coverage-translations.md`](./coverage-translations.md) | Coverage clés : endpoint, dashboard, gates CI, alerts | 8 min |
| 10 | [`test-matrix.csv`](./test-matrix.csv) | Matrice complète des tests : 70+ scénarios | référence |

**Total lecture** : ~85 min pour absorber l'ensemble.

## Pyramide de tests i18n FemiGlow

```
                  ┌──────────────────────────────────────┐
                  │     A11y + Visual (5%)                │   ~60 specs
                  │     axe-core + Playwright visual     │   par locale
                  │     Cible : < 8 min CI total          │
                  ├──────────────────────────────────────┤
                  │     E2E i18n (5%)                     │   ~50 specs
                  │     Playwright multi-locale          │   FR/AR/EN
                  │     Cible : < 10 min CI total         │
                  ├──────────────────────────────────────┤
                  │     Integration MSW (15%)             │   ~120 tests
                  │     API admin + middleware locale    │
                  │     Cible : < 4 min CI total          │
                  ├──────────────────────────────────────┤
                  │     Component RTL/L18n (20%)          │   ~200 tests
                  │     RTL render + axe + snap par loc  │
                  │     Cible : < 3 min CI total          │
                  ├──────────────────────────────────────┤
                  │     Unit (55%)                        │   ~550 tests
                  │     helpers + formatters + hooks     │
                  │     Cible : < 1.5 min CI total        │
                  └──────────────────────────────────────┘
```

## Ce qu'on teste, et ce qu'on ne teste pas

### On teste (gate-critical)

- **`resolveLocale(path|cookie|header)`** : tous les cas de fallback
- **`<LocaleSwitcher />`** : interactions complètes (Tab, Enter, Esc, Arrow)
- **Middleware Next** : path → cookie → Accept-Language → default `fr`
- **API `/api/i18n/coverage`** : auth, rate-limit, payload shape
- **API `/api/admin/i18n/upsert-message`** : validation Zod, audit log, cache invalidation
- **Fallback FR → AR manquant** : on doit voir la valeur FR, jamais la clé `[marketing.hero.title]`
- **Wizard `WizardDictionary`** : intégrité FR + AR (CHA-231 préservé)
- **hreflang tags** : présents et corrects sur toutes les pages localisées
- **`<html lang="ar" dir="rtl">`** : attributs corrects par locale
- **404 page localisée** : selon URL `/ar/foo` → message en arabe
- **Cookie `NEXT_LOCALE`** : pose + lecture + 1 an d'expiration
- **Visual RTL** : layout Tailwind logical properties ne casse pas en AR

### On NE teste PAS (par décision)

- ❌ Le comportement interne de `next-intl` (lib externe, déjà testée)
- ❌ Le rendering exact des polices arabes (variation OS-dépendante)
- ❌ La traduction sémantique des messages (revue humaine, pas test machine)
- ❌ Les caractères Unicode exotiques en dehors du périmètre FR/AR/EN
- ❌ Performance des formatters `Intl.*` natifs (lib navigateur, déjà optimisée)
- ❌ Le `<select>` natif HTML (on a un dropdown custom)

## Coverage targets par module

| Module | Target | Type | Bloquant CI |
|---|---|---|---|
| `lib/i18n/config.ts` | 100% | unit | Oui |
| `lib/i18n/resolveLocale.ts` | 100% | unit | Oui |
| `lib/i18n/formatters.ts` | 95% | unit | Oui |
| `lib/i18n/matchLocale.ts` | 95% | unit | Oui |
| `components/LocaleSwitcher.tsx` | 85% | component | Oui |
| `components/Header.tsx` (i18n parts) | 80% | component | Non (warn) |
| `app/api/i18n/coverage/route.ts` | 90% | integration | Oui |
| `app/api/admin/i18n/**` | 90% | integration | Oui |
| `middleware.ts` (locale logic) | 100% | integration | Oui |
| `lib/checkout/i18n/dictionary.ts` | 100% | unit (régression CHA-231) | Oui |
| `messages/{fr,ar,en}.json` | structure 100% | snapshot | Oui |

**Calcul de coverage** : `vitest --coverage` produit du JSON. Un script `scripts/check-i18n-coverage.mjs` lit le JSON, compare aux thresholds et fail CI si écart.

## Anti-patterns transverses

### Au niveau test

- ❌ **Hardcoder `'fr'` partout dans les tests** : utiliser `LOCALES_TEST_MATRIX.forEach(...)` avec FR, AR, EN.
- ❌ **Vérifier seulement FR** : si on n'a pas testé `dir="rtl"` sur AR, on n'a rien testé.
- ❌ **Faire un E2E par `t('hero.title')`** : tester la traduction = job du translateur, pas du test.
- ❌ **Charger messages.json directement dans Playwright** : passer par l'app rendu, c'est ce qui simule l'utilisateur.
- ❌ **`screen.getByText('Découvrir')` partout** : utiliser des `data-testid` ou `getByRole`, sinon FR-dépendant.

### Au niveau messages

- ❌ Snapshot du fichier `messages/fr.json` brut → trop verbeux. Snapshot la **shape** (Zod parse).
- ❌ Tester chaque clé une par une → faire des assertions sur le total via `Object.keys(messages).length`.

## Standards visés

- **WCAG 2.1 AA** : 0 violation `critical` ou `serious` (axe)
- **CLS / LCP** stable entre locales (delta < 0.05 / 100ms)
- **Bundle size** : `messages/<locale>.json` < 15kb gzipped
- **Test runtime CI total** : < 25 min (unit + integration + e2e + visual + a11y)

## Référence croisée

- Architecture cible : [`../02-design-conception/architecture-cible.puml`](../02-design-conception/architecture-cible.puml)
- API routes : [`../03-backend/api-routes.md`](../03-backend/api-routes.md)
- Naming conventions : [`../02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md)
- Locale switcher UI : [`../04-frontend/locale-switcher.md`](../04-frontend/locale-switcher.md)
- Pyramide globale projet : [`../../test-strategy-2026-05/02-vision-strategy.md`](../../test-strategy-2026-05/02-vision-strategy.md)
- Plan d'exécution (Phase 6) : [`../08-plan-action/phases.md`](../08-plan-action/phases.md)

## Checklist d'exécution Phase 6 (semaine 8 du plan)

- [ ] Lire les 9 fichiers `.md` de ce sous-dossier (~85 min)
- [ ] Vérifier que les versions stack matchent : vitest 2.1.2, playwright 1.48, msw 2.14, axe 4.11
- [ ] Créer `src/test/msw/handlers/i18n.ts` avec les handlers documentés
- [ ] Créer `src/test/helpers/render-with-i18n.tsx` (wrapper RTL)
- [ ] Créer `e2e/i18n/` (dossier dédié e2e i18n)
- [ ] Activer ESLint rules custom (`lint-rules.md`)
- [ ] Configurer `scripts/check-i18n-coverage.mjs`
- [ ] Mettre en place les gates CI (workflow `.github/workflows/i18n-tests.yml`)
- [ ] Run baseline visuel Playwright par locale (`pnpm test:visual --update-snapshots`)
- [ ] Vérifier coverage `pnpm test:coverage` aligne sur les targets
- [ ] Démo en équipe (15 min) avant ship
