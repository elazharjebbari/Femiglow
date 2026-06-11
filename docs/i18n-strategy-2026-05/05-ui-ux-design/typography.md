# Typography — Polices par locale pour FemiGlow

> Choix des polices, stratégie de chargement `next/font`, ajustements line-height et font-size par langue, fallbacks robustes. La typo est le levier éditorial #1 de FemiGlow — ne pas le négliger en arabe.

## 1. Stratégie d'ensemble

### 1.1 Principe

FemiGlow repose sur un couple typographique éditorial sobre :

- **Sans-serif** (corps de texte, UI, CTA) — Inter actuellement
- **Serif** (headlines éditoriales, citations, accents marketing) — Newsreader actuellement

En arabe, ces polices latines ne disposent pas de glyphes arabes. Il faut **substituer par des polices arabes natives** sans perdre la sensation FemiGlow.

### 1.2 Tableau récapitulatif par locale

| Locale | Sans-serif | Serif | Direction | Notes |
|---|---|---|---|---|
| `fr` | Inter Variable | Newsreader Variable | LTR | Inchangé |
| `ar` | **À choisir** (Cairo OU IBM Plex Arabic) | **À choisir** (Tajawal display OU Amiri pour serif) | RTL | Cf. section 3 |
| `en` | Inter Variable | Newsreader Variable | LTR | Identique FR |

### 1.3 Approche technique

`next/font` permet de charger les polices conditionnellement selon la locale :

```tsx
// app/[locale]/layout.tsx
import { Inter, Newsreader, Cairo, Amiri } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-serif' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-sans-arabic' });
const amiri = Amiri({ subsets: ['arabic'], weight: ['400', '700'], variable: '--font-serif-arabic' });

export default function LocaleLayout({ children, params: { locale } }) {
  const className = locale === 'ar'
    ? `${cairo.variable} ${amiri.variable}`
    : `${inter.variable} ${newsreader.variable}`;
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={className}>
      <body>{children}</body>
    </html>
  );
}
```

Tailwind config :

```ts
// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-sans)', 'var(--font-sans-arabic)', 'system-ui', 'sans-serif'],
  serif: ['var(--font-serif)', 'var(--font-serif-arabic)', 'Georgia', 'serif'],
}
```

Les classes `font-sans` et `font-serif` se résolvent automatiquement vers la bonne police selon ce qui est chargé.

## 2. Polices FR / EN (existantes — rappel)

### 2.1 Inter (sans-serif)

