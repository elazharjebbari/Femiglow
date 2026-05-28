# Phase 3 — Progression CMS multilingue (2026-05-28)

> Étape Phase 3 du plan `08-plan-action/phases.md` — extension du CMS
> pour fetcher par locale + premier contenu localisé. Continue le
> travail consigné dans `PHASE-2-CHANGELOG.md`.

## État courant

| Étape | Statut | Commit |
|---|---|---|
| **T3.1** Helper `CmsLocaleOptions` + `resolveCmsLocale` | ✅ Fait | `160dbcf` |
| **T3.2** Signatures CMSAdapter page-content + plumb-through | ✅ Fait | `9345f92` |
| **T3.3** `pickByLocale` + mock impl avec fallback chain | ✅ Fait | `46b53aa` |
| **T3.4** Signatures articles + plumb-through | ✅ Fait | `a06c952` |
| **T3.5** Mocks AR/EN homepage + dispatch CMS | ✅ Fait | `d9b2f64` |
| **T3.6** Mocks AR/EN maison + rituel + kit | ⏳ Reste | — |
| **T3.7** Articles AR/EN (mocks + queries by-slug locale-aware) | ⏳ Reste | — |
| **T3.8** UI admin saisie par locale (`component_field_bindings`) | ⏳ Reste | — |
| **T3.9** Impl Sanity prod (vraie source DB) | ⏳ Reste | — |

## Architecture livrée Phase 3

```
apps/web/src/lib/cms/
├── locale-options.ts                ← CmsLocaleOptions + resolveCmsLocale
├── locale-options.test.ts           ← 6 tests
├── pick-by-locale.ts                ← pickByLocale + LocaleContentMissingError
├── pick-by-locale.test.ts           ← 12 tests
├── types.ts                          ← CMSAdapter avec options locale partout
└── mock/
    ├── index.ts                      ← {homepage,maison,rituel,kitPage}ByLocale
    └── homepage-locale.test.ts       ← 7 tests dispatch

apps/web/src/data/mock/
├── homepage.ts                       ← FR canonical
├── homepage.ar.ts                    ← NEW : AR MSA féminin
├── homepage.en.ts                    ← NEW : EN international sobre
├── maison.ts                         ← FR canonical (AR/EN à venir T3.6)
├── rituel.ts                         ← FR canonical
└── kit.ts                            ← FR canonical
```

## Pattern de migration mock par locale

Pour ajouter une locale à un mock de page existant :

### 1. Cloner le mock FR vers locale-specific

```ts
// apps/web/src/data/mock/maison.ar.ts
import type { MaisonPageContent } from '@/lib/schemas';
import { mockMaison } from './maison';

export const mockMaisonAr: MaisonPageContent = {
  ...mockMaison,
  hero: {
    // ATTENTION : à cause de TS strict + champs optionnels dans le schema,
    // ne PAS faire `...mockMaison.hero` quand on override des sous-objets
    // avec types stricts (image, cta, etc.). Redéfinir explicitement.
    kicker: 'دار الرباط',
    title: '…',
    subtitle: '…',
    cta: { label: '…', href: '/kit', variant: 'primary' },
    image: {
      src: mockMaison.hero.image.src,
      alt: '…',
      width: 1600,
      height: 2000,
    },
  },
  // … autres sections
};
```

### 2. Ajouter au dictionnaire dans `cms/mock/index.ts`

```ts
import { mockMaisonAr } from '@/data/mock/maison.ar';
import { mockMaisonEn } from '@/data/mock/maison.en';

const maisonByLocale = {
  fr: mockMaison,
  ar: mockMaisonAr,
  en: mockMaisonEn,
};
```

### 3. Tester via `mockAdapter.getMaisonPageContent({ locale: 'ar' })`

Ajouter un `*.test.ts` adjacent qui vérifie :
- Strings AR contiennent des caractères arabes (`/[؀-ۿ]/`)
- Verbes féminins en AR (impératif `اكتشفي`, etc.)
- Pas d'emoji / pas de `!` marketing dans aucune locale
- Shape preserved (mêmes top-level keys)

## Gotchas TypeScript

### Spread + optional fields → strict type mismatch

```ts
// ❌ Type error
ctaSecondary: {
  ...mockHomepage.hero.ctaSecondary,  // type avec optional fields
  label: 'استلمي',
},
// Target expects { label: string; href: string; variant: ... } (required)

// ✅ Define explicitly
ctaSecondary: {
  label: 'استلمي',
  href: '/kit',
  variant: 'link',
},
```

Pattern : pour les sous-objets dont le shape attend des champs requis,
**redéfinir explicitement** plutôt que spread.

## Routes accessibles avec contenu localisé

Avec `I18N_ENABLED=true` :

| Route | FR | AR | EN |
|---|---|---|---|
| `/` (home) | ✅ FR | ✅ AR localisé | ✅ EN localisé |
| `/maison` | ✅ FR | ⚠️ fallback FR (T3.6) | ⚠️ fallback FR (T3.6) |
| `/rituel` | ✅ FR | ⚠️ fallback FR (T3.6) | ⚠️ fallback FR (T3.6) |
| `/kit` | ✅ FR | ⚠️ fallback FR (T3.6) | ⚠️ fallback FR (T3.6) |
| `/journal` | ✅ FR | ⚠️ fallback FR (T3.7) | ⚠️ fallback FR (T3.7) |
| `/journal/[slug]` | ✅ FR | ⚠️ fallback FR (T3.7) | ⚠️ fallback FR (T3.7) |
| `/contact` | ✅ FR (metadata localisée) | ✅ AR (metadata localisée) | ✅ EN (metadata localisée) |
| `/legal/[slug]` | ✅ FR (chrome localisé) | ✅ AR (chrome localisé) | ✅ EN (chrome localisé) |

→ **La home `/` est désormais réellement traduite sur les 3 locales.**

## Cumul tests

| Type | Phase 1+2 | Phase 3 | Total |
|---|---|---|---|
| vitest config/flag | 70 | — | 70 |
| vitest contract pages | 147 | — | 147 |
| vitest helpers Phase 3 | — | 18 | 18 |
| vitest dispatch CMS | — | 7 | 7 |
| Playwright smoke i18n | 7 | — | 7 |
| **Total** | **224** | **25** | **249** |

## Commands utiles

```bash
# Activer l'i18n + dev server
echo "I18N_ENABLED=true" >> apps/web/.env.local
pnpm dev

# Visiter dans navigateur :
# /fr/  ← Le pack FemiGlow. Deux gestes, un éclat révélé.
# /ar/  ← كيت فيمي قلو. حركتان، إشراق مكشوف. (RTL)
# /en/  ← The FemiGlow kit. Two gestures, a revealed glow.

# Run tests Phase 3
pnpm vitest run \
  src/lib/cms/locale-options.test.ts \
  src/lib/cms/pick-by-locale.test.ts \
  src/lib/cms/mock/homepage-locale.test.ts
```

## Prochaines étapes (priorité décroissante)

1. **T3.6** Mocks AR/EN pour maison + rituel + kit (réplique pattern homepage)
2. **T3.7** Articles AR/EN : la page `/journal/[slug]` peut ingérer les
   bodies des `mock-data-{ar,en}.json` produits Phase 0
3. **T3.8** UI admin pour saisir traductions par locale dans
   `component_field_bindings.locale` (champ DB existe déjà)
4. **T3.9** Impl Sanity prod : remplacer le mock par une vraie source

Et après Phase 3 : Phase 4 (RTL Tailwind + activation visuelle AR).
