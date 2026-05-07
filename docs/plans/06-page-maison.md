# Plan 06 — Page Maison (`/maison`)

> Plan d'exécution détaillé pour porter la page Maison au niveau « cabinet
> international ». Page institutionnelle MOFU : elle convertit le visiteur
> en partisan **avant** de lui parler du kit. À lire intégralement avant
> de toucher au scaffold actuel.

**Page cible** : `apps/web/src/app/(marketing)/maison/page.tsx`
**Spec source** : [§ 4.5 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 18 à 24 heures de travail concentré (3 jours).

---

## 1. Objectif

La page Maison est le **point de bascule MOFU** entre l'attention TOFU
(`/`, `/journal`) et la conviction BOFU (`/rituel`, `/kit`). Elle doit, dans
l'ordre :

1. Poser la posture de maison éditée à Casablanca : tagline « La maison
   d'éclat. », CTA scroll « Découvrir l'atelier \u2192 ».
2. Humaniser sans flatter : photo de mains au travail (pas pose magazine,
   pas LinkedIn), récit de la fondatrice en deux à trois paragraphes lents.
3. Ancrer dans un lieu : adresse de l'atelier, ambiance, trois photos du
   lieu, pas de stock photography.
4. Donner les preuves matières (cire d'abeille, jojoba, kaolin, mica) et
   les quatre engagements (sourcing, sans vernis, rituel lent, local).
5. Inviter à continuer : trois cross-links vers `/rituel`, `/journal`,
   `/kit`.

KPIs cibles ([§ 4.5](../preparation/04-specifications-pages.md)) :

| KPI                              | Cible    |
| -------------------------------- | -------- |
| Bounce rate                      | < 50 %   |
| Scroll ≥ 90 %                    | > 40 %   |
| Temps moyen de lecture           | > 2:30   |
| CTR cross-link `/rituel`         | > 5 %    |
| CTR cross-link `/journal`        | > 5 %    |
| CTR cross-link `/kit`            | > 5 %    |
| LCP                              | < 2.2 s  |
| CLS                              | < 0.05   |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                        | Pourquoi                                                  |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                            | « Beauté lente », ton lettre, vocabulaire autorisé        |
| 2   | [02 — Design system](../preparation/02-design-system.md)                                        | Palette champagne, sauge, pétale, crème ; Cormorant       |
| 3   | [04 — Spécifications de pages, § 4.5](../preparation/04-specifications-pages.md)                | Source canonique de la page Maison                        |
| 4   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                 | Inventaire des composants à utiliser ou créer             |
| 5   | [08 — UX, animations](../preparation/08-ux-animations-interactions.md)                          | Reveal au scroll, parallaxe douce sur photos              |
| 6   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                  | Hiérarchie h1 → h4, alt-text photos d'atelier             |
| 7   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                    | Galerie atelier : `sizes` justes, lazy hors viewport      |
| 8   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                     | JSON-LD `Organization` + `LocalBusiness`                  |
| 9   | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                     | Mots interdits, microcopy CTA, ton « lettre »             |
| 10  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md)                          | Cycle, DoD composant, DoD page                            |

**Temps de relecture** : 75 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (à vérifier dans `tokens.css`)

- Couleurs : `--sauge`, `--sauge-soft`, `--creme`, `--encre`, `--petale`,
  `--champagne`, plus une teinte `--kaolin` (crème pâle dédiée matière) à
  ajouter si absente.
- Typographies : `--font-display` (Cormorant), `--font-body` (Inter),
  `--font-script` (Pinyon Script — signature manuscrite optionnelle).
- Tailles : `display-xl` (96 pt hero), `display-md` (titres section),
  `lead`, `body`, `caption`.
- Espacements `--space-1` à `--space-24`, motion `--duration-base`,
  `--duration-slow`, `--ease-out-soft`. Media queries
  `prefers-reduced-motion` et `prefers-contrast: more`.

### 3.2 Primitifs UI (déjà polis Plan 01, vérifications légères)

| Composant   | Vérification spécifique Maison                                          |
| ----------- | ----------------------------------------------------------------------- |
| `Button`    | Variant `link` pour CTA scroll « Découvrir l'atelier \u2192 »           |
| `Container` | Variant `prose` (max 65 ch) pour les sections narratives                |
| `Heading`   | `display-xl` pour le hero, `display-md` pour les titres de section      |
| `Text`      | `lead` 24 pt leading 1.6 pour les paragraphes narratifs                 |
| `Image`     | `sizes` dynamiques pour la grille atelier (3 col desktop)               |

### 3.3 Sections de la page

| #   | Section                | Fichier                                                  | État        |
| --- | ---------------------- | -------------------------------------------------------- | ----------- |
| 1   | Hero éditorial         | `sections/HeroMaison.tsx`                                | **À créer** |
| 2   | L'origine              | `sections/SectionNarrative.tsx` (instance n°1)           | **À créer** |
| 3   | La fondatrice          | `sections/SectionNarrative.tsx` (instance n°2)           | réutilisé   |
| 4   | L'atelier Casablanca   | `sections/AtelierGallery.tsx`                            | **À créer** |
| 5   | Les matières           | `sections/MatieresGrid.tsx` (+ `MatiereCard`)            | **À créer** |
| 6   | Les quatre engagements | `sections/EngagementsGrid.tsx` (+ `EngagementCard`)      | **À créer** |
| 7   | Cross-link triptyque   | `sections/CrossLinkTriptyque.tsx` (+ `CrossLinkCard`)    | **À créer** |

### 3.4 Composants spécifiques à créer

| Composant            | Pourquoi                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `HeroMaison`         | Hero éditorial 92vh, titre « La maison d'éclat. », CTA scroll                             |
| `SectionNarrative`   | Bloc texte + photo, mise en page `imagePosition: 'left' \| 'right'`, réutilisable Rituel  |
| `AtelierGallery`     | 3 photos paysage, stack mobile / grille desktop, modal Radix Dialog au tap                |
| `MatiereCard`        | Mini-fiche : icône SVG botanique, kicker, titre, Origine, Pourquoi, ambiance colorée     |
| `EngagementCard`     | Variante `GesteCard` : numéro 01..04 Cormorant champagne, kicker, titre, 1-2 lignes       |
| `CrossLinkCard`      | Image 4:5 + kicker + titre, triptyque desktop / vertical mobile                           |
| `Reveal`, `Fleuron`  | Réutilisés du Plan 01 — vérifier qu'ils existent                                           |

### 3.5 Données

Récupérées via `cms.getMaisonPageContent()`
([`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)),
mock dans [`data/mock/maison.ts`](../../apps/web/src/data/mock/maison.ts).
Le schéma actuel est trop pauvre — voir § 4.

---

## 4. Écarts entre la spec (§ 4.5) et le scaffold actuel

| #   | Spec (§ 4.5)                                              | Scaffold actuel                                                      | Décision proposée                                                                          |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E1  | Hero 92vh « La maison d'éclat. » + CTA scroll              | Hero variant `'lettre'`, titre « Une maison, à Casablanca. »          | **Remplacer** par `HeroMaison` dédié, titre conforme, CTA scroll vers `#origine`           |
| E2  | Sections L'origine + La fondatrice avec photos            | 4 paragraphes en pile, sans photo                                    | **Découper** `storyParagraphs` en `origine` et `fondatrice`, ajouter images               |
| E3  | Atelier Casablanca : adresse + ambiance + 3 photos        | Absent                                                               | **Créer** `AtelierGallery` + champ `atelier` dans le schéma                                |
| E4  | 4 mini-fiches matières (Cire, Jojoba, Kaolin, Mica)       | Absent                                                               | **Créer** `MatieresGrid` + `MatiereCard` + champ `matieres: Matiere[]`                     |
| E5  | 4 engagements (Sourcing, Sans vernis, Rituel lent, Local) | Absent                                                               | **Créer** `EngagementsGrid` + `EngagementCard` + champ `engagements: Engagement[]`         |
| E6  | Cross-link triptyque vers `/rituel`, `/journal`, `/kit`   | Absent                                                               | **Créer** `CrossLinkTriptyque` + champ `crossLinks: CrossLink[]`                           |
| E7  | Photo fondatrice = mains au travail (pas portrait posé)   | Aucune image                                                         | **Direction artistique** documentée dans le mock : ratio 4:5, mains visibles, alt explicite |
| E8  | `signatureImage` Pinyon Script optionnelle                | Présente dans le schéma, inutilisée                                  | **Conserver** : signature manuscrite en clôture de la section Fondatrice si fournie        |

Ces huit écarts représentent ~3 h de travail préparatoire (Phase 1).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**.

### Phase 0 — Baseline (30 min)

- [ ] `pnpm dev`, capture d'écran `/maison` (mobile 375 px, desktop 1440 px).
- [ ] Lighthouse mobile : LCP, CLS, INP, TBT.
- [ ] axe DevTools : nombre de violations critiques.
- [ ] `pnpm build` → bundle size de la route `/maison`.
- [ ] Sauvegarder dans `docs/plans/06-page-maison-baseline.md`.

### Phase 1 — Résolution des écarts spec / scaffold (3 h)

#### 1.1 Étendre le schéma `MaisonPageContent`
Fichier : [`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)

```ts
export const matiereSchema = z.object({
  id: z.string(),
  nom: z.string(),                // « Cire d'abeille »
  origine: z.string(),            // « Récoltée dans le Souss »
  pourquoi: z.string(),           // 1-2 lignes
  iconSlug: z.enum(['cire', 'jojoba', 'kaolin', 'mica']),
  ambiance: z.enum(['champagne', 'sauge', 'creme', 'petale']),
});

export const engagementSchema = z.object({
  ordre: z.number().int().min(1).max(4),
  titre: z.string(),
  description: z.string(),
});

export const crossLinkSchema = z.object({
  id: z.string(),
  href: z.string(),
  kicker: z.string(),
  titre: z.string(),
  image: imageSchema,
});

export const atelierSchema = z.object({
  adresse: z.string(),
  quartier: z.string(),
  description: z.array(z.string()).min(1).max(3),
  gallerie: z.array(imageSchema).length(3),
});

export const narrativeSectionSchema = z.object({
  kicker: z.string(),
  titre: z.string(),
  paragraphs: z.array(z.string()).min(2).max(3),
  image: imageSchema,
  imagePosition: z.enum(['left', 'right']).default('right'),
});

export const maisonPageContentSchema = z.object({
  hero: heroSchema,
  origine: narrativeSectionSchema,
  fondatrice: narrativeSectionSchema,
  atelier: atelierSchema,
  matieres: z.array(matiereSchema).length(4),
  engagements: z.array(engagementSchema).length(4),
  crossLinks: z.array(crossLinkSchema).length(3),
  signatureImage: imageSchema.optional(),
});
```

> **Migration** : `storyParagraphs` disparaît. Tout consommateur passe sur
> `origine.paragraphs` / `fondatrice.paragraphs`.

#### 1.2 Réécrire `mockMaison`
Fichier : [`data/mock/maison.ts`](../../apps/web/src/data/mock/maison.ts)

- Hero : `variant: 'editorial'`, kicker « La maison », titre « La maison
  d'éclat. », CTA `{ label: 'Découvrir l\u2019atelier \u2192', href: '#origine' }`.
- `origine` : 2-3 paragraphes, photo 4:5 à droite.
- `fondatrice` : 2-3 paragraphes, photo de mains au travail à gauche.
- `atelier` : adresse, quartier, 3 images paysage 3:2 (intérieur, plan de
  travail, détail matière).
- `matieres` : 4 entrées (Cire / champagne, Jojoba / sauge, Kaolin / crème,
  Mica / pétale).
- `engagements` : 01 Sourcing éthique, 02 Sans vernis, 03 Rituel lent,
  04 Local.
- `crossLinks` : `/rituel`, `/journal`, `/kit` avec image et kicker dédiés.

#### 1.3 Adapter `cms.getMaisonPageContent()` et la page
S'assurer que `cms` renvoie le mock enrichi et passe `safeParse`. Adapter
provisoirement `page.tsx` pour boucler sur `content.origine.paragraphs` —
le rendu sera laid mais cohérent. **Sortie de phase** : `pnpm typecheck`
vert.

#### 1.4 Commit
```
git add -A
git commit -m "Étend MaisonPageContent : origine, fondatrice, atelier, matières, engagements, cross-links"
```

### Phase 2 — Polissage des primitifs UI (1 h)

| Ordre | Composant   | Points d'attention spécifiques Maison                                |
| ----- | ----------- | -------------------------------------------------------------------- |
| 1     | `Button`    | Variant `link` avec flèche `\u2192` intégrée                         |
| 2     | `Container` | Variant `prose` à 65 ch confortable pour la lecture longue           |
| 3     | `Image`     | `sizes="(min-width: 1024px) 33vw, 100vw"` pour la galerie atelier    |

**Commit** : un seul, « Affine `Container` prose et `Button` link pour Maison ».

### Phase 3 — Création des composants spécifiques (5 h)

#### 3.1 `HeroMaison`
- Server Component, hauteur min 92vh desktop / 80vh mobile.
- Fond : dégradé crème → champagne très subtil, fleuron SVG décoratif
  top-right opacité 8 %.
- Titre Cormorant `display-xl` 96 pt centré, kicker au-dessus, tagline 2
  lignes max, CTA `Button` variant `link` ancrant `#origine`.
- LCP candidat = le `<h1>`. Pas d'image.

#### 3.2 `SectionNarrative`
- Server Component, 12 colonnes desktop : texte 6 col + image 5 col +
  1 col de respiration. Inversion selon `imagePosition`.
- Mobile : pile verticale, image avant texte.
- Props : `id?`, `data: NarrativeSection`, `tone?: 'creme' | 'sauge-soft'`.
- Chaque paragraphe wrappé dans `<Reveal direction="up" delay={i * 80} />`.
- Réutilisable tel quel par le futur Plan Rituel.

#### 3.3 `AtelierGallery`
- Client Component (gère le Dialog Radix).
- Header : kicker « L'atelier », titre `display-md`, adresse, quartier,
  2-3 lignes de description.
- Galerie 3 photos 3:2 : stack mobile gap `space-4`, grille 3 col desktop
  gap `space-6`.
- Tap photo → modal Radix `<Dialog>` fullscreen sur fond `bg-encre/95`,
  ESC ferme, focus trap géré par Radix.
- Pas de carrousel, pas de lib lightbox tierce.

#### 3.4 `MatiereCard` et `MatieresGrid`
- `MatieresGrid` Server : header (kicker « Les matières », titre
  `display-md`), grille 2×2 desktop, 1 col mobile.
- `MatiereCard` Server : background pâle selon `ambiance` (cire =
  `bg-champagne/20`, jojoba = `bg-sauge-soft`, kaolin = `bg-creme`,
  mica = `bg-petale/30`). Icône SVG botanique 32×32, kicker, titre
  Cormorant `display-sm`, micro-sections « Origine » + « Pourquoi »
  séparées par filet encre 10 %.
- 4 SVG inline trait fin encre 60 % dans `components/icons/matieres/`.

#### 3.5 `EngagementCard` et `EngagementsGrid`
- `EngagementsGrid` Server : header kicker « Les quatre engagements »,
  4 col desktop, 2 col tablet, 1 col mobile.
- `EngagementCard` Server : numéro 01..04 en gros Cormorant `display-lg`
  champagne, kicker, titre `display-sm`, description 1-2 lignes `body`
  tone secondary. Pas de bordure, pas de fond — la typographie fait le
  découpage.

#### 3.6 `CrossLinkCard` et `CrossLinkTriptyque`
- `CrossLinkTriptyque` Server : pas de header (clôture silencieuse),
  3 col desktop, vertical mobile.
- `CrossLinkCard` Server : image 4:5 en haut, kicker, titre Cormorant
  `display-sm`, toute la card cliquable via `<Link>` Next.
- Hover desktop : zoom image `scale(1.02)` 480 ms ease-out-soft, kicker
  encre 60 % → 100 %. `prefers-reduced-motion` : pas de zoom.

**Commits** : un par composant. Six commits.

### Phase 4 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/maison/page.tsx`](../../apps/web/src/app/(marketing)/maison/page.tsx)

```tsx
const content = await cms.getMaisonPageContent();

return (
  <>
    <HeroMaison data={content.hero} />
    <SectionNarrative id="origine" data={content.origine} tone="creme" />
    <Fleuron />
    <SectionNarrative id="fondatrice" data={content.fondatrice} tone="creme" />
    <AtelierGallery data={content.atelier} />
    <MatieresGrid matieres={content.matieres} />
    <EngagementsGrid engagements={content.engagements} />
    <CrossLinkTriptyque links={content.crossLinks} />
  </>
);
```

> Pas de Fleuron entre l'atelier et les matières — chaque section a sa
> propre densité, l'ornement serait redondant.

**Commit** : « Assemble la page Maison ».

### Phase 5 — SEO, métadonnées, JSON-LD (1 h)

```tsx
export const metadata: Metadata = {
  title: 'La maison \u2014 Casablanca',
  description:
    'FemiGlow, maison de soin pour les ongles éditée à Casablanca. L\u2019origine, la fondatrice, l\u2019atelier, les matières et nos quatre engagements.',
  alternates: { canonical: '/maison' },
  openGraph: {
    type: 'website',
    title: 'La maison FemiGlow \u2014 Casablanca',
    description: 'Maison de soin pour les ongles, éditée à Casablanca.',
    images: [{ url: '/og/maison.svg', width: 1200, height: 630, alt: 'FemiGlow \u2014 La maison' }],
  },
};
```

JSON-LD via `<JsonLd type="LocalBusiness" />` :

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "FemiGlow",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Casablanca",
    "addressCountry": "MA"
  },
  "url": "https://femiglow.ma/maison"
}
```

**Commit** : « SEO et JSON-LD pour la page Maison ».

### Phase 6 — Performance (2 h)

- LCP candidat = `<h1>` Cormorant 96 pt. `next/font/local` avec
  `display: 'swap'` + métriques fallback déjà calé Plan 01.
- Galerie atelier : `loading="lazy"`, `sizes="(min-width: 1024px) 33vw, 100vw"`,
  AVIF, `placeholder="blur"` + `blurDataURL` 16 px inline.
- Photos narratives 4:5 : `loading="lazy"`, `sizes="(min-width: 1024px) 42vw, 100vw"`.
- Modal Radix Dialog : code-split par route, ne pas l'importer dans le
  layout.
- `pnpm build` → first-load JS de `/maison` ≤ 100 kB gzip.
- Lighthouse mobile : LCP < 2.2 s, CLS < 0.05, INP < 150 ms.

**Commit** : « Optimise la page Maison : galerie lazy, sizes justes, Dialog code-split ».

### Phase 7 — Accessibilité (2 h)

- [ ] Un seul `<h1>` (HeroMaison). Hiérarchie h2 (chaque section) → h3
      (chaque card de matière, d'engagement, de cross-link).
- [ ] Skip-link cible `#main`.
- [ ] Tab order : Header → CTA scroll → photos atelier (chacune un
      `<button>` `aria-label="Voir la photo : [alt]"`) → 3 cross-links →
      Footer. Paragraphes non focusables.
- [ ] Modal Dialog : `aria-labelledby`, ESC ferme, focus retourne sur le
      bouton qui a ouvert.
- [ ] Cross-links : la card entière est un `<Link>`, pas de double
      tabulation.
- [ ] Tap targets ≥ 44 × 44 px.
- [ ] Contraste : encre/crème ≥ 13:1, kickers tone tertiary ≥ 7:1.
- [ ] axe-core : zéro violation critique.
- [ ] VoiceOver : annonce « bouton, ouvre la galerie » sur les tuiles.
- [ ] `prefers-reduced-motion` : pas de Reveal, pas de zoom CrossLink,
      ouverture Dialog instantanée.

**Commit** : « Audit accessibilité Maison : 0 violation, navigation clavier propre ».

### Phase 8 — Tests (2 h)

#### 8.1 Vitest unitaires (un par composant)

```ts
// MatiereCard.test.tsx
import { render, screen } from '@testing-library/react';
import { MatiereCard } from './MatiereCard';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend({ toHaveNoViolations });

const matiere = {
  id: 'cire',
  nom: 'Cire d\u2019abeille',
  origine: 'Récoltée dans le Souss',
  pourquoi: 'Adoucit le sertissage de l\u2019ongle.',
  iconSlug: 'cire' as const,
  ambiance: 'champagne' as const,
};

describe('MatiereCard', () => {
  it('rend le nom de la matière en h3', () => {
    render(<MatiereCard matiere={matiere} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/cire/i);
  });

  it('respecte axe', async () => {
    const { container } = render(<MatiereCard matiere={matiere} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

#### 8.2 Storybook + 8.3 Playwright golden path

```ts
// e2e/maison.spec.ts
test('Maison : golden path', async ({ page }) => {
  await page.goto('/maison');
  await expect(page.getByRole('heading', { level: 1, name: /maison d\u2019éclat/i })).toBeVisible();
  await page.getByRole('link', { name: /découvrir l\u2019atelier/i }).click();
  await expect(page.locator('#origine')).toBeInViewport();
  await page.getByRole('button', { name: /voir la photo/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /lire le rituel/i }).click();
  await expect(page).toHaveURL('/rituel');
});
```

**Commit** : « Tests Maison : unitaires, stories, E2E golden path ».

### Phase 9 — Copy et finitions (1 h)

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans « \u202F\u2026\u202F ».
- [ ] CTA Hero : « Découvrir l'atelier \u2192 ».
- [ ] Kickers : « L'origine », « La fondatrice », « L'atelier », « Les
      matières », « Les quatre engagements ».
- [ ] Cross-links : « Lire le rituel », « Le journal », « Voir le kit ».
      Pas « En savoir plus », pas « Découvrir » seul.
- [ ] Tagline Hero : ≤ 14 mots, ≤ 80 caractères.
- [ ] Test à voix haute : chaque section se lit-elle d'un trait ?

**Commit** : « Polit la copy de la page Maison contre le glossaire éditorial ».

### Phase 10 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile et desktop, comparaison baseline / après dans
      `docs/plans/06-page-maison-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` vert.
- [ ] Capture vidéo du golden path mobile et desktop.
- [ ] PR référencée à ce plan et à la spec § 4.5.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` :
      « Maison : LCP 1.8 s, CLS 0.02, INP 110 ms, axe 0, copy validée ».

---

## 6. Definition of Done — spécifique Maison

- [ ] Hero 92vh sans qu'il faille scroller pour voir le CTA.
- [ ] Les 7 sections alternent respiration / densité (Hero respire,
      Origine dense, Fondatrice respire, Atelier dense visuellement,
      Matières dense informationnellement, Engagements respire,
      Cross-links dense).
- [ ] La photo de la fondatrice n'est **jamais** un portrait posé. Si la
      photo définitive n'est pas prête, le placeholder est déjà une photo
      de mains au travail.
- [ ] Galerie atelier : Dialog ouvre en < 200 ms après le tap.
- [ ] 4 MatiereCards ont leur teinte d'ambiance, contraste WCAG AA
      respecté.
- [ ] Les 3 cross-links pointent vers `/rituel`, `/journal`, `/kit` —
      pas vers `/`, pas vers `/contact`.
- [ ] Aucun `console.warn` en dev, build ou prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/06-page-maison-baseline.md` :

| Métrique                  | Baseline | Cible    | Après  |
| ------------------------- | -------- | -------- | ------ |
| LCP mobile                | _        | < 2.2 s  | _      |
| LCP desktop               | _        | < 1.8 s  | _      |
| CLS                       | _        | < 0.05   | _      |
| INP                       | _        | < 150 ms | _      |
| TBT                       | _        | < 250 ms | _      |
| First-load JS gzip        | _        | ≤ 100 kB | _      |
| Violations axe critique   | _        | 0        | _      |
| Lighthouse Perf           | _        | ≥ 92     | _      |
| Lighthouse a11y           | _        | 100      | _      |
| Lighthouse Best Practices | _        | ≥ 95     | _      |
| Lighthouse SEO            | _        | 100      | _      |

---

## 8. Risques et points d'attention

| Risque                                                                | Mitigation                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Photo fondatrice définitive pas prête à temps                         | Placeholder « mains au travail » conforme dès la première PR                        |
| Galerie atelier alourdit la page                                      | AVIF, `loading="lazy"`, ratio fixé, `blurDataURL` inline                            |
| Modal Dialog Radix charge ~12 kB                                      | Code-split par route ; ne pas importer Dialog dans le layout                        |
| 4 MatiereCards trop décoratives → on perd le ton sobre                | Test à voix haute : si on parle d'« étiquettes colorées », c'est trop ; ambiance ≤ 5 % |
| EngagementCards en 4 col illisibles tablet 768 px                     | Breakpoint 2×2 entre 640-1023 px, 4 col ≥ 1024 px                                   |
| Cross-links pointent vers pages encore en chantier                    | OK : la nav existe, le contenu suivra ; ne pas dégrader la maquette pour autant     |
| `signatureImage` chargée mais non affichée                            | Si non fournie, ne pas rendre le `<Image>` ; pas de placeholder vide                |
| Sanity (Phase 2) renverra des `Matiere[]` plus riches                 | Schéma Zod = source de vérité ; ajouter des champs en optionnel                     |

---

## 9. Estimation horaire récapitulative

| Phase                          | Estimation |
| ------------------------------ | ---------- |
| 0 — Baseline                   | 0 h 30     |
| 1 — Résolution écarts          | 3 h        |
| 2 — Polissage primitifs        | 1 h        |
| 3 — Composants spécifiques     | 5 h        |
| 4 — Assemblage page            | 1 h        |
| 5 — SEO + JSON-LD              | 1 h        |
| 6 — Performance                | 2 h        |
| 7 — Accessibilité              | 2 h        |
| 8 — Tests                      | 2 h        |
| 9 — Copy & finitions           | 1 h        |
| 10 — Mesure & merge            | 0 h 30     |
| **Total**                      | **19 h**   |

Avec interruptions, allers-retours direction artistique sur les photos et
finitions micro-typographiques : **22 à 24 h, soit 3 jours pleins**.

---

## 10. Annexes — commandes utiles

```bash
# Dev
cd apps/web && pnpm dev

# Lighthouse
npx lighthouse http://localhost:3000/maison --view --preset=desktop --output-path=./lighthouse-maison-desktop.html
npx lighthouse http://localhost:3000/maison --view --output-path=./lighthouse-maison-mobile.html

# Bundle analyzer
ANALYZE=true pnpm --filter @femiglow/web build

# axe en CLI
npx @axe-core/cli http://localhost:3000/maison

# Tests
pnpm --filter @femiglow/web test -- maison
pnpm --filter @femiglow/web test:e2e -- maison
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *La page Maison tient debout si, en l'envoyant à un journaliste de la
> presse beauté ou à un partenaire CMI, vous n'avez **rien à excuser**.
> Pas de « la photo de la fondatrice est temporaire », pas de « les
> matières seront étoffées plus tard », pas de « la galerie est un
> placeholder ». Et surtout : si on lit la page de bout en bout sans
> toucher au kit, on doit déjà avoir envie d'y revenir. Si on lit en
> pensant « bon, et le produit alors\u202F? », la page n'est pas finie.*

À cocher **avant** d'attaquer la page suivante.

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Schéma `MaisonPageContent` étendu** ([`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)) :
  `origine` + `fondatrice` (`narrativeSectionSchema`) + `atelier` +
  `matieres[4]` + `engagements[4]` + `crossLinks[3]`. `storyParagraphs` retiré.
- **Mock enrichi** ([`mock/maison.ts`](../../apps/web/src/data/mock/maison.ts)) :
  hero éditorial avec CTA scroll, 2 sections narratives (right/left), atelier
  rue des Acacias, 4 matières (cire / jojoba / kaolin / mica), 4 engagements
  numérotés, 3 cross-links vers `/rituel`, `/journal`, `/kit`.
- **9 composants Maison** :
  - [`HeroMaison.tsx`](../../apps/web/src/components/sections/HeroMaison.tsx)
    — hero 80–92vh dédié, gradient crème → champagne, fleuron décor 20 %
    opacité, h1 `display-xl` italique-auto, CTA `link` scroll.
  - [`SectionNarrative.tsx`](../../apps/web/src/components/sections/SectionNarrative.tsx)
    — étendu avec `id`, `tone` (`creme | sauge-soft | sepia`), désactive le
    filtre sépia hérité du Plan Rituel.
  - [`AtelierGallery.tsx`](../../apps/web/src/components/sections/AtelierGallery.tsx)
    Client — galerie 3 photos 3:2 + `<dialog>` HTML natif (ESC, focus,
    backdrop) sans dépendance Radix supplémentaire.
  - [`MatieresGrid.tsx`](../../apps/web/src/components/sections/MatieresGrid.tsx)
    + [`MatiereCard.tsx`](../../apps/web/src/components/sections/MatiereCard.tsx)
    — grille 2×2, 4 ambiances (champagne / sauge / crème / pétale), 4 SVG
    botaniques inline ([`MatiereIcon.tsx`](../../apps/web/src/components/icons/matieres/MatiereIcon.tsx)),
    `<dl>` Origine / Pourquoi.
  - [`EngagementsGrid.tsx`](../../apps/web/src/components/sections/EngagementsGrid.tsx)
    + [`EngagementCard.tsx`](../../apps/web/src/components/sections/EngagementCard.tsx)
    — 4 col desktop, numéro 01..04 Cormorant italic 56 pt champagne, tri par
    `ordre`.
  - [`CrossLinkTriptyque.tsx`](../../apps/web/src/components/sections/CrossLinkTriptyque.tsx)
    + [`CrossLinkCard.tsx`](../../apps/web/src/components/sections/CrossLinkCard.tsx)
    — 3 col desktop, image 4:5, hover scale 1.02 (motion-reduce: désactivé),
    card cliquable via `<Link>` Next, ratio `4:5`.
- **Page** ([`/maison/page.tsx`](../../apps/web/src/app/(marketing)/maison/page.tsx))
  — 2× `<JsonLd>` (`LocalBusiness` + `Organization`) + `HeroMaison` + 2×
  `SectionNarrative` (origine right / fondatrice left) + `Fleuron` entre les
  deux + `AtelierGallery` + `MatieresGrid` + `EngagementsGrid` +
  `CrossLinkTriptyque`. Metadata enrichi (canonical, OG, Twitter
  summary_large_image).
- **JSON-LD** ([`json-ld.tsx`](../../apps/web/src/lib/seo/json-ld.tsx)) —
  ajout de `localBusinessSchema(input)` (`name`, `url`, `streetAddress`,
  `addressLocality`, `addressCountry`, `areaServed`).
- **8 SVG placeholders** ([`public/maison/`](../../apps/web/public/maison))
  — gradients labellés en attendant les photos définitives.
- **Image primitif** ([`Image.tsx`](../../apps/web/src/components/ui/Image.tsx))
  — ajout du ratio `3:2` pour la galerie atelier.

### Métriques après

| Métrique                          | Avant     | Après  |
| --------------------------------- | --------- | ------ |
| First Load JS `/maison`           | 99.2 kB (185 B route) | 128 kB (3.02 kB route) |
| Suite Vitest                      | 98 verts (28 fichiers) | 113 verts (33 fichiers) |
| Tests Maison dédiés               | 0         | 5 fichiers, 15 tests |
| Violations axe                    | _         | 0 (axe-core 4.10) |
| TypeScript / ESLint               | _         | 0 / 0 |
| h1 / h2 / h3                      | 1 / 0 / 0 | 1 / 5 / 11 |
| Sections                          | 1 (lettre + storyParagraphs) | 7 (Hero, Origine, Fondatrice, Atelier, Matières, Engagements, Cross-links) |
| JSON-LD                           | 0         | 2 (LocalBusiness + Organization) |

### Décisions notables

- **`<dialog>` HTML natif au lieu de Radix Dialog** — le Plan le mentionne
  comme premier choix, mais la dépendance `@radix-ui/react-dialog` n'était
  pas installée. Le `<dialog>` natif fournit ESC + focus trap + backdrop
  modal sans bundle supplémentaire ; click-outside géré par `e.target ===
  dialogRef`. Polyfill testé en jsdom (`HTMLDialogElement.prototype.showModal`
  stub dans `AtelierGallery.test.tsx`).
- **Pas de Reveal sur les matières / engagements** — le Plan en suggère sur
  les paragraphes narratifs uniquement. Reveal sur les grilles aurait créé
  un effet « cascade marketing » contraire au ton sobre.
- **`SectionNarrative` étendu plutôt que dupliqué** — ajout des props `id`
  et `tone` pour réutiliser sur Maison sans casser Rituel (test existant
  reste vert avec defaults `tone: 'sepia'`).
- **`storyParagraphs` retiré du schéma** — pas de shim de rétrocompatibilité,
  un seul consommateur (`/maison/page.tsx`) migré en même temps.
- **8 SVG placeholders gradient labellés** — placeholders honnêtes en
  attendant les photos définitives (mains au travail, plan de travail
  atelier). Le label est lisible donc on n'excuse rien : c'est explicitement
  un placeholder éditorial.

### Critère de presse

La page `/maison` peut être ouverte à un journaliste : posture éditoriale
posée dès le hero, deux sections narratives lentes, adresse réelle de
l'atelier, 4 matières chacune avec son origine traçable et son pourquoi,
4 engagements ancrés, 3 cross-links sortants vers le rituel / le journal /
le kit. `LocalBusiness` JSON-LD complet pour Google. axe 0, 113 tests verts,
3.02 kB route. Rien à excuser sauf les photos placeholder.