| Aspect | Valeur |
|---|---|
| Type | Variable font (poids 100-900) |
| License | OFL (libre commercial) |
| Subset utilisé | `latin` + `latin-ext` (caractères français accentués) |
| Poids actifs UI | 400 (body), 500 (UI), 600 (headlines secondaires) |
| Fallbacks | `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `sans-serif` |
| Pourquoi | Optimisée écran, rendu excellent <14px, x-height généreuse |

### 2.2 Newsreader (serif)

| Aspect | Valeur |
|---|---|
| Type | Variable font (poids 200-800, optical size 6-72) |
| License | OFL |
| Subset utilisé | `latin` + `latin-ext` |
| Poids actifs | 400 (citations), 500 (headlines éditoriales) |
| Fallbacks | `Georgia`, `Cambria`, `Times New Roman`, `serif` |
| Pourquoi | Optical size adaptatif, sensation revue / magazine, idéal éditorial luxe sobre |

### 2.3 Préservation actuelle

Inter et Newsreader sont **déjà** configurés dans `apps/web/src/app/layout.tsx`. La migration i18n **ne doit pas régresser** sur leur chargement actuel.

## 3. Polices AR — Comparaison de 2 options

### 3.1 Critères d'évaluation

| Critère | Pondération | Description |
|---|---|---|
| Cohérence visuelle avec Inter | 5 | L'AR doit ressentir comme la "version arabe" du même set, pas une autre marque |
| Lisibilité écran | 5 | x-height confortable, contraste des traits |
| Couverture des poids | 4 | Au moins 400 et 600 (UI + headlines) |
| Variable font dispo | 3 | Réduit poids bundle |
| License libre | 5 | OFL ou équivalent |
| Empreinte bundle | 3 | < 80 KB par poids idéalement |
| Support diacritics arabe | 5 | Voyelles courtes (fatha, kasra, damma, sukun) si on en met |
| Numérals arabes occidentaux (1,2,3) | 4 | Doit avoir glyphes arabes-indic ET occidentaux |
| Conçue par foundry réputée | 2 | Maintenance long-terme |

### 3.2 Option 1 — Cairo (Google Fonts)

| Aspect | Valeur |
|---|---|
| Foundry | Mohamed Gaber (designer) |
| Type | Variable + statique 200-1000 |
| License | OFL |
| Subset | `arabic` (+ `latin` pour mix) |
| Poids dispo | 200, 300, 400, 500, 600, 700, 800, 900 |
| Style | Géométrique moderne, x-height généreuse |
| Reputation | Très utilisée, standard de fait pour UI AR modernes |
| Pairing avec Inter | Excellent — proportions similaires, même esprit géométrique sobre |
| Couverture diacritics | Complet |
| Numerals | Inclut digits arabe-indic + occidentaux |
| Bundle (subset arabic) | ~45 KB (variable) |

**Pros**
- Très lisible à toute taille
- Pairing impeccable avec Inter (poids 400 et 600 alignés visuellement)
- Variable font donc 1 seul fichier pour tous poids
- Communauté large, ressources nombreuses
- Adoption massive (Spotify AR, Netflix AR, Careem)

**Cons**
- Très "moderne géométrique" — peu d'âme éditoriale, moins de personnalité que Newsreader côté serif
- Risque "design générique" si trop standard

### 3.3 Option 2 — IBM Plex Arabic

| Aspect | Valeur |
|---|---|
| Foundry | IBM (Mike Abbink, Wael Morcos pour AR) |
| Type | Statique (4 poids) |
| License | OFL |
| Subset | `arabic` |
| Poids dispo | 100, 200, 300, 400, 500, 600, 700 |
| Style | Humaniste, légèrement plus chaleureux que Cairo |
| Reputation | Marque IBM forte, design premium |
| Pairing avec Inter | Bon — Inter et IBM Plex Sans sont cousines visuellement |
| Couverture diacritics | Complet |
| Numerals | Digits arabes + occidentaux |
| Bundle (par poids) | ~30 KB → ~120 KB pour 4 poids |

**Pros**
- Personnalité plus marquée, sensation éditoriale plus proche FemiGlow
- Excellent rendu écran (designée pour interfaces IBM)
- Subtilités humanistes (terminations légèrement plus douces que Cairo)

**Cons**
- Pas de variable font → 4 fichiers à charger (vs 1 pour Cairo)
- Moins de poids extrêmes (pas de 800, 900)
- Bundle un peu plus lourd
- Moins répandue, ressources design moins nombreuses

### 3.4 Option 3 (alternative serif) — Amiri

Pour la "serif arabe" (équivalent Newsreader) :

| Aspect | Valeur |
|---|---|
| Foundry | Khaled Hosny |
| Type | Statique, 2 poids (regular, bold) |
| License | OFL |
| Style | Naskh classique (style manuscrit traditionnel) |
| Pourquoi | Beauté éditoriale incomparable, sensation luxe/livre |
| Usage | Headlines marketing, citations, journal |
| Restrictions | NE PAS utiliser pour UI dense (lisibilité < 14px difficile) |

Alternative serif arabe : **Tajawal** (sans-serif léger qui peut jouer le rôle serif si Amiri trop classique).

### 3.5 Recommandation finale

| Surface | Police recommandée |
|---|---|
| UI body / boutons / forms | **Cairo** (variable, léger, lisible petites tailles) |
| Headlines marketing | **Amiri** ou Cairo 600/700 (à tester en Figma) |
| Citations / éditorial | **Amiri** |
| Wizard checkout | **Cairo** (priorité lisibilité) |
| Pages légales | **Cairo** (lisibilité texte long) |
| Emails transactionnels | **Cairo** ou fallback web-safe |

**Choix par défaut V1** : Cairo partout pour AR (1 seule police = 1 chargement, performances optimales). Évaluation d'Amiri pour headlines en V2 après retours utilisateurs.

## 4. Stratégie de chargement `next/font`

### 4.1 Pourquoi `next/font` (et pas `<link>` ou `@font-face`)

- **Self-hosting automatique** : Google Fonts téléchargées au build, servies depuis votre domaine (privacy + perf)
- **Zero layout shift** : `size-adjust` calculé automatiquement
- **Preload optimisé** : injecté dans `<head>` avec `<link rel="preload">`
- **Code splitting** : seulement chargée pour les pages qui l'utilisent
- **Subsets** : ne télécharge que les glyphes nécessaires

### 4.2 Configuration recommandée

```tsx
// src/lib/i18n/fonts.ts
import { Inter, Newsreader, Cairo } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

