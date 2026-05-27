# RTL — Support arabe pour FemiGlow

> Tout ce qu'il faut savoir pour basculer FemiGlow en arabe sans casser le design éditorial : `dir="rtl"`, Tailwind logical properties, miroir des icônes, audit composants critiques, tests Playwright RTL.

## 1. Principes

### 1.1 Pourquoi le RTL est non-négociable

- L'arabe est la langue principale du marché marocain de FemiGlow
- La fondatrice valide cible AR à parité visuelle stricte avec FR
- Une mauvaise impl RTL = retour utilisateurs négatifs immédiat
- Le wizard checkout doit fonctionner en AR (CHA-231 déjà partiel)

### 1.2 Approche choisie : "logical-first"

Plutôt que de patcher CSS au cas par cas, **on bannit dès l'écriture du code** les propriétés directionnelles physiques (`margin-left`, `padding-right`, `text-align: left`, etc.) au profit de leur version logique (`margin-inline-start`, etc.).

Avantage : un seul composant rend correctement en LTR et RTL sans branchement conditionnel.

### 1.3 Direction globale

```tsx
// src/app/[locale]/layout.tsx
export default async function LocaleLayout({ children, params: { locale } }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

`dir="rtl"` sur `<html>` (pas sur `<body>` ni un wrapper) propage à tout le document et active les logical properties Tailwind.

## 2. Tailwind logical properties — Table complète

### 2.1 Marges

| Physique (à BANNIR) | Logique (à utiliser) | Effet en LTR | Effet en RTL |
|---|---|---|---|
| `ml-4` | `ms-4` | margin-left | margin-right |
| `mr-4` | `me-4` | margin-right | margin-left |
| `ml-auto` | `ms-auto` | left auto | right auto |
| `mr-auto` | `me-auto` | right auto | left auto |
| `mx-4` | `mx-4` | inchangé (axe horizontal symétrique) | idem |
| `my-4` | `my-4` | inchangé | idem |

→ `mt-*` et `mb-*` ne changent pas (axe vertical non concerné par RTL).

### 2.2 Padding

| Physique | Logique | LTR | RTL |
|---|---|---|---|
| `pl-4` | `ps-4` | padding-left | padding-right |
| `pr-4` | `pe-4` | padding-right | padding-left |
| `px-4` | `px-4` | OK symétrique | OK |

### 2.3 Position (inset)

| Physique | Logique | LTR | RTL |
|---|---|---|---|
| `left-0` | `start-0` | left: 0 | right: 0 |
| `right-0` | `end-0` | right: 0 | left: 0 |
| `left-1/2` | `start-1/2` | left: 50% | right: 50% |
| `-left-4` | `-start-4` | left: -1rem | right: -1rem |
| `top-0` | `top-0` | OK | OK |
| `bottom-0` | `bottom-0` | OK | OK |

### 2.4 Text alignment

| Physique | Logique | LTR | RTL |
|---|---|---|---|
| `text-left` | `text-start` | text-align: left | text-align: right |
| `text-right` | `text-end` | text-align: right | text-align: left |
| `text-center` | `text-center` | OK | OK |
| `text-justify` | `text-justify` | OK | OK |

### 2.5 Borders

| Physique | Logique | LTR | RTL |
|---|---|---|---|
| `border-l` | `border-s` | border-left | border-right |
| `border-r` | `border-e` | border-right | border-left |
| `border-l-2` | `border-s-2` | left 2px | right 2px |
| `border-l-stone-200` | `border-s-stone-200` | OK | OK |

### 2.6 Border radius

| Physique | Logique | LTR | RTL |
|---|---|---|---|
| `rounded-l-md` | `rounded-s-md` | left corners | right corners |
| `rounded-r-md` | `rounded-e-md` | right corners | left corners |
| `rounded-tl-md` | `rounded-ss-md` | top-left | top-right |
| `rounded-tr-md` | `rounded-se-md` | top-right | top-left |
| `rounded-bl-md` | `rounded-es-md` | bottom-left | bottom-right |
| `rounded-br-md` | `rounded-ee-md` | bottom-right | bottom-left |

### 2.7 Float et clear (legacy, rare)

| Physique | Logique |
|---|---|
| `float-left` | `float-start` |
| `float-right` | `float-end` |
| `clear-left` | `clear-start` |
| `clear-right` | `clear-end` |

### 2.8 Flex direction

| Tailwind | Comportement |
|---|---|
| `flex-row` | Suit `dir` : LTR = gauche→droite, RTL = droite→gauche |
| `flex-row-reverse` | Inverse `dir` : LTR = droite→gauche, RTL = gauche→droite |
| `flex-col` | Inchangé par RTL |

→ Pour un layout "logo à gauche, menu à droite" qui doit naturellement s'inverser en RTL : utiliser `flex-row` (pas `flex-row-reverse`).

### 2.9 Grid

| Tailwind | Comportement |
|---|---|
| `grid-cols-3` | Inchangé. Mais l'ordre des items suit `dir` (1er item = côté de départ logique) |
| `grid-flow-col` | Suit `dir` |

### 2.10 Transform translate (cas piégeur)

| Physique | Logique disponible | Recommandation |
|---|---|---|
| `translate-x-4` | Pas de version logique Tailwind v3 | Utiliser CSS `transform: translateX(var(--tw-translate-x))` avec helper RTL-aware |

Pour les translates horizontaux dépendants de la direction (ex: slide-in d'un drawer), utiliser `rtl:` variant :

```html
<div class="-translate-x-full rtl:translate-x-full">drawer</div>
```

## 3. Le préfixe `rtl:` Tailwind (cas exceptionnels)

Pour les cas où aucune logical property n'existe :

```tsx
<div className="rotate-0 rtl:rotate-180">
  <ChevronRightIcon />
