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
| **T3.8** UI admin saisie par locale (`component_field_bindings`) | ✅ Fait | (HEAD) |
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
| vitest admin i18n T3.8 | — | 15 | 15 |
| Playwright smoke i18n | 7 | — | 7 |
| **Total** | **224** | **40** | **264** |

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
3. **T3.9** Impl Sanity prod : remplacer le mock par une vraie source

Et après Phase 3 : Phase 4 (RTL Tailwind + activation visuelle AR).

## T3.8 — UI admin saisie par locale (livré)

**Mission** : permettre au founder de saisir des traductions FR/AR/EN
directement dans l'admin sur les `component_field_bindings`, sans toucher
les mocks TS.

**Page admin concernée** : `/admin/components/[key]` (ex `home-hero`,
`maison-hero`, etc.) — un sélecteur d'onglets en tête de la section
« Contenu éditorial » bascule entre FR / AR / EN.

### Architecture

```
apps/web/src/components/admin/i18n/
├── LocaleTabs.tsx            ← role=tablist 3 onglets (FR/AR/EN)
├── LocaleTabs.test.tsx        ← 7 tests (aria, tabindex, callback, completion)
├── LocaleEditorShell.tsx      ← orchestrateur : tient activeLocale, remount editor
└── LocaleEditorShell.test.tsx ← 5 tests (switch, dir=rtl, completion, missing locale)

apps/web/src/app/admin/components/[key]/page.tsx
  ↳ load les initialFields pour les 3 locales en Promise.all
  ↳ passe au LocaleEditorShell qui re-monte EditorWithPreview par locale

apps/web/src/components/admin/components/fields/useFieldForm.ts
  ↳ bugfix : publish POST passe désormais `?locale=${locale}` à la route
  ↳ sans ça, les drafts AR/EN ne pouvaient pas être publiés (server fallback 'fr')

apps/web/src/lib/db/queries/component-fields.test.ts
  ↳ +3 tests isolation par locale (getDraftBinding, upsertDraftBinding, publishBinding)
```

### Comportement utilisateur

1. L'admin arrive sur `/admin/components/home-hero`.
2. Au-dessus du formulaire, une barre « Langue d'édition » avec 3 onglets :
   - **FR** (actif par défaut, point vert si traduit)
   - **AR** (point vert si traduit, sinon gris)
   - **EN** (idem)
3. Clic sur AR → le formulaire entier remonte avec les valeurs AR du draft
   (ou published si pas de draft, ou `defaultValue` du registre).
   Le tabpanel reçoit `dir="rtl"` (déjà géré par les CSS logiques Phase 4).
4. Édition → autosave debounce 800 ms (PATCH avec `locale` dans le body).
5. Clic « Publier les modifications » → POST publish pour chaque champ dirty
   avec `?locale=ar`. Les FR et EN ne sont PAS affectés.

### Stratégie remount vs partage de state

Choix : `<EditorWithPreview key={activeLocale} />`. Au switch d'onglet, on
remonte complètement le formulaire (et son `useFieldForm`). Ça simplifie
énormément l'isolation : chaque locale a son propre dirty tracking, son
propre debounce, ses propres erreurs de validation. Le coût est négligeable
(< 30 champs sur le composant le plus chargé) et la rouille mentale du code
augmente moins qu'avec un useFieldForm multi-locale.

### Contraintes respectées

- **Aucune régression FR-only** : le default reste 'fr' → le formulaire au
  premier load est exactement identique à l'ancien comportement.
- **Voix admin 100 % FR** : le chrome (« Langue d'édition », « Édite le
  contenu pour Arabe »…) reste en français. Seuls les *contenus édités*
  sont multilingues (ADR-008).
- **TypeScript strict** : `Locale` type partout, pas de `as string`.
- **State React local** : pas de cookie. L'admin ne doit jamais voir son
  switcher éditorial confondu avec le `NEXT_LOCALE` du visiteur public.
- **Validation Zod** : la route PATCH applique `validateFieldValue` après
  encodage, indépendamment de la locale (shape identique, contenu libre).

### Activation manuelle

1. `pnpm dev`
2. Se connecter à `/admin/login`
3. Visiter `/admin/components/home-hero` (ou n'importe quel composant
   ayant des `component.fields` dans le registre).
4. Cliquer sur l'onglet AR, saisir des traductions, vérifier que le badge
   passe à « ✓ traduit ».
5. Publier → vérifier que `/ar/` rend bien les valeurs saisies (avec
   `I18N_ENABLED=true` + adapter CMS branché sur les bindings DB — actuellement
   le mock est encore prioritaire ; le branchement DB est l'objet de T3.9).

### Bugfix collatéral

`useFieldForm.publish()` POSTait `/api/.../publish` sans query string.
La route `POST /publish` lit `?locale=…` (et tombait sur `'fr'` par défaut).
Conséquence : un draft AR « publié » ne se serait pas promu → pas de
visibilité en prod. Fixé : `?locale=${encodeURIComponent(locale)}` joint
à l'URL du POST.

### Tests (récap)

| Suite | Tests | Notes |
|---|---|---|
| `LocaleTabs.test.tsx` | 7 | aria-selected, tabindex, onClick, completion, panelId |
| `LocaleEditorShell.test.tsx` | 5 | switch locale, dir=rtl, complétion, missing locale, remount |
| `component-fields.test.ts` (ajout T3.8) | 3 | isolation AR/FR/EN, upsert indep, publish indep |
| **Total T3.8** | **15** | tous verts |

### Limites connues / suite

- **Preview iframe** : reste sur FR (le `PreviewFrame` ne propage pas encore
  la locale dans son URL `?locale=ar`). À traiter en Phase 5 quand la
  preview prendra un `?locale=` (chemin `[locale]/preview/...`).
- **History view** : `/[key]/fields/[fieldKey]/history` lit `locale` mais
  l'UI actuelle ne propose pas de filtre — l'historique mélange FR/AR/EN
  pour le même champ. T3.8 ne le traite pas (out of scope).
- **Sanity prod (T3.9)** : tout est en place côté Postgres. L'impl Sanity
  remplacera le repo Drizzle par un client Sanity qui exposera la même
  API (`getPublishedBinding`, `upsertDraftBinding`, etc.). Le LocaleEditorShell
  ne sait pas qui sert la DB — il s'en fiche.

### Pour T3.9 (recommandation)

L'analyse de T3.8 a confirmé que **le repo `component-fields.ts` est l'unique
porte d'entrée** des bindings. Sanity prod devra exposer un module
compatible avec l'interface implicite :

```ts
getPublishedBinding(componentId, fieldKey, locale): Promise<Binding | null>
getDraftBinding(componentId, fieldKey, locale): Promise<Binding | null>
upsertDraftBinding(input: UpsertDraftInput): Promise<Binding>
publishBinding(input: PublishInput): Promise<Binding>
listHistory(componentId, fieldKey, locale, limit): Promise<HistoryEntry[]>
restoreFromHistory(input: RestoreInput): Promise<Binding>
// + listAllScheduled, listScheduledDue, archiveOrphanBindings…
```

Stratégie suggérée : un fichier `component-fields.sanity.ts` qui implémente
ces signatures contre l'API Sanity, et un toggle de dispatch dans
`@/lib/db/client` (`DATABASE_URL` ou `SANITY_PROJECT_ID`). Le ConflictError
devra mapper vers le mécanisme de mutation Sanity (`ifRevisionId`).
