# Baseline — Page Kit (`/kit`)

> Mesures et inventaire pris avant exécution du [plan 03](./03-page-kit.md).
> Ce document évolue à chaque phase ; la cible reste figée.

**Date de la mesure** : 2026-05-02
**Environnement** : Next.js 14.2.15, Node 22.22.2, pnpm 11.3.0.

---

## 1. État actuel de la page (`apps/web/src/app/(marketing)/kit/page.tsx`)

| Marqueur                              | Constat                                              |
| ------------------------------------- | ---------------------------------------------------- |
| Lignes                                | 82                                                   |
| Sections                              | 1 unique `<section>` (hero + composition `<ul>`)     |
| `<h1>`                                | présent (`product.name`)                             |
| Hiérarchie                            | 1 h1, 0 h2, 3 h3 (composition `<li>`)                |
| Image hero                            | priority + 4:5 ratio ✓                               |
| CTA primaire                          | « Ajouter au rituel » (sans logique câblée)          |
| CTA secondaire                        | absent                                               |
| Sticky CTA                            | absent                                               |
| Mini-cart slide-over                  | absent                                               |
| Toast                                 | absent                                               |
| Réassurances                          | 1 ligne « Livraison estimée : 48 à 72 h »            |
| FAQ                                   | absente                                              |
| Comparatif                            | absent                                               |
| Tableau ingrédients (INCI, %)         | absent (juste `<ul>` 3 items)                        |
| Témoignages mains avant/après         | absents                                              |
| Cross-link Journal                    | absent                                               |
| JSON-LD `Product`                     | **absent**                                           |
| `metadata.openGraph`                  | **absent**                                           |
| `metadata.alternates.canonical`       | **absent**                                           |

---

## 2. Schémas existants

`apps/web/src/lib/schemas/product.ts` (26 lignes) :

- `ingredientSchema` : `name`, `origin?`, `description?`, `inci?`
- `productSchema` : `id`, `slug`, `name`, `tagline`, `description`,
  `priceCents`, `currency` (MAD|EUR), `images`, `composition`, `inStock`,
  `estimatedShipping`.

**Manquants** (à créer en Phase 1) : `certificationSchema`,
`ingredientDetailedSchema` (avec `inci`, `concentrationPct`, `function`,
`origin` requis), `subProductSchema`, `comparatifRowSchema`,
`handsTestimonialSchema`, `reassuranceSchema`, `kitPageContentSchema`.

---

## 3. Mock existant (`apps/web/src/data/mock/product.ts`)

`mockKit` :
- 3 ingrédients (Base transparente, Fortifiant, Lime artisanale).
- 2 images SVG placeholder.
- 320 MAD, in-stock, 48–72 h Casablanca.

**Décision E2 confirmée** : on aligne sur 3 sous-produits (et non 4
comme dans la spec § 4.3).

---

## 4. Cart store (`apps/web/src/lib/stores/cart-store.ts`)

État + actions disponibles :
- `items: CartItem[]`, `isOpen`, `hydrated`
- `addItem`, `removeItem`, `updateQuantity`, `clear`
- `open`, `close`, `toggle`, `setHydrated`

**Manquants** : `isMiniCartOpen`, `openMiniCart`, `closeMiniCart`,
`addItemAndOpen` (Phase 3.5).

---

## 5. Primitif `Button`

`apps/web/src/components/ui/Button.tsx` :
- Variants : `primary`, `secondary`, `ghost`, `link`
- Sizes : `sm`, `md`, `lg`
- `fullWidth`, `loading` (avec `<Spinner>` + `aria-busy` + label « Un instant… »)
- `iconLeading`, `iconTrailing`

**Phase 2.1 déjà couverte** : l'état loading est déjà conforme à l'API
attendue par `AddToCartButton`.

---

## 6. Bundle prod actuel

D'après le `pnpm build` de la fin du plan 02 :

| Route   | Page size | First Load JS |
| ------- | --------: | ------------: |
| `/kit`  |    295 B  |    92.5 kB    |

**Cible plan 03** : ≤ 120 kB First Load JS (le sticky + toast + mini-cart
ajouteront du JS client).

---

## 7. CMS adapter

`apps/web/src/lib/cms/types.ts` : `getKit(): Promise<Product>` existant.

**Manquant** : `getKitPageContent(): Promise<KitPageContent>` à ajouter
en Phase 1, mock + stub Sanity.

**Statut Phase 1 (2026-05-02)** : ✅ Ajouté.
- `getKitPageContent()` ajouté à `CMSAdapter`.
- `mockAdapter.getKitPageContent()` retourne `mockKitPageContent`
  (3 sous-produits, 6 lignes comparatif, 8 FAQ, 3 témoignages, 3 réassurances).
- `sanityAdapter.getKitPageContent()` stub `not implemented yet`.
- `ToastProvider` + `useToast` créés (dismiss auto 4 s, `aria-live="polite"`).
- `pnpm typecheck` + `pnpm lint` verts ; `kitPageContentSchema.safeParse(data)`
  passe sur le mock.