</div>
```

Lit : "rotation 0 en LTR, rotation 180° en RTL".

Autre exemple, miroir d'une image asymétrique :

```tsx
<img src="/arrow-deco.svg" className="ltr:scale-x-100 rtl:-scale-x-100" alt="" />
```

**Règle d'usage** : `rtl:` uniquement pour les cas que les logical properties ne couvrent pas (rotations, scales, translations spéciales). Sinon, préférer les logical properties.

## 4. `dir="rtl"` — Comportement et activation

### 4.1 Activation au niveau HTML

```tsx
// app/[locale]/layout.tsx
import { getLocaleConfig } from '@/lib/i18n/config';

export default async function LocaleLayout({ children, params: { locale } }) {
  const { direction } = getLocaleConfig(locale);
  return (
    <html lang={locale} dir={direction}>
      ...
    </html>
  );
}
```

```ts
// lib/i18n/config.ts
export function getLocaleConfig(locale: string) {
  return {
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    // ...
  } as const;
}
```

### 4.2 Vérification de propagation

`dir="rtl"` doit cascader. Vérifier en console :

```js
document.documentElement.dir; // "rtl"
getComputedStyle(document.body).direction; // "rtl"
```

Si un wrapper override (`<div dir="ltr">`), tout ce qui est dedans repart en LTR. À éviter sauf pour exception (code blocks, urls, nombres anglais embarqués).

### 4.3 Direction mixte (BiDi)

Si une page AR contient du texte FR/EN inline (nom de marque, URL, code), le navigateur le gère via l'algorithme Unicode BiDi (UAX#9). Pour forcer un fragment LTR dans un contexte RTL :

```html
<p dir="rtl">
  زورونا على
  <bdi dir="ltr">femiglow.ma/contact</bdi>
  للمزيد
