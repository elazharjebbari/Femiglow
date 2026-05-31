# Phase 7 — Audit exhaustif i18n FemiGlow (2026-05-28)

> Audit chiffré, sourcé, sans complaisance. Objectif : amener le sprint i18n à **100 % de couverture éditoriale FR / AR / EN** sur les pages publiques (`/[locale]/*` ET routes legacy partagées par les composants).

Branche : `feat/i18n-foundation` — 38 commits accumulés. Toutes les fondations sont OK (routing, middleware, messages JSON, Cairo, RTL Tailwind, mocks AR/EN, switcher component, seed script). Le bug est en bout de chaîne : la résolution des champs et le rendu visuel.

---

## A1 — Inventaire des composants `*Bound.tsx`

Présence dans `apps/web/src/components/sections/` : **23 composants Bound** (deux d'entre eux n'effectuent aucune résolution CMS, comptés zéro). Verdict : **0 / 23 acceptent une prop `locale`** aujourd'hui.

| Composant Bound | componentKey CMS | Accepte `locale` ? | Page consommatrice | Impact i18n |
|---|---|---|---|---|
| `ArticleCardBound` | `journal-article-*` | non | `[locale]/journal` | élevé |
| `ArticleHeroBound` | `journal-article-*` | non | `[locale]/journal/[slug]` | élevé |
| `AtelierGalleryBound` | `maison-atelier-gallery` | non | `[locale]/maison` | moyen (légende) |
| `AvisStripBound` | `home-avis-strip` | non | `[locale]/` | élevé |
| `ComparatifSectionBound` | `kit-comparatif` | non | `[locale]/kit` | moyen |
| `CompositionRevealBound` | `kit-composition-reveal` | non | `[locale]/kit` | moyen |
| `FeaturedArticleBound` | `journal-featured` + `journal-article-*` | non | `[locale]/journal` | élevé |
| `HandsTestimonialsBound` | `kit-hands-testimonials` | non | `[locale]/kit` | élevé |
| `HeroBound` | `home-hero` | non | `[locale]/` | **critique** |
| `HeroLifestyleBound` | `rituel-hero-lifestyle` | non | `[locale]/rituel` | élevé |
| `HeroMaisonBound` | `maison-hero` | non | `[locale]/maison` | **critique** |
| `HeroProduitBound` | `kit-hero-produit` | non | `[locale]/kit` | **critique** |
| `IngredientsDetailsBound` | `kit-detail-mains` | non | `[locale]/kit` | moyen |
| `InterviewQRBound` | `kit-interview-qr` | non | `[locale]/kit` | moyen |
| `JournalExtraitsBound` | `home-journal` (cover slot) | non | `[locale]/` | moyen |
| `JournalGridBound` | divers | non | `[locale]/journal` | moyen |
| `KitCommanderSectionBound` | n/a (presentational) | n/a | `[locale]/kit` | nul |
| `PackVisualBound` | n/a (presentational, juste slot) | n/a | `[locale]/kit` | nul |
| `ProductFeedSectionBound` | n/a | n/a | `[locale]/kit` | nul |
| `RelatedArticlesBound` | n/a (data driven) | n/a | `[locale]/journal/[slug]` | nul |
| `SectionNarrativeBound` | divers | non | `[locale]/maison` | moyen |
| `VideoPlayer4GestesBound` | `rituel-video-4-gestes` | non | `[locale]/rituel` | nul (visuel) |
| `VideoPlayer4GestesKitBound` | n/a | n/a | `[locale]/kit` | nul |

Sources : `apps/web/src/components/sections/*Bound.tsx`, lignes d'import `resolveComponentFields`/`resolveComponentSlot`.

**Constat clé** : seuls `HeroBound`, `HeroProduitBound` appellent `resolveComponentFields()` aujourd'hui. Les autres Bound utilisent `resolveComponentSlot()` (qui n'est pas locale-aware côté DB pour les médias — c'est OK : médias = mêmes assets toutes locales). Le bug principal vient donc de `HeroBound` + `HeroProduitBound` qui passent un `componentKey` mais pas la locale → `resolveComponentFields(key)` défaut FR (cf. `apps/web/src/lib/components/field-resolver.ts:122-180`).

---

## A2 — Inventaire des strings hardcodées FR dans les composants partagés

Périmètre : `apps/web/src/components/sections/*.tsx` (hors `.test.tsx`, hors `*Bound.tsx`).

