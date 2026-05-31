# Phase 4 — Stratégie RTL & activation visuelle AR

> Étape Phase 4 du plan `08-plan-action/phases.md` — migration des
> composants Tailwind vers les **logical properties** pour un rendu
> RTL natif correct sur la locale AR.
>
> **Statut** : ⏳ À démarrer — audit fait, plan posé, exécution à
> programmer (~3-5 jours d'effort).

## Audit initial (2026-05-28)

Scan des composants `apps/web/src/components/` :

| Classe physique | Occurrences | Logical equivalent | Action |
|---|---:|---|---|
| `ml-*` | 105 | `ms-*` | À migrer |
| `mr-*` | 13 | `me-*` | À migrer |
| `pl-*` | 22 | `ps-*` | À migrer |
| `pr-*` | 6 | `pe-*` | À migrer |
| `text-left` | 128 | `text-start` | À migrer |
| `text-right` | 94 | `text-end` | À migrer |
| `left-*` / `right-*` | TBD | `start-*` / `end-*` | À auditer |
| `rounded-l-*` / `rounded-r-*` | TBD | `rounded-s-*` / `rounded-e-*` | À auditer |
| `border-l-*` / `border-r-*` | TBD | `border-s-*` / `border-e-*` | À auditer |
| `float-left` / `float-right` | TBD | `float-start` / `float-end` | À auditer |

**Total minimum confirmé** : **368 occurrences** sur 6 patterns standards.

## Mapping Tailwind logical properties (référence)

| Physical | Logical | Effet en LTR | Effet en RTL |
|---|---|---|---|
| `ml-4` | `ms-4` | margin-left | margin-right |
| `mr-4` | `me-4` | margin-right | margin-left |
| `pl-4` | `ps-4` | padding-left | padding-right |
| `pr-4` | `pe-4` | padding-right | padding-left |
| `text-left` | `text-start` | text-align: left | text-align: right |
| `text-right` | `text-end` | text-align: right | text-align: left |
| `left-0` | `start-0` | left: 0 | right: 0 |
| `right-0` | `end-0` | right: 0 | left: 0 |
| `rounded-l-md` | `rounded-s-md` | left corners | right corners |
| `rounded-r-md` | `rounded-e-md` | right corners | left corners |
| `border-l` | `border-s` | left border | right border |
| `border-r` | `border-e` | right border | left border |

**NB** : Tailwind 3.x supporte nativement ces classes depuis v3.3+. Aucun
plugin requis. Cf. https://tailwindcss.com/docs/border-radius#using-logical-properties

## Stratégie de migration

### Phase 4.1 — Audit exhaustif (~0.5j)

1. Lancer `scripts/audit-rtl-classes.py` (à créer — pattern grep + report CSV)
2. Output : `docs/phase-4-rtl-audit.csv` avec colonnes :
   - `file`, `line`, `class_physical`, `class_logical`, `priority`
3. Priorisation : P0 = composants utilisés sur `/[locale]/`, P1 = autres marketing, P2 = admin (skip — admin reste FR)

### Phase 4.2 — Migration P0 (~2j)

Composants à migrer en priorité (consommés par les 8 routes `[locale]/`) :

- `components/sections/HeroBound.tsx`, `HeroMaisonBound.tsx`,
  `HeroLifestyleBound.tsx`, `JournalHero.tsx`
- `components/sections/GestesGrid.tsx`, `MatieresGrid.tsx`,
  `EngagementsGrid.tsx`
- `components/sections/ArticleCardBound.tsx`, `ArticleGrid.tsx`,
  `FeaturedArticleBound.tsx`, `ArticleProse.tsx`
- `components/sections/SectionNarrativeBound.tsx`, `SectionNarrative.tsx`
- `components/sections/FAQAccordion.tsx`, `CrossLinkBanner.tsx`,
  `CrossLinkTriptyque.tsx`, `ContactCrossLinks.tsx`
- `components/sections/NewsletterBlock.tsx`, `AvisStripBound.tsx`
- `components/marketing/kit-layout/KitPageLayoutV1.tsx` + `V2.tsx`
- `components/legal/LegalContactBlock.tsx`, `LegalRelatedLinks.tsx`
- `components/header/*`, `components/footer/*`
- `components/forms/ContactForm.tsx`

**Migration script** :

```bash
# Remplacement bulk (à vérifier individuellement après)
find apps/web/src/components -name "*.tsx" -exec sed -i '' \
  -e 's/\bml-\([0-9]\)/ms-\1/g' \
  -e 's/\bmr-\([0-9]\)/me-\1/g' \
  -e 's/\bpl-\([0-9]\)/ps-\1/g' \
  -e 's/\bpr-\([0-9]\)/pe-\1/g' \
  -e 's/\btext-left\b/text-start/g' \
  -e 's/\btext-right\b/text-end/g' \
  {} +
```

⚠️ **Sed bulk = risque haut** : certains usages sont volontairement
asymétriques (ex: icône à droite d'un bouton FR doit RESTER à droite
en AR si c'est un signal directionnel non-textuel). Audit manuel
après bulk obligatoire.

### Phase 4.3 — Police Cairo pour AR (~0.5j)

```tsx
// app/[locale]/layout.tsx
import { Cairo } from 'next/font/google';
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  variable: '--font-cairo',
});

// Application conditionnelle :
<body className={params.locale === 'ar' ? cairo.variable : ''}>
```

```css
/* globals.css */
[dir='rtl'] {
  font-family: var(--font-cairo), system-ui, sans-serif;
}
```

### Phase 4.4 — Audit visuel Playwright (~1j)

Étendre `e2e/smoke/smoke-i18n.spec.ts` avec :

```ts
test('AR — alignment is right-to-left', async ({ page }) => {
  await page.goto('/ar/');
  // Hero title should be right-aligned
  const heroTitle = page.locator('h1').first();
  const textAlign = await heroTitle.evaluate(
    (el) => getComputedStyle(el).textAlign
  );
  expect(textAlign).toMatch(/right|end/);
});

test('AR — RTL screenshot baseline', async ({ page }) => {
  await page.goto('/ar/');
  await expect(page).toHaveScreenshot('ar-home.png');
});
```

### Phase 4.5 — Icônes directionnelles (~0.5j)

Auditer les SVG / icônes avec sens directionnel (flèches, chevrons) :

```tsx
// Avant
<svg className="..."><path d="M5 12h14"/></svg>

// Après — flip horizontal en RTL
<svg className="rtl:scale-x-[-1] ..."><path d="M5 12h14"/></svg>
```

Cf. `docs/i18n-strategy-2026-05/05-ui-ux-design/rtl-support.md` §"Icônes
mirroring".

## Effort total estimé

| Sous-phase | Effort | Risque |
|---|---|---|
| 4.1 Audit | 0.5j | 🟢 Bas |
| 4.2 Migration P0 (~30 composants) | 2j | 🟡 Moyen (sed bulk + audit manuel) |
| 4.3 Police Cairo | 0.5j | 🟢 Bas |
| 4.4 Tests Playwright RTL | 1j | 🟢 Bas |
| 4.5 Icônes directionnelles | 0.5j | 🟡 Moyen (auditer 1 par 1) |
| **Total** | **4.5j** | |

## Critères de succès

- [ ] 100% des classes physiques `ml-*`, `mr-*`, `pl-*`, `pr-*`,
      `text-left`, `text-right` migrées vers logical equivalents dans
      `components/` (hors `admin/`)
- [ ] Police Cairo chargée conditionnellement sur `lang="ar"`
- [ ] `/ar/` rend visuellement RTL correct (sans flash, hero à droite,
      navigation à droite, etc.)
- [ ] Tests Playwright @rtl passent (alignment + RTL screenshots)
- [ ] Aucune régression visuelle sur `/fr/` et `/en/` (LTR doit rester
      identique)
- [ ] Build vert + tests vitest passent

## Out of scope Phase 4

- ❌ Admin (`admin/*`) — reste 100% FR + LTR (ADR-008)
- ❌ Wizard checkout (`WizardDictionary` CHA-231) — déjà géré séparément
- ❌ Refonte des images photographiques pour AR — Phase 5 (workflow
  translateur)

## Liens

- Audit Tailwind logical properties : https://tailwindcss.com/docs/border-radius#using-logical-properties
- Design doc RTL : `docs/i18n-strategy-2026-05/05-ui-ux-design/rtl-support.md`
- Tests RTL Playwright : `docs/i18n-strategy-2026-05/07-tests/a11y-rtl.md`