</p>
```

`<bdi>` (Bidi Isolate) isole un fragment de la logique BiDi parente.

### 4.4 Variable CSS pour requêtes JS

Si du code JS doit savoir la direction :

```ts
const dir = document.documentElement.dir || 'ltr';
// ou via Next.js
const locale = useLocale();
const dir = locale === 'ar' ? 'rtl' : 'ltr';
```

Hook React :

```ts
export function useDirection(): 'ltr' | 'rtl' {
  const locale = useLocale();
  return locale === 'ar' ? 'rtl' : 'ltr';
}
```

## 5. Icons mirroring

### 5.1 Icônes à MIROIRER en RTL

Toute icône directionnelle dont la sémantique implique un sens de lecture / progression :

| Icône | LTR | RTL | Méthode |
|---|---|---|---|
| Arrow → (next) | → | ← | `rtl:-scale-x-100` ou icône inversée |
| Arrow ← (back) | ← | → | `rtl:-scale-x-100` |
| Chevron > (forward) | > | < | `rtl:-scale-x-100` |
| Chevron < (back) | < | > | `rtl:-scale-x-100` |
| Triangle ► (play, expand) | ► | ◄ | `rtl:-scale-x-100` |
| Breadcrumb separators | `/` | `\` ou `/` | OK si neutre |
| External link arrow ↗ | ↗ | ↖ | `rtl:-scale-x-100` |
| Reply arrow ↩ | ↩ | ↪ | `rtl:-scale-x-100` |

### 5.2 Icônes à NE PAS MIROIRER

Toute icône dont le sens est universel ou serait illisible en miroir :

| Icône | Pourquoi pas |
|---|---|
| Logo FemiGlow | C'est une marque, immuable |
| Checkmark ✓ | Symbole universel, miroir = confusion |
| Croix ✕ | Symétrique de fait |
| Cœur ♥ | Symétrique |
| Étoile ★ | Symétrique |
| Loupe / Search | Reconnaissable, mais peut être miroirée pour cohérence avec sens lecture (rare) |
| Settings (engrenage) | Symétrique |
| User / profile | Symétrique (face plate) |
| Cart / panier | Discutable — préférer ne pas miroirer si le visuel est asymétrique |
| Hamburger ≡ | Symétrique |
| Numbers `1`, `2`, `3` | Les chiffres arabes occidentaux ne se miroirent JAMAIS |
| Pictogrammes paiement (CMI, Visa) | Logos commerciaux, immuables |

### 5.3 Implémentation recommandée

Composant générique :

```tsx
interface IconProps {
  mirror?: boolean;
  className?: string;
}

export function ArrowRightIcon({ mirror = true, className }: IconProps) {
  return (
    <svg
      className={cn(
        'h-4 w-4',
        mirror && 'rtl:-scale-x-100',
        className
      )}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M..." />
    </svg>
  );
}
```

Usage :

```tsx
<ArrowRightIcon mirror /> {/* miroir en RTL */}
<CheckIcon /> {/* jamais miroir */}
```

### 5.4 Performance

`scale-x` ne provoque pas de repaint majeur (transform GPU-accelerated). Préférer à des sets d'icônes dédiées par direction (poids bundle).

## 6. Images : à miroirer ou pas ?

### 6.1 Décision matrice

| Type d'image | Miroir en RTL ? | Pourquoi |
|---|---|---|
| Hero éditorial (mains, ongles, packshot) | NON | Le visuel est artistique, le miroir crée une dissonance |
| Photo packshot kit | NON | Le produit reste lui-même |
| Diagramme avec flèches | OUI | Les flèches doivent suivre le sens lecture |
| Screenshot UI illustratif | OUI si UI elle-même est RTL | Coherence |
| Illustration décorative neutre (motif, texture) | NON | Pas de sens directionnel |
| Carte / map | NON | Géographie absolue |
| Avatar humain regardant à droite | DISCUTABLE | Cas par cas avec direction artistique |

### 6.2 Implémentation par variantes

Cf. `images-localization.md`. Résumé : si une image *doit* être miroirée, exposer deux fichiers et basculer par locale :

```tsx
<Image
  src={locale === 'ar' ? '/diagram-ar.svg' : '/diagram-ltr.svg'}
  alt={t('marketing.diagram_alt')}