| Composant | Strings hardcodées FR détectées | Clé i18n cible (suggérée) |
|---|---|---|
| `ContactHero.tsx:15-22` | « Écrire à la maison », « Contact. », « Une question sur le rituel… » | `marketing.contact.hero.{kicker,title,subtitle}` **(existe déjà)** |
| `JournalHero.tsx:12-18` | « Le carnet de la maison. », « Une lettre par mois… » | `marketing.journal.hero.{title,description}` **(existe déjà)** |
| `Manifeste.tsx` | data-driven via `data.{kicker,title,paragraphs}` | **OK, alimenté par mock AR/EN** |
| `NewsletterBlock.tsx:29-31` | defaults FR pour `kicker/title/description` | `marketing.newsletter.block.*` **(à créer)** |
| `DirectContactBlock.tsx:17,30,26,38` | « Écrire », « Atelier », « Réponse sous 24h… », « Sur rendez-vous. » | `marketing.contact.direct.*` **(existe déjà)** |
| `FAQAccordion.tsx:20-23` | « Foire aux questions », « Réponses rapides. » | `marketing.contact.faq.{kicker,title}` **(existe déjà)** |
| `EngagementsGrid.tsx:17` | « Les six engagements » | `marketing.maison.engagements.kicker` (à vérifier) |
| `EditorialLetter.tsx:22` | « Un mot de notre fondatrice » | `marketing.rituel.letter.kicker` (à vérifier) |
| `OrderHero.tsx:28` | « La maison vous remercie » | `marketing.commerce.merci.order_hero.kicker` **(existe déjà)** |
| `PreparationGesture.tsx:22` | « Préparation au geste » | `marketing.rituel.preparation.kicker` (à vérifier) |
| `TimelineSteps.tsx:31` | « Suivi de votre pack » | `marketing.commerce.merci.timeline.kicker` **(existe déjà)** |

Total composants partagés avec strings FR éditoriales : **11**. Toutes les clés `marketing.contact.*`, `marketing.journal.hero.*`, `marketing.commerce.*` sont déjà présentes dans `fr.json` ET `ar.json` ET `en.json` — il suffit de les consommer.

**Cas particulier `Header.tsx`** : strings hardcodées FR (« Sommaire » ligne 113, « Voir le pack ci-dessous » ligne 122, aria-label « FemiGlow — Accueil » ligne 86). Le Header n'est rendu QUE sur `(marketing)/*` → ne touche pas `/[locale]/*`. Voir A4 pour la décision.

---

## A3 — Coverage registry vs CSV seed

| Source | Slugs distincts |
|---|---|
| `apps/web/src/lib/components/registry.ts` (entrées CMS) | 22 statiques + 15 articles journal = **37** |
| `docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv` (slugs uniques colonne 1) | **60** |
| `…/component-bindings-en.csv` | **60** (id) |
| `…/component-bindings-fr.csv` | **60** (id) |
| Lignes totales par CSV | **511** lignes (avec header) → **510 rows** |

Source : `awk -F',' 'NR>1 {print $1}' ...ar.csv | sort -u | wc -l` (60). Comparaison avec `grep -E "^    key: '[a-z-]+'" registry.ts`.

**Orphans CSV → registry** : ~38 slugs CSV n'ont pas de composant CMS correspondant (ex : `home-metadata`, `contact-hero`, `contact-form`, `commerce-cart`, …). Ces lignes seront classées `orphans` par `runI18nBindingsSeed` (cf. `seed-bindings.ts:296` → `buildSlugMap`).

**Orphans registry → CSV** : composants registry sans entrée seed → tomberont automatiquement sur `defaultValue` du registry (donc FR). Cas pratique : `journal-article-*` 15 slugs sont dans le registry ; CSV en référence `journal-article` (1 slug générique) mais ne précise pas chaque article.

**Implication pour Phase 7B/D** : le seed va loguer ~30+ orphans non bloquants, ce n'est pas une erreur — c'est documenté dans `PHASE-6-SEED-RUNBOOK.md`. Les Bound consomment les composants registry → on est aligné côté code.

---

## A4 — État du `LocaleSwitcher` (rendu observable)

### Chaîne de rendu actuelle

```
apps/web/src/app/layout.tsx              # root, <html lang="fr" dir="ltr"> hardcoded
└── apps/web/src/app/[locale]/layout.tsx # sub-layout : NextIntlClientProvider + inline lang/dir script
    └── (children → page.tsx)             # PAS de <Header /> ici
```

