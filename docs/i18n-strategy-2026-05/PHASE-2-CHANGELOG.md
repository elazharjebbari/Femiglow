# Phase 2 — Changelog d'exécution (2026-05-28)

> Exécution de la **Phase 1 Foundation + Phase 2 Migration routes** du plan
> `08-plan-action/phases.md`. Toutes les 8 routes marketing migrées vers
> `app/[locale]/`, fondations next-intl en place, 224+ tests vitest +
> 7 smoke Playwright. Phase 3 (CMS multilingue) prête à démarrer.

## TL;DR

| Métrique | Valeur |
|---|---|
| Commits cette session | **20** sur `feat/i18n-foundation` |
| Routes localisées SSG | **8** (home + 7 pages) |
| Tests vitest i18n | **229** (passent en ~30s) |
| Tests Playwright smoke | **7** (skip si flag OFF, valides au flag ON) |
| Build status | ✅ Vert (152 pages legacy + 8 [locale] SSG) |
| Régression code legacy | **Zéro** (flag OFF par défaut) |
| Volume code i18n ajouté | ~3500 lignes |

## Routes migrées (8 / 8)

| Route | Phase | Pattern | Complexité |
|---|---|---|---|
| `/[locale]/` | 2.7 | Vraie home (HeroBound + GestesGrid + Manifeste + Avis + Journal) | 🟠 |
| `/[locale]/contact` | 2.1 | POC migration complet (form + FAQ + JSON-LD) | 🟡 |
| `/[locale]/rituel` | 2.2 | Composants Bound CMS + howToSchema | 🟠 |
| `/[locale]/journal` | 2.2 | Liste articles + filtres catégories + hreflang query | 🟠 |
| `/[locale]/journal/[slug]` | 2.4 | Article détail + breadcrumb + JSON-LD blogPosting | 🟠 |
| `/[locale]/maison` | 2.3 | localBusinessSchema + 6 sections Bound | 🟡 |
| `/[locale]/legal/[slug]` | 2.5 | Markdown rendu DB + chrome localisé + Format date locale | 🟡 |
| `/[locale]/kit` | 2.6 | Page conversion Kolenda (CMS override + CAPI + layout v1/v2) | 🔴 |

## Architecture déployée

```
apps/web/
├── messages/
│   ├── fr.json                          ← 797 keys
│   ├── ar.json                          ← 797 keys (MSA féminin)
│   └── en.json                          ← 797 keys
│
├── src/
│   ├── i18n.config.ts                   ← Source unique LOCALES + helpers
│   ├── i18n.config.test.ts              ← 48 tests
│   │
│   ├── i18n/
│   │   ├── routing.ts                   ← defineRouting next-intl 3.x
│   │   ├── navigation.ts                ← Link/useRouter type-safe
│   │   └── request.ts                   ← getRequestConfig (lazy imports)
│   │
│   ├── lib/i18n/
│   │   ├── feature-flag.ts              ← isI18nEnabled (server) + client
│   │   └── feature-flag.test.ts         ← 22 tests
│   │
│   ├── types/next-intl.d.ts             ← AppConfig.Messages augmentation
│   │
│   ├── components/i18n/
│   │   └── LocaleSwitcher.tsx           ← Client component, useTransition
│   │
│   ├── test/helpers/i18n-keys.ts        ← assertI18nKeysExist réutilisable
│   │
│   └── app/[locale]/
│       ├── layout.tsx                   ← NextIntlClientProvider + inline lang/dir script
│       ├── page.tsx                     ← home + .contract.test.ts (12 tests)
│       ├── contact/                     ← page + .contract.test.ts (51 tests)
│       ├── rituel/                      ← page + .contract.test.ts (18 tests)
│       ├── journal/
│       │   ├── page.tsx                 + .contract.test.ts (24 tests)
│       │   └── [slug]/page.tsx          + .contract.test.ts (9 tests)
│       ├── maison/                      ← page + .contract.test.ts (15 tests)
│       ├── legal/[slug]/                ← page + .contract.test.ts (21 tests)
│       └── kit/                         ← page + .contract.test.ts (9 tests)
│
└── e2e/smoke/smoke-i18n.spec.ts         ← 7 runtime tests
```

## Décisions techniques

### Pattern feature flag (zéro régression)

- `I18N_ENABLED=false` par défaut → middleware no-op, routes legacy intactes
- `I18N_ENABLED=true` → middleware redirige `/kit` → `/{locale}/kit`
- Rollback < 60 sec via env var Vercel