/>
```

Plutôt qu'un `transform: scaleX(-1)` qui inverse aussi le texte interne si l'image en contient.

## 7. Typography ajustement pour RTL

### 7.1 Line-height

L'arabe a des hampes et jambages plus prononcés que le latin. Augmenter :

```css
/* LTR base */
.font-sans { line-height: 1.5; }

/* RTL override */
:lang(ar) .font-sans,
[dir="rtl"] .font-sans { line-height: 1.7; }
```

Ou directement via Tailwind avec variant `rtl:` :

```html
<p class="leading-relaxed rtl:leading-loose">...</p>
```

### 7.2 Font size

Caractères arabes plus denses, taille parfois augmentée de 1-2 px pour confort :

```html
<p class="text-base rtl:text-[17px]">...</p>
```

### 7.3 Lettre-spacing (tracking)

L'arabe étant un script connecté, **JAMAIS** appliquer `letter-spacing` (= `tracking-*`) sur du texte arabe — ça casse les ligatures.

```html
<!-- ❌ mauvais -->
<p class="tracking-wide">نص عربي</p>

<!-- ✅ bon : variant rtl:tracking-normal pour reset -->
<h1 class="tracking-tight rtl:tracking-normal">...</h1>
```

Cf. `typography.md` pour le détail des polices.

## 8. Audit composants critiques

Liste des composants FemiGlow existants à auditer **systématiquement** pour leur compatibilité RTL.

### 8.1 Header

| Élément | Action |
|---|---|
| Logo wrap | Vérifier `flex-row` (pas `flex-row-reverse`) |
| Menu items spacing | `ms-6` au lieu de `ml-6` |
| LocaleSwitcher position | `end-0` quand panel ouvert |
| Cart button | `ms-auto` ou layout flex naturel |
| Drawer mobile | Sliding `rtl:translate-x-full -translate-x-full` à inverser |
| Hamburger position | OK, symétrique |
| Sticky offset top | OK |

### 8.2 Hero (page d'accueil)

| Élément | Action |
|---|---|
| Headline alignment | `text-start` au lieu de `text-left` |
| CTA position | `ms-0` ou flex container |
| Image placement (split layout) | `flex-row` natural reflow |
| Decorative lines / dividers | Vérifier `border-s` ou symétrie |
| Scroll indicator | Verticale, OK |

### 8.3 Pages produit (Kit / Rituel)

| Élément | Action |
|---|---|
| Galerie photos thumbnails | Order naturel via `flex-row` |
| Liste bullets | `ms-6` pour indent, marker à droite en RTL automatiquement |
| Tabs (description / specs) | Tab indicator suit `start` |
| Add to cart button | Pleine largeur (pas de positionnement) |
| Prix barré + prix promo | Layout flex naturel |
| Reviews stars | NE PAS miroirer (étoiles symétriques) |

### 8.4 Wizard checkout (CHA-231)

Cf. `wizard-i18n.md` pour le détail. RTL-spécifique :

| Élément | Action |
|---|---|
| Stepper | Numéros restent en chiffres arabes occidentaux (`1, 2, 3`), connecteur entre steps `border-s` |
| Form fields | `text-start` pour labels |
| Champ téléphone avec préfixe `+212` | `dir="ltr"` localement (numéros = LTR même en RTL) |
| Récap panier sticky | Sticky `end-0` au lieu de `right-0` |
| Bouton "Continuer" | `ms-auto` pour pousser au end |
| Bouton "Retour" | `me-auto` pour pousser au start |
| Modes paiement icônes | Pas de miroir (logos CMI, Visa) |

### 8.5 Forms (contact, newsletter)

| Élément | Action |
|---|---|
| Label position | `text-start` |
| Input `<input>` direction | `dir="auto"` (laisse Unicode décider selon contenu) |
| Placeholder | Texte traduit, alignment auto |
| Validation error icon | À gauche du message → `ms-0` puis flex naturel |
| Submit button alignment | `ms-auto` ou full-width |
| Required asterisk `*` | Place naturelle après label |

### 8.6 Footer

| Élément | Action |
|---|---|
| Colonnes layout | `grid-cols-4` OK, ordre flux suit dir |
| Liens listings | `flex-col`, OK |
| Newsletter input + button | Inline-flex, button après input naturellement |
| Social icons | Order via `flex-row` |
| Copyright bottom | `text-center` OK |
| Locale switcher pills | `gap-2`, OK |

### 8.7 CTA (Call to action)

| Élément | Action |
|---|---|
| Bouton primaire | Padding symétrique, OK |
| Bouton avec icône `→` | Icône à miroirer (cf. section 5) |
| Bouton "lire la suite" | Texte + flèche, flèche miroirée |
| Bouton outline | OK |

### 8.8 Cards (kit, blog post)

| Élément | Action |
|---|---|
| Image cover (top) | OK |
| Titre alignment | `text-start` |
| Description alignment | `text-start` |
| CTA link inside card | `me-auto` ou inline-flex |
| Badge "Nouveau" position | `top-2 start-2` au lieu de `top-2 left-2` |

### 8.9 Modal / Dialog

| Élément | Action |
|---|---|
| Close button position | `top-2 end-2` |
| Title alignment | `text-start` |
| Body content | `text-start` |
| Footer actions order | Confirmer = end, Annuler = start (suivre convention OS si possible) |

### 8.10 Toast / Notifications

| Élément | Action |
|---|---|
| Position container | `start-4 bottom-4` (en bas à gauche en LTR, en bas à droite en RTL) |
| Slide-in animation | `rtl:translate-x-full -translate-x-full` |
| Icon position | `ms-0` puis flex |
| Close button | `me-0` puis flex |

## 9. Tests visuels Playwright RTL

### 9.1 Setup

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium-ltr',
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    {
      name: 'chromium-rtl',
      use: { ...devices['Desktop Chrome'], locale: 'ar-MA' },
    },
  ],
});
```