```
apps/web/src/app/(marketing)/layout.tsx  # legacy : <Header /> + <Footer />
└── (marketing)/{kit,maison,journal,contact,rituel,page.tsx}
```

### Conséquence observable

- **Route `/contact` (legacy)** : Header rendu → `LocaleSwitcher` monté → MAIS `useActiveLocaleSafe()` retourne `null` car `usePathname()[0] = "contact"` n'est pas une locale → composant retourne `null` (cf. `LocaleSwitcher.tsx:73-83`). **Switcher invisible.**
- **Route `/fr/contact` (locale-aware)** : pas de Header rendu dans `[locale]/layout.tsx`. **Switcher invisible.**
- **Route `/`** : redirection middleware vers `/fr/`. Idem → pas de Header. **Switcher invisible.**

Le switcher est donc **structurellement absent** sur les routes localisées : il manque un parent qui le monte.

### Plan A — Réutiliser le `Header` legacy dans `[locale]/layout.tsx`

Risque : `Header.tsx` contient « Sommaire » et autres strings hardcodées FR + il a `useChatStore` (state global) + le composant `SommaireOverlay`. C'est lourd mais sain : on partage le même chrome.

### Plan B (retenu pour Phase 7A)

Ajouter un wrapper `LocaleAwareHeader` rendu dans `[locale]/layout.tsx` qui réutilise `Header`. Pas de duplication : le switcher est déjà DANS le Header (`Header.tsx:99-102`). Une fois le Header monté sur `/{locale}/*`, le switcher sera visible.

**Audit complémentaire** : le Footer est-il rendu sur `/{locale}/*` ? Non plus (même `(marketing)/layout.tsx`). Donc on monte AUSSI `Footer` dans `[locale]/layout.tsx`.

---

## A5 — Diagnostic `pnpm seed:i18n-bindings:dry` (exit code 2)

### Reproduction

```
$ cd apps/web && pnpm seed:i18n-bindings:dry
> tsx scripts/seed-i18n-bindings.ts -- --dry
{"event":"seed.i18n-bindings.argv","message":"Unknown flag: --"}
```

### Cause racine

Le script `package.json:33` lit :

```json
"seed:i18n-bindings:dry": "tsx scripts/seed-i18n-bindings.ts -- --dry"
```

Le double `--` est **un séparateur pnpm/npm** destiné à passer les arguments derrière au programme. Or `tsx` les transmet tels quels à `process.argv`, et `parseArgs()` ne reconnaît pas `--` comme une option valide → throw `Unknown flag: --` → exit 2.

### Fix proposé (Phase 7D)

Filtrer `--` dans `parseArgs()` côté script :

```ts
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--') continue; // séparateur pnpm/npm
  switch (a) { … }
}
```

Idempotent, deux lignes, zéro risque de régression sur les autres flags.

### Pré-flight conditions (vérifiées)

- `DEFAULT_CSV_DIR` résout `docs/i18n-content-2026-05/03-seed-data/` — confirmé présent (3 CSV × 511 lignes).
- DB : `db` Drizzle / `memoryStore` (fallback in-memory) — selon `NODE_ENV` et `DATABASE_URL`. En dev local sans Postgres, le seed écrit dans la memoryStore (idéal pour valider la chaîne sans dépendance).
- Headers CSV : confirmés conformes (`component_slug,field_key,locale,value,status,notes`).

Une fois le `--` filtré, le dry-run produira un rapport JSON dans `.seed-reports/seed-i18n-bindings-<ts>.json` avec compteurs par locale.

---

## A6 — Audit de la cascade `mergeHeroFields` (bug critique #1)

Source : `apps/web/src/components/sections/hero-fields.ts`.

```ts
// HeroBound.tsx:29
const [resolved, fields] = await Promise.all([
  resolveComponentSlot(componentKey, 'primary'),
  resolveComponentFields(componentKey),         // ← signature actuelle: (key) → locale 'fr' par défaut
]);
const merged = mergeHeroFields(data, fields);   // data = mock localisé (AR/EN), fields = bindings/defaults FR
```

`mergeHeroFields` privilégie **toujours** les fields résolus si la cascade renvoie autre chose que `'none'`. Or :
- En AR : `data.hero.title = 'كيت فيمي قلو...'` (mock AR OK)
- `fields.title = { value: 'Le rituel ongles, en cinq minutes.', meta: { source: 'default' } }` (registry FR)
- `pickString(fields, 'title')` → retourne le string FR (source `default` ≠ `none`)
- → `merged.title = 'Le rituel ongles, en cinq minutes.'` **override FR sur AR.**