export const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-serif',
  display: 'swap',
  preload: false, // serif rare, lazy OK
  adjustFontFallback: 'Times New Roman',
});

export const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-sans-arabic',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
});
```

### 4.3 Application conditionnelle dans le layout

```tsx
// src/app/[locale]/layout.tsx
import { inter, newsreader, cairo } from '@/lib/i18n/fonts';

export default async function LocaleLayout({ children, params: { locale } }) {
  const isArabic = locale === 'ar';
  const fontClasses = isArabic
    ? `${cairo.variable} ${inter.variable}` // Cairo principal, Inter fallback BiDi (mix latin)
    : `${inter.variable} ${newsreader.variable}`;

  return (
    <html lang={locale} dir={isArabic ? 'rtl' : 'ltr'} className={fontClasses}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

→ Note : on charge **toujours** Inter même en AR pour les fragments LTR embarqués (URLs, code, nom de marque "FemiGlow" en latin).

### 4.4 Display strategy

| Stratégie | Comportement | Recommandé pour |
|---|---|---|
| `swap` | Affiche fallback puis swap → CLS possible mais texte visible immédiat | Polices UI critiques (Inter, Cairo) |
| `block` | Texte invisible pendant chargement, puis affiche | Headlines marketing (rare) |
| `fallback` | Compromise swap + block | Polices secondaires |
| `optional` | N'attend pas, utilise fallback si pas en cache | Polices décoratives |

**V1 FemiGlow** : `swap` partout pour préserver vitesse perçue.

### 4.5 Preload sélectif

`preload: true` injecte `<link rel="preload" as="font">` dans `<head>`. À activer uniquement pour les polices visibles dès le first paint :

- Inter : preload TRUE (corps de page)
- Cairo : preload TRUE en AR (corps de page)
- Newsreader : preload FALSE (utilisée sur headlines marketing, moins critique)

### 4.6 `adjustFontFallback`

`next/font` calcule un fallback metric-matched pour éviter le CLS. À toujours activer. Pour le subset arabe :

```ts
adjustFontFallback: 'Arial'
```

Le navigateur utilise Arial avec metrics ajustés en attendant Cairo, le swap est imperceptible.

## 5. Ajustements line-height par locale

### 5.1 Pourquoi

L'arabe a :
- Des hampes hautes (lettres comme ل, ك, ط)
- Des jambages descendants (ج, ح, خ, ع, غ)
- Des diacritics qui débordent au-dessus et en-dessous

→ Le line-height latin (1.5) est trop serré pour l'arabe → empilement de lettres entre lignes.

### 5.2 Tableau de référence

| Élément | LTR line-height | RTL line-height (Cairo) |
|---|---|---|
| Body text (16px) | 1.5 (`leading-normal`) | 1.7 (`leading-loose`) |
| Headlines (32px+) | 1.2 (`leading-tight`) | 1.4 (`leading-snug` adapté) |
| Captions (12-14px) | 1.4 | 1.6 |
| Buttons / CTA (15-16px) | 1.4 | 1.5 |
| Form inputs (16px) | 1.5 | 1.6 |

### 5.3 Implémentation Tailwind

Option A — variants `rtl:` :

```html
<p class="text-base leading-normal rtl:leading-loose">...</p>
```

Option B — config Tailwind override conditionnel :

```ts
// tailwind.config.ts
theme: {
  extend: {
    lineHeight: {
      'arabic-body': '1.7',
      'arabic-tight': '1.4',
    },
  },
},
```

Puis dans le composant :

```tsx
const locale = useLocale();
const lh = locale === 'ar' ? 'leading-arabic-body' : 'leading-normal';
return <p className={cn('text-base', lh)}>...</p>;
```

Option C (recommandée) — CSS global avec attribut sélecteur :

```css
/* globals.css */
[dir="rtl"] {
  --line-height-body: 1.7;
  --line-height-heading: 1.4;
}
[dir="ltr"] {
  --line-height-body: 1.5;
  --line-height-heading: 1.2;
}

.text-body {
  line-height: var(--line-height-body);
}
```

→ V1 : option A (variants `rtl:`) pour rester proche du modèle Tailwind sans casser l'écosystème.

## 6. Ajustements font-size par locale

### 6.1 Pourquoi

Les caractères arabes ont une "x-height" perçue plus petite que les caractères latins à taille égale. Compensation : augmenter de 1-2 px.

### 6.2 Tableau de référence

| Contexte | LTR size | RTL size (Cairo) |
|---|---|---|
| Body | `text-base` (16px) | `text-[17px]` |
| Small | `text-sm` (14px) | `text-[15px]` |
| Caption | `text-xs` (12px) | `text-[13px]` |
| Headline H1 | `text-5xl` (48px) | `text-5xl` (OK) |
| Headline H2 | `text-3xl` (30px) | `text-3xl` (OK) |
| Button | `text-sm` | `text-[15px]` |

→ Les headlines (>= 24px) restent identiques (la différence devient négligeable).

### 6.3 Implémentation

Via variants Tailwind :

```html
<p class="text-base rtl:text-[17px]">...</p>
<button class="text-sm rtl:text-[15px]">...</button>
```

Ou via Cairo qui a déjà des metrics ajustées (à vérifier avec le designer).

## 7. Letter-spacing (tracking)

### 7.1 Règle absolue

**JAMAIS de `tracking-*` sur du texte arabe**. Cela casse les ligatures du script connecté.

### 7.2 Reset en RTL

```html
<h1 class="tracking-tight rtl:tracking-normal">...</h1>
<p class="tracking-wide rtl:tracking-normal">...</p>
```

Le `tracking-normal` ne casse pas les ligatures (espacement neutre).

### 7.3 Si applique : `tracking-tighter` ou `tracking-wider`

Inutile en arabe. Ignorer ou reset.

## 8. Font variable / weight stratégie

### 8.1 Inter Variable

Tous les poids dans 1 fichier (~ 35 KB). Excellente performance.

Poids utilisés :
- `400` body
- `500` UI / boutons
- `600` headlines secondaires
- `700` rare (impact)

### 8.2 Newsreader Variable

Variable optical-size + weight. Permet `font-variation-settings: 'opsz' 32` pour headlines (lettres plus fines) et `'opsz' 8` pour caption (lettres plus grasses pour lisibilité petites tailles).

```css
.heading-display {
  font-family: var(--font-serif);
  font-variation-settings: 'opsz' 48, 'wght' 500;
}
```

### 8.3 Cairo Variable

Variable weight 200-1000. Poids principaux utilisés :
- `400` body
- `600` UI / headlines
- `700` accent fort

Charger comme variable :

```ts
cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-sans-arabic',
  weight: 'variable', // ou tableau spécifique ['400','600','700']
});
```

## 9. Numérals arabes vs occidentaux

### 9.1 Décision UX

| Contexte | Chiffres |
|---|---|
| Prix (`349 MAD`) | **Occidentaux** (`1, 2, 3`) — convention e-commerce Maroc |
| Numéro téléphone (`+212 6 12...`) | **Occidentaux** |
| Numéro de commande (`#A1234`) | **Occidentaux** |
| Stepper wizard (`1, 2, 3`) | **Occidentaux** |
| Compteurs (panier `(2)`) | **Occidentaux** |
| Date longue ("27 mai 2026") | Format AR avec chiffres occidentaux : `27 ماي 2026` |
| URLs | **Occidentaux** (par standard) |
| Pages légales (numérotation sections) | **Occidentaux** |

→ Conclusion : **chiffres occidentaux partout** pour V1 (standard Maroc). Les chiffres arabes-indic (٠١٢٣) sont culturellement chargés et moins lisibles dans une UI moderne.

### 9.2 Forçage CSS si nécessaire

Cairo affiche par défaut les chiffres ASCII. Si une autre police force les arabes-indic, override :

```css
.tabular-nums {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'lnum' on; /* Lining numerals occidentaux */
}
```

Ou en HTML :

```tsx
<span dir="ltr" className="tabular-nums">349</span>
```

## 10. Diacritics arabes (tashkeel)

### 10.1 Contexte

Voyelles courtes (fatha, kasra, damma, sukun, shadda...) — optionnelles en arabe moderne. FemiGlow ne les utilise PAS sauf cas pédagogiques (jamais en V1).

### 10.2 Politique V1

**Ne pas inclure de diacritics** dans le contenu marketing — c'est lourd visuellement et inhabituel en commerce.

Exceptions :
- Citations religieuses (n/a FemiGlow)
- Mots ambigus à désambiguïser (n/a)

### 10.3 Si jamais ajoutés

Vérifier que Cairo / Amiri rendent correctement (oui, mais certains fallbacks système échouent).

## 11. Test de chargement et perf

### 11.1 Mesures cibles

| Métrique | Cible | Tool |
|---|---|---|
| First Contentful Paint (FCP) | < 1.2s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.05 | Lighthouse |
| Font swap visible | invisible (`adjustFontFallback`) | Visuel + DevTools |
| Total font bytes loaded | < 150 KB par page | Network panel |

### 11.2 Test localhost

```bash
# Build prod
pnpm build && pnpm start

# Ouvrir DevTools > Network > Font filter
# Vérifier qu'en AR seulement Cairo + Inter sont chargés (pas Newsreader)
# Vérifier qu'en FR Inter + Newsreader sont chargés (pas Cairo)
```

### 11.3 Test Lighthouse

```bash
pnpm lighthouse https://staging.femiglow.ma/fr/
pnpm lighthouse https://staging.femiglow.ma/ar/
```

A11y score >= 95 pour les deux.

### 11.4 Test visual regression

Playwright screenshots typo avant/après pour chaque locale (cf. `rtl-support.md` section 9.3).

## 12. Fallback fonts détaillés

### 12.1 Cascade complète

```css
font-family:
  var(--font-sans),       /* Inter en LTR, Cairo en AR */
  var(--font-sans-arabic),/* Cairo si fallback BiDi */
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;
```

### 12.2 Fallback arabe système

Selon OS :
- **iOS / macOS** : SF Arabic
- **Android** : Noto Naskh Arabic ou Roboto Arabic
- **Windows** : Segoe UI Arabic, Tahoma
- **Linux** : DejaVu Sans, Noto Sans Arabic

`adjustFontFallback: 'Arial'` génère un fallback Arial-based qui marche cross-platform en attendant Cairo.

### 12.3 Test fallback intentionnel

```js
// console
document.fonts.forEach(f => f.delete());
// Désactive toutes les fonts custom, doit afficher fallback système
```

Page doit rester lisible (objectif minimal).

## 13. Variable fonts et CSS `font-variation-settings`

### 13.1 Utilisation avancée

Newsreader Variable supporte 2 axes :
- `wght` (weight 200-800)
- `opsz` (optical size 6-72)

Recommandé : utiliser `opsz` pour headlines (rendu plus fin) et body (rendu plus stable).

```css
.hero-headline {
  font-family: var(--font-serif);
  font-size: 56px;
  font-variation-settings: 'opsz' 56, 'wght' 500;
}

.body-paragraph {
  font-family: var(--font-serif);
  font-size: 18px;
  font-variation-settings: 'opsz' 18, 'wght' 400;
}
```

### 13.2 Tailwind 3.4+ support

Tailwind 3.4 ajoute support natif :

```ts
fontVariationSettings: {
  'display': '"opsz" 56',
  'body': '"opsz" 18',
}
```

Usage : `font-variation-display`, `font-variation-body`.

### 13.3 Cairo variable

Cairo expose `wght`. Pas d'autre axe. Utilisation classique via `font-weight`.

## 14. Anti-patterns

- ❌ Utiliser `tracking-tight` sur du texte arabe
- ❌ Hardcoder `font-family: 'Inter'` sans fallback arabe pour les composants qui apparaitront en AR
- ❌ Charger toutes les polices toujours (gaspille bandwidth en FR)
- ❌ Charger 4+ poids non-variable (lourd)
- ❌ Oublier `preload` sur la police visible above-the-fold
- ❌ Utiliser `font-display: block` sur la font principale (texte invisible 3s)
- ❌ Polices serif en UI dense (formulaires, tableaux) — utiliser sans
- ❌ Mélanger trop de polices (>= 3) dans la même page — manque de cohésion
- ❌ Charger Amiri pour body text (illisible <14px en écran)
- ❌ Oublier d'adapter line-height en arabe (collisions de hampes)
- ❌ Forcer chiffres arabes-indic (٠١٢٣) sur des prix — confusion utilisateur Maroc
- ❌ Importer fonts via `<link>` Google directement (perd les optimisations next/font)

## 15. Plan d'A/B test typo arabe

Avant figer le choix Cairo seul ou Cairo + Amiri pour headlines, faire un test :

### 15.1 Variantes

| Variante | Sans-serif body | Headlines |
|---|---|---|
| A | Cairo 400 | Cairo 600 |
| B | Cairo 400 | Amiri 700 |
| C | IBM Plex Arabic 400 | IBM Plex Arabic 600 |

### 15.2 Métriques

- Verbatims utilisateurs arabophones (5 par variante)
- Temps de lecture body sur page Kit
- NPS de la marque perçue ("éditorial", "féminin", "haut de gamme")

### 15.3 Décision

Sur la base des verbatims, fonder le choix final V1 (Cairo seul probable pour simplicité, ou Cairo + Amiri pour headlines si valeur clairement perçue).

## 16. Checklist livraison typography

- [ ] `next/font` configuré pour Inter, Newsreader, Cairo (et Amiri si retenu)
- [ ] Chargement conditionnel par locale (pas de FR-only polices en page AR)
- [ ] Variables CSS `--font-sans`, `--font-serif`, `--font-sans-arabic` exposées
- [ ] `tailwind.config.ts` étend `fontFamily.sans` et `.serif` avec les variables
- [ ] `display: 'swap'` partout
- [ ] `preload: true` sur les polices above-the-fold uniquement
- [ ] `adjustFontFallback` activé partout
- [ ] Line-height ajusté en RTL (variant `rtl:leading-loose`)
- [ ] Font-size body augmenté +1px en AR si retenu après test
- [ ] Aucun `tracking-*` sur du texte arabe (lint custom)
- [ ] Chiffres occidentaux par défaut partout
- [ ] Test Lighthouse FR + AR >= 95 a11y
- [ ] CLS < 0.05 mesuré en RUM
- [ ] Tests Playwright screenshots typo stables LTR + RTL
- [ ] Validation visuelle par la fondatrice sur 3 écrans : hero, kit, journal
- [ ] Document Figma typo system synchronisé
- [ ] Tests sur device réel (iPhone Safari, Android Chrome) en AR

## 17. Liens

- `rtl-support.md` — applications RTL (line-height adjustement)
- `02-design-conception/architecture-cible.puml` — `<html lang dir>`
- `wizard-i18n.md` — fonts pour le wizard (Cairo)
- `docs/kolenda/Fonts.pdf` — référentiel polices marque