### 9.2 Test smoke RTL home

```ts
// e2e/i18n/rtl-home.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RTL — Home', () => {
  test('html dir=rtl is set in arabic', async ({ page }) => {
    await page.goto('/ar/');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('lang attribute is ar', async ({ page }) => {
    await page.goto('/ar/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('ar');
  });

  test('header logo and menu are visually flipped', async ({ page }) => {
    await page.goto('/ar/');
    const logo = page.locator('[data-testid="header-logo"]');
    const menu = page.locator('[data-testid="header-menu"]');
    const logoBox = await logo.boundingBox();
    const menuBox = await menu.boundingBox();
    // In RTL, logo should be on the right
    expect(logoBox!.x).toBeGreaterThan(menuBox!.x);
  });

  test('hero CTA is on the right side', async ({ page }) => {
    await page.goto('/ar/');
    const cta = page.locator('[data-testid="hero-cta-primary"]');
    const viewport = page.viewportSize();
    const box = await cta.boundingBox();
    expect(box!.x).toBeGreaterThan(viewport!.width / 2);
  });
});
```

### 9.3 Test screenshots regression

```ts
test('home RTL screenshot matches baseline', async ({ page }) => {
  await page.goto('/ar/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('home-rtl.png', { fullPage: true });
});

test('home LTR screenshot matches baseline', async ({ page }) => {
  await page.goto('/fr/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('home-ltr.png', { fullPage: true });
});
```

### 9.4 Test wizard RTL