---

## 8. Tableau de suivi

À mettre à jour après chaque phase clé.

| Métrique                          | Baseline | Cible    | Après                  |
| --------------------------------- | -------- | -------- | ---------------------- |
| LCP mobile                        |    n/a   | < 2.0 s  | non mesuré (Lighthouse pending) |
| LCP desktop                       |    n/a   | < 1.5 s  | non mesuré (Lighthouse pending) |
| CLS                               |    n/a   | < 0.05   | non mesuré             |
| INP                               |    n/a   | < 150 ms | non mesuré             |
| First-load JS gzip                |  92.5 kB | ≤ 120 kB | **162 kB** (au-dessus, voir notes) |
| Add-to-cart fonctionnel           |   non    | oui      | ✅ `addItemAndOpen` + toast + mini-cart câblés |
| Mini-cart a11y (axe + clavier)    |   n/a    | OK       | ✅ focus trap + ESC + restore + axe 0 |
| Violations axe critique           |    _     | 0        | ✅ 0 (post-patch scrollable-region-focusable) |
| JSON-LD `Product`                 |  absent  | présent  | ✅ `productSchema` + `faqPageSchema` |
| OpenGraph metadata                |  absent  | présent  | ✅ canonical `/kit` + OG fr_MA + image |
| Sections livrées                  |    1     | 8        | ✅ 8 sections + JournalGrid cross-link |
| Tests Vitest commerce             |    0     | ≥ 6      | ✅ 24 tests (AddToCart, Hero, Ingredients, FAQ, Sticky, MiniCart) |
| Suite Vitest globale              |   41     | passe    | ✅ 65/65 |

---

## 9. Décisions actées avant Phase 1

- **3 sous-produits** (E2) — alignement sur le mock existant.
- **FAQ : `<details>` natifs** (E7), plusieurs items ouvrables simultanément.
- **Stripe Phase 2** (E10) — Phase 1 = `addItemAndOpen` + redirection `/panier`.
- **CTA primaire = « Ajouter au rituel »** (E11) — cohérent avec mock + voix maison.

> *Le scaffold actuel est honnête : un hero, un prix, une promesse de
> composition. Tout le reste — preuves, comparatifs, FAQ, mini-cart —
> reste à construire.*

---

## 10. Bilan d'exécution (2026-05-02)

Plan 03 livré en 11 phases sur la journée. Toutes les phases sont passées
avec leurs critères de sortie respectés, à une exception près sur le
budget JS first-load.

### Ce qui a tenu le cap

- **Sections livrées** : 8/8 + cross-link Journal (`HeroProduit`,
  `CompositionReveal`, `VideoPlayer4Gestes`, `IngredientsDetails`,
  `ComparatifSection`, `FAQContextuelle`, `HandsTestimonials`, `PivotFinal`).
- **Commerce** : `AddToCartButton`, `MiniCartSlideOver` (focus trap + ESC +
  body lock + restoration), `StickyCartCTA` (IntersectionObserver, sentinel
  `#hero-produit-anchor`), `Toast` (`aria-live="polite"`, dismiss 4 s).
- **A11y** : 0 violation axe sur la page complète après patch
  `scrollable-region-focusable` sur `IngredientsTable` et
  `HandsTestimonialCarousel` (wrapper `role="region"` +
  `tabIndex={0}` + outline focus visible).
- **SEO** : `productSchema(product, '/kit')` + `faqPageSchema(items)` injectés
  via `JsonLd`, canonical `/kit`, OpenGraph `fr_MA`, image
  `/og/kit.svg`.
- **Tests** : 24 nouveaux tests Vitest sur les composants critiques, suite
  globale 65/65 verte. Typecheck propre.
- **Copy** : audit complet contre le glossaire éditorial — une seule
  correction (« Voir le panier » → « Revoir le panier »). Aucun mot interdit,
  pas de point d'exclamation, apostrophes courbes et espaces fines
  insécables conformes.

### L'écart à assumer

- **First-load JS** : 162 kB sur `/kit` (cible 120 kB).
  Origine : Zustand + persist middleware, formulaire AddToCart client,
  StickyCartCTA + Toast. Le mini-cart est déjà en `next/dynamic({ ssr: false })`,
  ce qui sort le slide-over du bundle initial. Le surplus reste lié aux
  primitifs commerce nécessaires au TTFI marchand. À comparer à `/rituel`
  (129 kB) qui n'embarque pas de panier. Décision : on garde
  l'expérience marchande complète au prix de ~40 kB ; piste future =
  splitter le store cart dans un chunk séparé chargé après LCP.

### Métriques non mesurées dans cette itération

- Lighthouse / Web Vitals (LCP, CLS, INP) : à mesurer en environnement
  staging avec connexion 4G simulée.
- E2E Playwright `/kit → mini-cart → /panier` : à ajouter au plan 08.

### Mantra du plan

> *Trois gestes, cinq minutes, une saison. La page Kit raconte le rituel
> avant de proposer la transaction.*