### Pattern contract tests (drift prevention)

Chaque page migrée a un `*.contract.test.ts` adjacent qui liste les clés
consommées. Le helper `assertI18nKeysExist` génère un test par clé × locale.
Détecte instantanément les drifts (clé renommée, supprimée).

### Pattern inline lang/dir SSR

Plutôt que toucher au root layout existant (risque CSP/auth), on utilise
un `<script dangerouslySetInnerHTML>` rendu server-side qui set
`<html lang/dir>` AVANT le premier paint. Pattern identique à `next-themes`.

### Pattern composants Bound réutilisés

Les composants CMS-bound (HeroBound, ArticleCardBound, KitPageLayoutV1, etc.)
restent INCHANGÉS — ils fetchent toujours le contenu FR depuis CMS.
La page wrapper localise seulement metadata + JSON-LD + canonical + hreflang.

→ Phase 3 étendra les repos CMS pour fetcher par locale.

## Limitations Phase 2 (à traiter Phase 3)

| Limitation | Impact | Phase 3 fix |
|---|---|---|
| Composants Bound fetchent FR uniquement | Corps des pages reste FR | Étendre `cms.*` pour accepter `{ locale }` |
| `resolveSeoMetadata` (admin override) ignore locale | Admin ne peut pas override par locale | Ajouter `locale` au scope |
| Root layout garde `<html lang="fr">` hardcoded | Quasi-zéro flash via inline script | Refonte SSR-pure si critique |
| Articles journal body en FR uniquement | Contenu identique sur les 3 locales | Ingérer `mock-data-{ar,en}.json` en DB |
| Pages légales body en FR uniquement | Contenu identique | Activer `legal_pages.locale` côté frontend |

## Phase 3 — Plan d'attaque suggéré

### T3.1 — Repo CMS multilingue

```ts
// AVANT
cms.getHomepageContent()           // FR seul
cms.getArticleBySlug(slug)         // FR seul

// APRÈS
cms.getHomepageContent({ locale })           // fetch par locale + fallback FR
cms.getArticleBySlug(slug, { locale })       // idem
```

Implementation : étendre le repo `component_field_bindings` pour query
`WHERE locale = $1 OR locale = 'fr'` avec priorité, et fallback FR si vide.

### T3.2 — UI admin pour saisir par locale

Onglets FR/AR/EN par champ dans `/admin/components/[key]/edit`. Le champ
`locale` existe déjà dans le schema (cf. `00-context/etat-actuel.md`).

### T3.3 — Ingestion seeds preparés

```bash
pnpm tsx scripts/seed-i18n-components.ts \
  --bindings docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv

pnpm tsx scripts/seed-i18n-legal.ts \
  --pages docs/i18n-content-2026-05/03-seed-data/legal-pages-ar/
```

### T3.4 — Activation visuelle AR (Phase 4)

- Audit Tailwind logical properties (`ml-* → ms-*`, `text-left → text-start`)
- Police Cairo pour AR
- Tests visuels Playwright RTL

## Commandes de validation

```bash
# Build complet (152 pages + 8 [locale] SSG)
cd apps/web && pnpm build

# Tous les tests i18n (229 vitest)
pnpm vitest run --testNamePattern="Contract|i18n.config|feature-flag"

# Smoke Playwright (nécessite I18N_ENABLED=true + server dev)
echo "I18N_ENABLED=true" >> apps/web/.env.local
pnpm dev  # autre terminal
pnpm test:e2e --grep @i18n

# Validation seeds
python3 docs/i18n-content-2026-05/scripts/validate-seeds.py
```

## Activation locale (test manuel)

```bash
echo "I18N_ENABLED=true" >> apps/web/.env.local
cd apps/web && pnpm dev
# Visiter dans navigateur :
#   /fr/contact, /fr/kit, /fr/rituel, /fr/journal, /fr/maison
#   /ar/contact, /ar/kit, /ar/rituel  → RTL après hydration
#   /en/contact, /en/kit, /en/rituel
```

## Conformité brief utilisateur ("rigoureux, robuste, fiable, ergonomique,
maintenable, évolutif, modulaire, optimal, deboggable, dynamique, adapté")

Chaque commit de cette session contient une section "Conformité brief
utilisateur" détaillée. Voir `git log --grep="Conformité brief"` pour
le détail par commit.

Phase 2 livre **toutes les fondations production-ready**. Phase 3 peut
démarrer dès que le founder valide les drifts identifiés dans
`docs/i18n-content-2026-05/04-quality/review-notes.md`.