```ts
test('wizard step 1 in arabic — labels alignement', async ({ page }) => {
  await page.goto('/ar/checkout');
  const label = page.locator('label[for="shipping-firstName"]');
  const textAlign = await label.evaluate((el) => getComputedStyle(el).textAlign);
  // Resolved text-align in RTL = 'right'
  expect(textAlign).toBe('right');
});
```

### 9.5 Test icons mirroring

```ts
test('next chevron is mirrored in RTL', async ({ page }) => {
  await page.goto('/ar/');
  const chevron = page.locator('[data-testid="chevron-next"]').first();
  const transform = await chevron.evaluate((el) => getComputedStyle(el).transform);
  // matrix(-1, 0, 0, 1, 0, 0) = scaleX(-1)
  expect(transform).toContain('matrix(-1');
});
```

### 9.6 Test BiDi mixed content

```ts
test('phone number stays LTR in arabic page', async ({ page }) => {
  await page.goto('/ar/contact');
  const phone = page.locator('[data-testid="phone-number"]');
  const dir = await phone.getAttribute('dir');
  expect(dir).toBe('ltr');
});
```

## 10. Outils de debug RTL

### 10.1 Bookmarklet rapide

Pour basculer instantanément n'importe quelle page en RTL :

```js
javascript:document.documentElement.dir = document.documentElement.dir === 'rtl' ? 'ltr' : 'rtl';
```

À utiliser en dev pour repérer les bugs sans changer la locale.

### 10.2 Chrome DevTools

`Elements > html > attributes` — changer manuellement `dir="ltr"` → `dir="rtl"`.

### 10.3 Build-time check ESLint (custom rule à terme)

Liste des classes Tailwind interdites en V1 :

```js
// .eslintrc — règle custom 'no-physical-tailwind'
{
  forbidden: ['ml-', 'mr-', 'pl-', 'pr-', 'left-', 'right-', 'text-left', 'text-right', 'border-l', 'border-r', 'rounded-l-', 'rounded-r-', 'float-left', 'float-right'],
  exceptions: ['rtl:', 'ltr:'], // les variants sont OK
}
```

Optionnel V1, **obligatoire V2** quand RTL est en prod.

## 11. Pitfalls courants

### 11.1 `flex-row-reverse` au lieu de logical

❌ `<div className="flex flex-row-reverse">` → fonctionne en LTR mais devient correctement aligné en RTL (double inversion).

✅ `<div className="flex flex-row">` + utiliser `ms-auto` sur l'élément à pousser au end.

### 11.2 Marges via positionnement absolu

❌ `<div className="absolute left-4">` → reste à gauche en RTL.

✅ `<div className="absolute start-4">` → s'adapte.

### 11.3 SVG avec arrows fixes

❌ SVG avec `<path>` orienté `→` codé en dur, utilisé pour "next" → reste `→` en RTL.

✅ Ajouter `class="rtl:-scale-x-100"` sur le wrapper.

### 11.4 Sliding panels mal animés

❌ `transform: translateX(-100%)` pour slide-in depuis la gauche → en RTL devrait slider depuis la droite.

✅ Utiliser variant `rtl:translate-x-full -translate-x-full` puis `translate-x-0` à l'ouverture.

### 11.5 Lottie / animations

Lottie ne supporte pas le RTL natif. Pour des animations directionnelles, exporter 2 versions ou utiliser `transform: scaleX(-1)` sur le conteneur (et accepter que les textes internes soient inversés si présents — préférer animations sans texte).

### 11.6 Hardcoded `right:` ou `left:` dans CSS-in-JS

❌ `style={{ right: 0 }}`

✅ `style={{ insetInlineEnd: 0 }}`

### 11.7 Calculs JS dépendants de `getBoundingClientRect`

`element.getBoundingClientRect().left` ne change pas de sens en RTL. Pour de la logique "départ" vs "fin", utiliser :