### Symptôme visible en preview

L'utilisateur reporte « FR mélangé avec AR » sur la home et la maison : c'est EXACTEMENT ce mécanisme. Le hero (FR forcé) cohabite avec les sections Manifeste/Avis (qui sont data-driven sans cascade, donc OK en AR).

### Fix Phase 7B

1. Propager `locale` jusqu'à `resolveComponentFields(key, locale)` — déjà supporté (cf. `field-resolver.ts:165`).
2. Ajouter un comportement « préserver `data` si source = `default` ET locale ≠ DEFAULT_LOCALE ». Sinon, en AR sans binding seed, on retombe sur le FR du registry.

Pseudo-code :

```ts
export function mergeHeroFields(
  data: HeroData,
  fields: ResolvedFields,
  options?: { locale?: Locale; defaultLocale?: Locale },
): HeroData {
  const localeIsDefault =
    !options?.locale || options.locale === (options.defaultLocale ?? 'fr');
  const acceptDefault = localeIsDefault; // ne PAS écraser data si locale ≠ default

  const pickIfBinding = (key: string) => {
    const f = fields[key];
    if (!f || f.meta.source === 'none') return undefined;
    // En non-default locale, on n'accepte QUE binding (= seed AR/EN livré)
    if (!acceptDefault && f.meta.source === 'default') return undefined;
    if (typeof f.value !== 'string') return undefined;
    const trimmed = f.value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    ...data,
    kicker: pickIfBinding('kicker') ?? data.kicker,
    // …
  };
}
```

---

## A7 — Synthèse risques

| Risque | Sévérité | Conséquence si non corrigé |
|---|---|---|
| `*Bound.tsx` ne propage pas locale | **bloquant** | FR override AR/EN sur hero (home, maison, kit) — fragile en SEO multilingue, casse Google Search Console. |
| `mergeHeroFields` accepte `source: 'default'` toujours | **bloquant** | Même symptôme — couple inséparable du précédent. |
| LocaleSwitcher absent sur `/{locale}/*` | **élevé** | UX : impossible de changer de langue depuis la nav publique. |
| `seed:i18n-bindings:dry` exit 2 | **élevé** | Bloque le runbook QA + impossible de valider qu'on aurait inséré X rows AR/EN. |
| 11 composants sections hardcodés FR | **moyen** | `/ar/contact`, `/ar/journal` afficheront `<Kicker>` FR sur sections de chrome. |
| Header rendu uniquement sur legacy | **moyen** | Switcher + sommaire + chat trigger absent sur `/{locale}/*` (couplé à A4). |
| Strings FR dans Header lui-même | **faible** | À régler en Phase 7C+ : `Header` doit utiliser `useTranslations('navigation')`. |
| Orphans CSV vs registry | **info** | Non bloquant — c'est documenté dans le runbook Phase 6. |

---

## A8 — Critères de succès Phase 7

Une fois la Phase 7 livrée intégralement, les checks suivants doivent passer en preview live :

1. `curl -sL http://localhost:3000/ar/ | grep -c "Le rituel\|cinq minutes"` → 0
2. `curl -sL http://localhost:3000/ar/contact | grep -c "Écrire à la maison\|Foire aux questions"` → 0
3. `curl -sL http://localhost:3000/fr/ | grep -c "كيت فيمي قلو\|الطقوس"` → 0
4. Switcher cliquable et visible sur `/fr/`, `/ar/`, `/en/` (DOM `[data-testid="locale-switcher-trigger"]`).
5. `pnpm seed:i18n-bindings:dry` exit 0 + rapport JSON > 0 inserts simulés.
6. `pnpm build` exit 0 sans erreur TS.
7. `pnpm test` sans régression vs HEAD.

---

## A9 — Décisions architecture

- **Pas de duplication de `Header`** : on monte le même composant sur les deux sub-layouts. Le composant doit fonctionner dans les deux contextes (legacy sans provider next-intl, locale avec provider). Le wrapper `LocaleSwitcher` gère déjà ce cas (`useActiveLocaleSafe` retourne `null` hors provider).
- **Préserver le legacy** : on ne touche pas au middleware, au root layout, ni au `(marketing)/layout.tsx`.
- **`HeroBound` reste server-only**. La locale est dérivée du path serveur dans la page parente puis passée en prop.
- **Compatibilité descendante de `mergeHeroFields`** : nouvelle signature optionnelle (`options?`) → aucun call site cassé.