```ts
const dir = document.documentElement.dir;
const startEdge = dir === 'rtl' ? rect.right : rect.left;
const endEdge = dir === 'rtl' ? rect.left : rect.right;
```

## 12. Performance et taille bundle

Les logical properties sont compilées par Tailwind en CSS standard `inline-start` / `inline-end`. Pas de surcoût bundle.

Le variant `rtl:` ajoute un sélecteur `[dir="rtl"] .rtl\:foo`. Coût marginal.

Aucune lib JS ajoutée pour le RTL.

## 13. Anti-patterns à bannir

- ❌ Utiliser `ml-*` / `pr-*` etc. dans un composant susceptible d'apparaitre en RTL
- ❌ Utiliser `text-left` / `text-right` au lieu de `text-start` / `text-end`
- ❌ Forcer `dir="rtl"` sur un `<div>` enfant — uniquement sur `<html>`
- ❌ Miroirer le logo FemiGlow
- ❌ Miroirer une icône symétrique (check, heart, star)
- ❌ Appliquer `tracking-*` à du texte arabe (casse les ligatures)
- ❌ Mettre des emojis directionnels (`👉` "pointer right") sans variant `rtl:`
- ❌ Code JS qui hardcode `'left'` / `'right'` au lieu de calculer depuis `dir`
- ❌ Tester uniquement en LTR puis "voir si ça marche en AR"
- ❌ Ignorer les ajustements typo arabe (line-height, font choice)
- ❌ Mettre un texte EN ou un nom de marque sans `<bdi>` dans un contexte AR

## 14. Migration progressive — Plan d'audit

| Étape | Action | Critère de sortie |
|---|---|---|
| 1 | Lint Tailwind classes physiques dans le code base | Liste de fichiers à corriger |
| 2 | Convertir composants partagés (`Button`, `Input`, `Card`) | Tests visuels LTR inchangés |
| 3 | Convertir Header et Footer | Manual review LTR ✓ |
| 4 | Convertir Hero et Pages marketing | LTR ✓ |
| 5 | Activer `dir="rtl"` en local | Bookmarklet test |
| 6 | Tests Playwright RTL sur smoke pages | Tous verts |
| 7 | Convertir Wizard (CHA-231 RTL) | E2E wizard AR ✓ |
| 8 | Tests utilisateurs AR | NPS positif |

## 15. Checklist de livraison RTL

Avant d'activer AR en prod :

- [ ] `dir` attribute set sur `<html>` selon locale
- [ ] Aucune classe Tailwind physique restante dans les composants partagés
- [ ] Header, Hero, Footer audités composant par composant
- [ ] Wizard checkout testé E2E en AR (CHA-231 non-régressé)
- [ ] Icônes directionnelles ont `mirror` activé (ou variant `rtl:-scale-x-100`)
- [ ] Logos et icônes symétriques sont NON miroirés
- [ ] Texte arabe a `line-height` adapté (`leading-loose` ou équivalent)
- [ ] Texte arabe n'a pas de `tracking-*` appliqué
- [ ] Numéros de téléphone et URLs sont `dir="ltr"` ou `<bdi>`
- [ ] Form fields ont `dir="auto"` pour les inputs texte libre
- [ ] Toast / Modal / Drawer animent correctement en RTL
- [ ] Screenshot regression Playwright LTR / RTL stable
- [ ] Lighthouse a11y >= 95 en AR
- [ ] Tests manuels sur device réel (Samsung + iPhone) en AR
- [ ] Tests avec utilisateur arabophone natif (au moins 1 session)
- [ ] Documentation interne sur les conventions RTL diffusée à l'équipe dev

## 16. Liens internes

- `typography.md` — choix Cairo / IBM Plex Arabic
- `images-localization.md` — quels visuels miroirer
- `wizard-i18n.md` — audit RTL du wizard
- `locale-switcher-ui.md` — `end-0` pour le panel switcher
- `02-design-conception/architecture-cible.puml` — la decision RTL globale
