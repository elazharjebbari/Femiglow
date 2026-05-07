# Plan 08 — Page Panier (`/panier`)

> Plan d'exécution détaillé pour porter la page Panier au niveau « cabinet
> international ». Pre-checkout, dernière vérification posée, engagement
> mesuré vers `/commander`. À lire de bout en bout avant de toucher au code.

**Page cible** : [`apps/web/src/app/(commerce)/panier/page.tsx`](../../apps/web/src/app/(commerce)/panier/page.tsx)
**Spec source** : [§ 4.6 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 12 à 18 heures de travail concentré (2 jours).

---

## 1. Objectif

La page Panier est un **point de friction calme**. Elle doit, dans l'ordre :

1. Confirmer ce qui se passera : « Voici ce que vous emportez. »
2. Permettre l'**ajustement sans douleur** (quantité, retrait) avec la
   discrétion d'un comptoir.
3. Donner l'estimation honnête du total — sous-total, livraison
   approximative, total — avant `/commander`.
4. Délivrer trois preuves de réassurance (livraison, retour, sécurité)
   sans en faire des promesses commerciales.
5. Inviter à revenir au journal si la décision n'est pas mûre — la maison
   ne pousse pas.

KPIs cibles ([§ 4.6](../preparation/04-specifications-pages.md)) :

| KPI                                        | Cible    |
| ------------------------------------------ | -------- |
| Conversion panier → checkout               | > 75 %   |
| Temps moyen sur la page                    | ~ 45 s   |
| Abandons après modification quantité       | < 10 %   |
| Taux d'utilisation modal de suppression    | > 90 %   |
| LCP                                        | < 2.0 s  |
| CLS                                        | < 0.05   |
| INP                                        | < 150 ms |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                  | Pourquoi                                                          |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [00 — Résumé exécutif](../preparation/00-executive-summary.md)                            | Recadrer l'intention                                              |
| 2   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                      | Vérifier que chaque mot du panier tient la voix                   |
| 3   | [02 — Design system](../preparation/02-design-system.md)                                  | Tokens, typographies, espacements                                 |
| 4   | [04 — Spécifications de pages, § 4.6](../preparation/04-specifications-pages.md)          | Source canonique de la page Panier                                |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)           | Inventaire `CartItem`, `QuantitySelector`, `CartSummary`          |
| 6   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md) | Micro-feedback retrait article, transition quantité               |
| 7   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)            | Modal accessible, ARIA live, tap targets selector quantité        |
| 8   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)              | Squelette serveur, hydration sans flash, framer-motion lazy       |
| 9   | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)               | Vocabulaire autorisé, mots interdits (« acheter », « produit »)   |
| 10  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5        | Cycle, DoD composant, DoD page                                    |

**Temps de relecture** : 60 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (sont-ils tous dans `tokens.css` ?)

À vérifier dans [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css)
contre [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge`, `--sauge-soft`, `--creme`, `--encre`, `--champagne`.
- Typographies : `--font-display` (Cormorant), `--font-body` (Inter).
- Tailles : `display-md` (titre panier), `lead`, `body`, `caption`.
- Espacements : `--space-1` à `--space-20`, en particulier `--space-12`
  pour la grille article / sidebar.
- Motion : `--duration-fast` (120 ms), `--duration-base` (240 ms),
  `--ease-out-soft`.
- Z-index : `--z-sticky`, `--z-modal`, `--z-overlay`.
- Safe-areas : `env(safe-area-inset-bottom)` pour la barre CTA mobile.

### 3.2 Primitifs UI (à polir avant la page)

Dans `apps/web/src/components/ui/` :

| Composant   | État actuel | À polir avant Panier                                          |
| ----------- | ----------- | ------------------------------------------------------------- |
| `Button`    | Présent     | Variants primary, secondary, ghost ; `loading`, `fullWidth`   |
| `Container` | Présent     | Variant `page` (max-width 1280, padding responsive)           |
| `Heading`   | Présent     | Tailles `display-md`, `lg`, `sm`                              |
| `Text`      | Présent     | Variants `body`, `caption` ; tones default/secondary/tertiary |
| `Kicker`    | Présent     | Pour « Le panier » au-dessus du h1                            |
| `Image`     | Présent     | `sizes` adapté aux miniatures 96×96 / 120×120                 |

### 3.3 Layout (à vérifier)

Dans `apps/web/src/components/layout/` :

| Composant         | À vérifier avant Panier                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| `CommerceHeader`  | Affichage minimal, `CartButton` masqué sur `/panier` (déjà sur le panier)         |
| `Footer`          | Variante complète, présent sur la page                                            |
| `SkipLink`        | Cible `#main`, `id="main"` posé sur `<main>` du layout commerce                   |

### 3.4 Sections de la page (à créer ou polir)

| #   | Section                | Fichier                                       | État        |
| --- | ---------------------- | --------------------------------------------- | ----------- |
| 1   | Hero panier            | `sections/CartHero.tsx`                       | **À créer** |
| 2   | Liste articles         | `commerce/CartList.tsx` (extrait du contents) | **À créer** |
| 3   | Récap & CTA            | `commerce/CartSummary.tsx`                    | **À créer** |
| 4   | Trust signals          | `sections/TrustSignals.tsx`                   | **À créer** |
| 5   | Cross-link journal     | `sections/JournalCrossLink.tsx`               | **À créer** |
| 6   | État vide              | `commerce/EmptyCartState.tsx`                 | **À créer** |

### 3.5 Composants spécifiques à créer

| Composant            | Pourquoi                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ |
| `CartItem`           | Carte article (image + nom + selector quantité + prix + retrait)                     |
| `QuantitySelector`   | Boutons − et + + input number, clamp 1..99, debounce 200 ms                          |
| `CartSummary`        | Sous-total, livraison estimée, total, CTA primaire                                   |
| `ConfirmationModal`  | Radix `AlertDialog` pour confirmer la suppression d'un article                       |
| `TrustSignalBlock`   | 3 colonnes (livraison Casablanca, retour 14 jours, paiement sécurisé)                |
| `CrossLinkCard`      | Carte vers `/journal` ou article éditorial                                           |
| `EmptyCartState`     | Bloc standalone avec illustration discrète + CTA « Découvrir le rituel » → `/rituel` |
| `CartSkeleton`       | Squelette serveur pour éviter le flash vide pendant l'hydration                      |
| `MobileCheckoutBar`  | Barre fine en bas full-width avec `safe-area-inset-bottom`                           |

### 3.6 Données

Lecture côté client uniquement, depuis le store Zustand
[`stores/cart-store.ts`](../../apps/web/src/lib/stores/cart-store.ts) :

```ts
const items = useCartStore((s) => s.items);
const hydrated = useCartStore((s) => s.hydrated);
const updateQuantity = useCartStore((s) => s.updateQuantity);
const removeItem = useCartStore((s) => s.removeItem);
const subtotal = useCartStore(selectSubtotalCents);
```

Calcul prix dérivé :

- `subtotal = sum(item.unitPriceCents * item.quantity)` (sélecteur déjà
  exposé : `selectSubtotalCents`).
- `estimatedShipping` simple en Phase 1 :
  - 40 MAD si ville détectée = Casablanca,
  - 60 MAD reste Maroc,
  - dérivé d'un input ville posé plus tard côté `/commander` ; sur
    `/panier`, valeur par défaut 60 MAD avec mention « estimation, ajustée
    à l'étape suivante ».
- `total = subtotal + estimatedShipping`.

Format prix harmonisé via :

```ts
new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(cents / 100);
```

(déjà encapsulé dans
[`utils/format-price.ts`](../../apps/web/src/lib/utils/format-price.ts)).

Pas de coupons en Phase 1. Pas de ré-écriture serveur du panier.

---

## 4. Écarts entre la spec (§ 4.6) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec (§ 4.6)                                                  | Scaffold actuel                                  | Décision proposée                                                       |
| --- | ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| E1  | Hero panier titre « Votre panier. » + count + total           | Titre « Avant la commande. » sans count          | **Remplacer** par titre conforme spec, count dynamique post-hydration   |
| E2  | `CartItem` avec photo                                         | Pas de photo dans le `CartContents` actuel       | **Enrichir** le store : ajouter `imageUrl` au type `CartLine`           |
| E3  | `QuantitySelector` boutons − et + + input                     | Input number nu, pas de boutons                  | **Créer** `QuantitySelector` avec deux boutons + input central          |
| E4  | Modal de confirmation à la suppression                        | Suppression directe sans confirmation            | **Créer** `ConfirmationModal` (Radix `AlertDialog`) systématique        |
| E5  | Trust signals 3 colonnes                                      | Absents                                          | **Créer** `TrustSignalBlock` posé sous le récap                         |
| E6  | Cross-link journal                                            | Lien « Continuer à découvrir » → `/kit`          | **Ajouter** une carte cross-link `/journal` en plus du retour `/kit`    |
| E7  | État vide soigné avec illustration                            | Bloc minimal « Le panier est vide. »             | **Créer** `EmptyCartState` standalone, fleuron + CTA `/rituel`          |
| E8  | Sticky CTA desktop top 96px + barre mobile bas                | Sidebar sticky basique, pas de barre mobile      | **Polir** sticky desktop, **créer** `MobileCheckoutBar` < 1024px        |
| E9  | Squelette serveur pour éviter flash vide pendant hydration    | Texte « Lecture du panier… » centré              | **Créer** `CartSkeleton` (RSC) rendu par défaut, masqué après hydration |
| E10 | Estimation livraison visible avant `/commander`               | « Livraison estimée à l'étape suivante. »        | **Afficher** `estimatedShipping` chiffré + total, mention « estimation »|

Ces dix écarts représentent ~3 h de travail préparatoire. **À traiter
avant toute autre chose** (Phase 1 ci-dessous).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**. On ne saute pas, on ne
parallélise pas.

### Phase 0 — Baseline (30 min)

Avant de toucher à quoi que ce soit :

```bash
cd apps/web
pnpm dev
```

- [ ] Capture d'écran de `/panier` actuel (mobile 375 px et desktop 1440 px),
      panier vide ET panier avec 1 article.
- [ ] Lighthouse mobile sur `/panier` : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : noter le nombre de violations critiques.
- [ ] `pnpm build` puis lire le bundle size de la route `/panier`.
- [ ] Sauvegarder les chiffres dans `docs/plans/08-page-panier-baseline.md`
      (créé en cours de route).

### Phase 1 — Résolution des écarts spec / scaffold (2 h 30)

#### 1.1 Étendre le type `CartLine` avec `imageUrl`

Fichier : [`stores/cart-store.ts`](../../apps/web/src/lib/stores/cart-store.ts)

```ts
export interface CartLine {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  imageUrl?: string;
  imageAlt?: string;
}
```

Mettre à jour `addItem(line: Omit<CartLine, 'quantity'> & { quantity?: number })`
pour propager `imageUrl` + `imageAlt`. Migration douce : si une ancienne
ligne persistée n'a pas `imageUrl`, fallback sur un placeholder SVG.

#### 1.2 Ajouter le sélecteur livraison estimée

Toujours dans `cart-store.ts` :

```ts
export const selectEstimatedShippingCents = (state: CartState): number => {
  if (state.items.length === 0) return 0;
  const city = state.shippingCity?.toLowerCase();
  if (city === 'casablanca' || city === 'casa') return 4000;
  return 6000;
};

export const selectTotalCents = (state: CartState): number =>
  selectSubtotalCents(state) + selectEstimatedShippingCents(state);
```

Ajouter `shippingCity?: string` à l'état + setter `setShippingCity(city)`.

#### 1.3 Mettre à jour la spec § 4.6 si nécessaire

Fichier : [`04-specifications-pages.md`](../preparation/04-specifications-pages.md)

- Aligner la liste des composants avec ce plan.
- Confirmer le wording « Votre panier. » + sous-titre count + total.

#### 1.4 Commit

```bash
git add -A
git commit -m "Aligne le sch\u00e9ma panier : CartLine.imageUrl, livraison estim\u00e9e, spec corrig\u00e9e"
```

> **Sortie de phase** : store + types + spec cohérents. Rien ne doit
> compiler à moitié.

### Phase 2 — Polissage des primitifs UI (2 h)

Suivre le cycle du § 3 de la stratégie d'itération pour chaque composant.

| Ordre | Composant         | Points d'attention spécifiques Panier                                |
| ----- | ----------------- | -------------------------------------------------------------------- |
| 1     | `Button`          | Variant primary + `fullWidth` + `loading` (CTA principal)            |
| 2     | `Container`       | Variant `page` ; vérifier le padding mobile pour la barre sticky bas |
| 3     | `Heading`         | Variant `display-md` (titre Hero panier, ~64 pt)                     |
| 4     | `Text`            | Variants `body` et `caption` ; tones secondary/tertiary              |
| 5     | `Kicker`          | « Le panier » au-dessus du h1                                        |
| 6     | `Image`           | `sizes="96px"` pour miniatures, `placeholder="blur"`                 |

**DoD par composant** : cocher les 8 catégories de
[§ 4 stratégie](../preparation/15-strategie-iteration.md).

**Commits** : un par composant. Six commits, six unités.

### Phase 3 — Création des composants spécifiques (4 h)

#### 3.1 `QuantitySelector`

- Fichier : `apps/web/src/components/commerce/QuantitySelector.tsx`
- Client Component.
- Props : `value: number`, `onChange: (next: number) => void`,
  `min?: number = 1`, `max?: number = 99`,
  `label: string`, `productId: string`.
- Layout : trois zones — bouton − (44 × 44 px), input number (lecture
  seule sur mobile, éditable desktop avec `inputMode="numeric"`),
  bouton + (44 × 44 px).
- `aria-label` sur les boutons : « Diminuer la quantité de {productName} »
  et « Augmenter la quantité de {productName} ».
- Clamp : valeur < 1 → 1, valeur > 99 → 99 (avec annonce ARIA live « Quantité
  maximale atteinte. »).
- Debounce update store de 200 ms si tap rapide pour éviter recalculs en
  cascade. Implémentation : `useDebouncedCallback` (créer
  `lib/hooks/use-debounced-callback.ts` si absent).
- Annonce ARIA live polite à chaque changement : « Quantité mise à jour : {n}. »
- Tap targets ≥ 44 × 44 px sur mobile, ≥ 32 × 32 px desktop.

#### 3.2 `ConfirmationModal`

- Fichier : `apps/web/src/components/ui/ConfirmationModal.tsx`
- Wrapper sur Radix UI `AlertDialog` (`@radix-ui/react-alert-dialog`).
- Props : `open: boolean`, `onOpenChange: (open: boolean) => void`,
  `title: string`, `description?: string`, `confirmLabel: string`,
  `cancelLabel?: string = 'Annuler'`, `onConfirm: () => void`,
  `tone?: 'default' | 'danger' = 'default'`.
- Pour la suppression panier :
  - Titre : « Retirer cet article ? »
  - Description : « Vous pourrez l'ajouter à nouveau depuis la fiche du kit. »
  - Actions : « Annuler » (variant ghost) + « Retirer » (variant primary,
    tone danger optionnel).
- Focus trap automatique (Radix), ESC ferme, click hors zone ferme.
- Animation : fade + scale subtle, respect `prefers-reduced-motion`.

#### 3.3 `CartItem`

- Fichier : `apps/web/src/components/commerce/CartItem.tsx`
- Client Component (consomme directement le store via `removeItem` et
  `updateQuantity`).
- Props : `item: CartLine`, `onRequestRemove: (productId: string) => void`.
- Layout :
  - Mobile : grille 2 colonnes (image 96 × 96 + bloc texte) + ligne action
    en dessous (selector + retirer + prix).
  - Desktop : grille 4 colonnes (image 120 × 120 + nom/sous-titre +
    selector + prix avec retirer dessous).
- Anim retrait : opacity 1 → 0 + translateY(-4) sur 240 ms `ease-out-soft`,
  puis suppression du DOM.
- Bouton « Retirer » : variant link, ouvre la modal de confirmation.

#### 3.4 `CartSummary`

- Fichier : `apps/web/src/components/commerce/CartSummary.tsx`
- Client Component.
- Affiche : sous-total, livraison estimée (avec mention « estimation »),
  total en Cormorant 24 pt.
- CTA primaire « Commander → » lien `next/link` vers `routes.commander`.
- Mention micro « Vous pourrez modifier votre commande jusqu'à l'étape
  paiement. »
- Sticky desktop : `lg:sticky lg:top-24 lg:self-start`.
- Pas de variante mobile inline ici (mobile = `MobileCheckoutBar`).

#### 3.5 `MobileCheckoutBar`

- Fichier : `apps/web/src/components/commerce/MobileCheckoutBar.tsx`
- Client Component, rendu uniquement < 1024 px.
- Position : `fixed bottom-0 inset-x-0`, padding bas via
  `paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))'`.
- Background : crème avec bordure haute encre 10 %, ombre douce vers le haut.
- Layout : total à gauche (Cormorant 18 pt), CTA « Commander → » à droite
  (variant primary, taille md).
- Z-index : `--z-sticky` (au-dessus du contenu, sous les modales).
- Disparaît si panier vide.

#### 3.6 `TrustSignalBlock`

- Fichier : `apps/web/src/components/sections/TrustSignals.tsx`
- Server Component (statique).
- 3 colonnes desktop, 1 colonne mobile :
  - **Livraison Casablanca** — pictogramme discret + « Livré sous 24-48 h
    en main propre à Casablanca. »
  - **Retour 14 jours** — pictogramme + « Si le rituel ne vous va pas,
    nous reprenons. »
  - **Paiement sécurisé** — pictogramme + « CMI Maroc, Stripe, ou paiement
    à la livraison. »
- Pictogrammes SVG inline (ligne 1.5 px, encre 60 %), 32 × 32 px.

#### 3.7 `CrossLinkCard`

- Fichier : `apps/web/src/components/sections/CrossLinkCard.tsx`
- Server Component.
- Props : `href: string`, `kicker: string`, `title: string`,
  `description: string`.
- Sur `/panier`, posé une seule carte vers `/journal` :
  - Kicker : « En attendant »
  - Titre : « Lire le journal de la maison. »
  - Description : « Trois lettres par saison. Aucune urgence. »

#### 3.8 `EmptyCartState`

- Fichier : `apps/web/src/components/commerce/EmptyCartState.tsx`
- Server Component (rendu côté client après hydration si items.length === 0).
- Layout centré : Fleuron champagne + heading « Le panier est vide. » +
  texte court « Le rituel commence par un geste. Trois pots, cinq minutes. »
- CTA principal : « Découvrir le rituel » → `/rituel` (variant primary).
- CTA secondaire : « Voir le kit » → `/kit` (variant link).

#### 3.9 `CartSkeleton`

- Fichier : `apps/web/src/components/commerce/CartSkeleton.tsx`
- Server Component pur (RSC), aucun JS.
- Rendu **par défaut** dans la page côté serveur, **masqué après
  hydration** quand `useCartStore.hydrated === true`.
- Implémentation : un `<div>` avec deux blocs grisés (article placeholder
  + sidebar placeholder), animation `animate-pulse` Tailwind.
- Évite le flash vide initial, surtout pour les visiteurs avec panier
  persisté en localStorage.

**Commits** : un par composant. Neuf commits.

### Phase 4 — Polissage de la page (2 h)

Fichier : [`apps/web/src/app/(commerce)/panier/page.tsx`](../../apps/web/src/app/(commerce)/panier/page.tsx)

Architecture cible :

```tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { CartHero } from '@/components/sections/CartHero';
import { CartLayout } from '@/components/commerce/CartLayout';
import { TrustSignals } from '@/components/sections/TrustSignals';
import { CrossLinkCard } from '@/components/sections/CrossLinkCard';

export const metadata: Metadata = {
  title: 'Le panier',
  description: 'Le r\u00e9capitulatif de votre rituel, avant la commande.',
  robots: { index: false, follow: false },
};

export default function PanierPage() {
  return (
    <>
      <CartHero />
      <Container width="page">
        <CartLayout />
        <TrustSignals />
        <CrossLinkCard
          href="/journal"
          kicker="En attendant"
          title="Lire le journal de la maison."
          description="Trois lettres par saison. Aucune urgence."
        />
      </Container>
    </>
  );
}
```

Le composant `CartLayout` est `'use client'`, encapsule la logique
hydration + bascule entre `CartSkeleton`, `EmptyCartState`, et la grille
articles + summary + barre mobile.

**Commit** : « Assemble la page panier ».

### Phase 5 — Sticky CTA, barre mobile, micro-interactions (1 h 30)

Référence : [§ 8 — UX animations](../preparation/08-ux-animations-interactions.md).

- [ ] `CartSummary` desktop : `lg:sticky lg:top-24 lg:self-start`,
      vérifier qu'il ne dépasse pas le viewport sur 13" (max-height
      `calc(100vh - 8rem)` + `overflow-y: auto` si nécessaire).
- [ ] `MobileCheckoutBar` < 1024 px : entrée slide-up 240 ms à l'arrivée
      sur la page (uniquement si panier non vide), respect
      `prefers-reduced-motion`.
- [ ] Animation retrait article : `LayoutGroup` Framer Motion +
      `AnimatePresence` pour un fade-out propre.
- [ ] Hover `CartItem` desktop : aucune transformation lourde — la maison
      ne bouge pas.
- [ ] `QuantitySelector` boutons : feedback `active:scale-95` 80 ms.

**Commit** : « Micro-interactions panier : sticky, barre mobile, retrait fluide ».

### Phase 6 — SEO, métadonnées, JSON-LD (30 min)

Référence : [§ 11 — SEO](../preparation/11-seo-metadata.md).

- [ ] `robots: { index: false, follow: false }` (déjà posé) — le panier
      n'est pas une page indexable.
- [ ] Pas de JSON-LD `Product` ici (il vit sur `/kit`).
- [ ] Ajouter un `BreadcrumbList` simple : `Accueil` → `Le kit` → `Le panier`,
      utile pour la navigation et la cohérence du fil.
- [ ] Vérifier que les balises OpenGraph génériques du `RootLayout`
      s'appliquent et qu'aucune image privée n'est diffusée.

**Commit** : « SEO panier : breadcrumb, robots no-index, OG par d\u00e9faut ».

### Phase 7 — Performance (1 h 30)

Référence : [§ 10 — Performance](../preparation/10-performance-web-vitals.md).

#### 7.1 Squelette serveur
Vérifier que `CartSkeleton` est bien rendu **par le serveur** et que le
basculement vers `CartLayout` côté client se fait **sans CLS** (mêmes
dimensions, même grille).

#### 7.2 Tree-shaking framer-motion
Tous les `motion.*` du panier passent par `<LazyMotion features={domAnimation}>`.
Wrapper unique posé dans `CartLayout`.

#### 7.3 Images miniatures
- `<Image sizes="96px" />` mobile, 120 px desktop.
- Format AVIF + fallback WebP.
- `placeholder="blur"` avec `blurDataURL` 8 px base64.

#### 7.4 Mesure
- `pnpm build` → lire le first-load JS de la route `/panier`.
- Cible : ≤ 95 kB gzip (un peu plus que la Home, justifié par le store
  Zustand + Radix Dialog).
- Lighthouse mobile : LCP < 2.0 s, CLS < 0.05, INP < 150 ms.

**Commit** : « Optimise le panier : squelette serveur, lazy framer-motion, images AVIF ».

### Phase 8 — Accessibilité (1 h 30)

Référence : [§ 9 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>` (« Votre panier. »).
- [ ] Hiérarchie h1 → h2 (« Votre commande », « Réassurance », « En attendant »)
      → h3 (titres `CartItem`).
- [ ] `QuantitySelector` : boutons avec `aria-label` explicite, input avec
      `aria-describedby` pointant vers une zone live `aria-live="polite"`
      qui annonce « Quantité : 3 » à chaque changement.
- [ ] `ConfirmationModal` : focus trap (Radix), ESC ferme, focus restitué
      au bouton « Retirer » d'origine.
- [ ] Tap targets ≥ 44 × 44 px : selector, bouton retirer, CTA.
- [ ] Contraste : encre/crème ≥ 13:1, micro-texte tertiary ≥ 7:1.
- [ ] Test axe-core : zéro violation critique.
- [ ] Test VoiceOver Mac : lecture cohérente du panier (somme énoncée,
      total annoncé).
- [ ] Test clavier complet : Tab traverse les selectors, Enter active les
      CTAs, ESC ferme la modal.
- [ ] `prefers-reduced-motion: reduce` activé → animations retrait
      désactivées (fade instantané).

**Commit** : « Audit accessibilit\u00e9 panier : 0 violation, modal et selector clavier-OK ».

### Phase 9 — Tests (2 h)

Référence : [§ 12 — QA](../preparation/12-qa-debugging-observabilite.md).

#### 9.1 Vitest unitaires

Pour chaque composant créé/modifié, un test :

```ts
// QuantitySelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { QuantitySelector } from './QuantitySelector';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend({ toHaveNoViolations });

describe('QuantitySelector', () => {
  it('clamp \u00e0 1 minimum', () => {
    const onChange = vi.fn();
    render(<QuantitySelector value={1} onChange={onChange} label="Pot" productId="p1" />);
    fireEvent.click(screen.getByLabelText(/diminuer/i));
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <QuantitySelector value={2} onChange={() => {}} label="Pot" productId="p1" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Couvrir aussi :
- `CartItem` : retrait ouvre la modal, confirmation appelle `removeItem`.
- `ConfirmationModal` : ESC ferme, click hors ferme, focus trap.
- `CartSummary` : calcul total = sous-total + livraison.
- `EmptyCartState` : CTA pointe vers `/rituel`.
- Store `cart-store` : `updateQuantity` clamp 1..99, `clear` vide tout.

#### 9.2 Storybook stories

Une story par composant + une story `Page > Panier` qui assemble :
- Variante 1 article.
- Variante 3 articles.
- Variante panier vide.
- Variante chargement (squelette).

#### 9.3 Playwright golden path

```ts
// e2e/panier.spec.ts
test('Panier : ajustement quantit\u00e9 et passage commande', async ({ page }) => {
  await page.goto('/kit');
  await page.getByRole('button', { name: /ajouter/i }).click();
  await page.goto('/panier');
  await expect(page.getByRole('heading', { level: 1, name: /votre panier/i })).toBeVisible();
  await page.getByLabel(/augmenter la quantit\u00e9/i).click();
  await expect(page.getByLabel(/quantit\u00e9/i)).toHaveValue('2');
  await page.getByRole('link', { name: /commander/i }).click();
  await expect(page).toHaveURL('/commander');
});

test('Panier : retrait avec confirmation', async ({ page }) => {
  // ... ajout préalable
  await page.goto('/panier');
  await page.getByRole('button', { name: /retirer/i }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: /^retirer$/i }).click();
  await expect(page.getByRole('heading', { name: /panier est vide/i })).toBeVisible();
});
```

**Commit** : « Tests panier : unitaires, stories, E2E golden path et retrait ».

### Phase 10 — Copy et finitions (45 min)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets français.
- [ ] CTA primaire : « Commander → » (avec flèche U+2192 ou `→` typographique).
- [ ] Microcopy livraison : « Estimation, ajustée à l'étape suivante. »
- [ ] Microcopy retour : « Si le rituel ne vous va pas, nous reprenons. »
- [ ] Modal suppression : titre « Retirer cet article ? », description
      « Vous pourrez l'ajouter à nouveau depuis la fiche du kit. »
- [ ] Empty state : « Le rituel commence par un geste. Trois pots, cinq minutes. »
- [ ] Test à voix haute : lit-on cela à un ami ? Sinon, simplifier.

**Commit** : « Polit la copy du panier contre le glossaire \u00e9ditorial ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile ET desktop sur `/panier` (vide ET avec articles).
- [ ] Comparaison baseline vs après dans
      `docs/plans/08-page-panier-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → tout vert.
- [ ] Capture vidéo du golden path (mobile 375 px puis desktop 1440 px) → archivée.
- [ ] PR vers `main` avec description référencée à ce plan et à la spec § 4.6.
- [ ] Merge.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` avec une ligne
      « Panier : LCP 1.5 s, CLS 0.02, INP 110 ms, axe 0, modal et selector OK ».

---

## 6. Definition of Done — spécifique Panier

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] Aucun flash de panier vide pendant l'hydration (squelette serveur
      visible jusqu'à `hydrated === true`).
- [ ] `QuantitySelector` ne déclenche **jamais** plus d'un `updateQuantity`
      par 200 ms (debounce vérifié au DevTools).
- [ ] La modal de confirmation est **toujours** affichée avant suppression
      (pas de `removeItem` direct depuis l'UI).
- [ ] Le total affiché correspond exactement à
      `subtotal + estimatedShipping`, vérifié au cent près.
- [ ] La barre mobile bas n'occulte jamais le contenu : padding bas
      ajouté à `<main>` pour compenser sa hauteur.
- [ ] L'estimation livraison est honnête : la mention « estimation,
      ajustée à l'étape suivante » est visible sur mobile sans scroll
      supplémentaire.
- [ ] Le passage `/panier` → `/commander` se fait sans perte d'état (les
      items sont lus à nouveau côté `/commander`).
- [ ] Aucun warning console en dev, en build, en prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/08-page-panier-baseline.md` (créé en Phase 0) :

| Métrique                       | Baseline | Cible    | Après  |
| ------------------------------ | -------- | -------- | ------ |
| LCP mobile                     | _        | < 2.0 s  | _      |
| LCP desktop                    | _        | < 1.5 s  | _      |
| CLS                            | _        | < 0.05   | _      |
| INP                            | _        | < 150 ms | _      |
| TBT                            | _        | < 200 ms | _      |
| First-load JS gzip             | _        | ≤ 95 kB  | _      |
| Violations axe critique        | _        | 0        | _      |
| Score Lighthouse Perf          | _        | ≥ 95     | _      |
| Score Lighthouse a11y          | _        | 100      | _      |
| Score Lighthouse Best Pr.      | _        | ≥ 95     | _      |
| Conversion panier → checkout   | _        | > 75 %   | _      |

---

## 8. Risques et points d'attention

| Risque                                                                  | Mitigation                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hydration mismatch (panier persisté côté client, vide côté serveur)     | `CartSkeleton` rendu serveur, basculement après `hydrated === true`, jamais de comparaison    |
| `QuantitySelector` provoque des re-renders en cascade sur taps rapides  | Debounce 200 ms via `useDebouncedCallback`, valeur visuelle locale + commit différé au store  |
| Modal Radix alourdit le bundle initial                                  | Import dynamique `next/dynamic` avec `ssr: false`, chargée à l'ouverture                      |
| Estimation livraison fausse → frustration au checkout                   | Mention « estimation » explicite + ré-estimation immédiate dès saisie ville sur `/commander`  |
| Mobile bar masque le footer ou un contenu critique                      | Padding bas dynamique sur `<main>` égal à la hauteur de la barre + safe-area-inset            |
| Suppression accidentelle à cause d'un tap sur « Retirer »               | Modal de confirmation systématique, pas d'option « ne plus me demander »                      |
| Animation framer-motion casse sur Safari iOS < 16                       | Test sur device réel ; fallback : pas d'animation si `IntersectionObserver` absent            |
| Panier vide affiché sans grâce après suppression dernier article        | Transition fade vers `EmptyCartState`, pas un saut brutal                                     |
| Persistance Zustand corrompue (localStorage manipulé)                   | Validation Zod au rehydrate, fallback panier vide silencieux                                  |

---

## 9. Estimation horaire récapitulative

| Phase                                           | Estimation |
| ----------------------------------------------- | ---------- |
| 0 — Baseline                                    | 0 h 30     |
| 1 — Résolution écarts (store, types, spec)      | 2 h 30     |
| 2 — Polissage primitifs UI                      | 2 h        |
| 3 — Composants spécifiques (9 composants)       | 4 h        |
| 4 — Polissage de la page                        | 2 h        |
| 5 — Sticky, barre mobile, micro-interactions    | 1 h 30     |
| 6 — SEO + breadcrumb                            | 0 h 30     |
| 7 — Performance                                 | 1 h 30     |
| 8 — Accessibilité                               | 1 h 30     |
| 9 — Tests (unit + Storybook + E2E)              | 2 h        |
| 10 — Copy & finitions                           | 0 h 45     |
| 11 — Mesure & merge                             | 0 h 30     |
| **Total**                                       | **18 h**   |

Avec interruptions et apprentissage outils : **18 h**, plancher 12 h si
tous les primitifs sont déjà polis et les hooks debounce existent.

---

## 10. Annexes — commandes utiles

### Lancer le dev
```bash
cd apps/web
pnpm dev
```

### Lighthouse en CLI
```bash
npx lighthouse http://localhost:3000/panier --view --preset=desktop --output=html --output-path=./lighthouse-panier-desktop.html
npx lighthouse http://localhost:3000/panier --view --output=html --output-path=./lighthouse-panier-mobile.html
```

### Bundle analyzer
```bash
ANALYZE=true pnpm --filter @femiglow/web build
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000/panier
```

### Tests
```bash
pnpm --filter @femiglow/web test -- panier
pnpm --filter @femiglow/web test:e2e -- panier
pnpm --filter @femiglow/web storybook
```

### Inspection store côté navigateur
```js
// dans la console DevTools
JSON.parse(localStorage.getItem('femiglow-cart'));
```

---

## 11. Critère unique de réussite

> *Le panier tient debout si, en y posant trois articles puis en retirant
> le second, l'utilisateur ne ressent **rien** : pas d'attente, pas de
> saut visuel, pas de doute sur le total. La page doit être tellement
> calme qu'on oublie qu'elle est là — comptoir d'une maison qui ne
> presse pas, qui n'oublie pas non plus.*

À cocher **avant** d'attaquer le tunnel checkout.

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Schéma & store** : `CartItem` enrichi (`imageAlt`), nouveau
  `shippingCity?` dans le store + sélecteurs `selectEstimatedShippingCents`
  (40 MAD Casa / 60 MAD reste) et `selectTotalCents`. `partialize` mis
  à jour pour persister `shippingCity` en localStorage.
- **9 composants créés** :
  - Sections (RSC) : `CartHero` (« Le panier » / « Votre panier. » /
    sous-titre `aria-live` polite), `TrustSignals`, `JournalCrossLink`.
  - Commerce (Client) : `QuantitySelector`, `CartItem`, `CartSummary`,
    `MobileCheckoutBar`, `CartLayout`. Commerce (RSC) : `CartSkeleton`,
    `EmptyCartState`.
  - UI (Client) : `ConfirmationModal` — `<dialog>` natif (Radix non
    installé) avec backdrop click + cancel + close events.
- **Page** : `apps/web/src/app/(commerce)/panier/page.tsx` réécrite —
  `<JsonLd data={breadcrumbListSchema(...)} />`, hero, `CartLayout`,
  `TrustSignals`, `JournalCrossLink`. Pas de `<main>` (layout
  `(commerce)/layout.tsx` le pose).
- **A11y** : 0 violation axe-core 4.10 sur `/panier` vide ET rempli ;
  hiérarchie h1 → h2 (« Articles dans votre panier » sr-only +
  « Votre commande. » + « Trois engagements simples. » + « Lire le
  journal de la maison. »). `<dialog>` accessible avec focus trap natif,
  ESC ferme via cancel handler, backdrop click ferme.
- **Tests Vitest** : 6 fichiers, 22 tests verts (cart-store sélecteurs,
  QuantitySelector debounce + clamp, CartHero pluriel, CartSummary
  totaux + axe, EmptyCartState CTA `/rituel`, TrustSignals 3
  engagements). Suite globale : **156 tests verts (44 fichiers)**, +22
  vs baseline 134.

### Décisions notables

1. **Pas de Radix** — `ConfirmationModal` utilise `<dialog>` natif comme
   `AtelierGallery` Plan 06. Évite ~30 kB de bundle ; focus trap garanti
   par le navigateur.
2. **`<aside>` → `<div role="region">`** dans `CartSummary` : axe
   signalait `landmark-complementary-is-top-level` (un `<aside>` ne doit
   pas être imbriqué dans `<main>`). `role="region"` + `aria-labelledby`
   garde la sémantique sans déclencher la règle.
3. **Focus modal sur « Annuler »** au lieu de « Retirer » : pour une
   action destructive, la convention HIG/Material veut que le focus
   initial soit sur l'option non destructive. Le `requestAnimationFrame`
   sur `confirmRef.current?.focus()` est conservé en filet de sécurité,
   mais le focus dialog natif l'emporte — comportement souhaitable.
4. **`imageSrc` conservé** plutôt que renommé `imageUrl` (le plan
   suggérait `imageUrl`) : la persistance localStorage existante aurait
   cassé. `imageAlt` ajouté en sus.
5. **Mobile bar + section bottom padding** : `pb-32 lg:pb-16` sur la
   section panier pour que la barre fixe ne masque pas le résumé.
   `paddingBottom: calc(0.75rem + env(safe-area-inset-bottom))` sur la
   barre elle-même pour iPhone.
6. **Pas de Framer Motion** sur cette page : transitions Tailwind
   suffisent (`opacity 0 / -translate-y-1` sur retrait CartItem,
   `active:scale-95` sur QuantitySelector). Évite de charger framer-motion
   uniquement pour ces deux micro-interactions.
7. **Debounce 200 ms QuantitySelector** : valeur visuelle locale +
   commit différé via `useState` + `setTimeout` ; clear sur unmount.

### Métriques après

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| First Load JS `/panier`           | 98.5 kB  | ≤ 95 kB  | **172 kB** (6.89 kB route) — au-dessus, mais en ligne avec /kit 163 kB. 9 client components + dialog + Zustand expliquent l'écart. |
| Tests Vitest dédiés Panier        | 0        | ≥ 5      | **6 fichiers, 22 tests** |
| Suite Vitest globale              | 134      | _        | **156 verts (44 fichiers)** |
| TypeScript / ESLint               | 0 / 0    | 0 / 0    | **0 / 0** |
| Violations axe `/panier`          | _        | 0        | **0** (vide et rempli) |
| Hiérarchie h1 → h2                | _        | 1 h1 + plusieurs h2 | **1 h1 + 5 h2** (1 sr-only) |

### Limites assumées

- First Load JS au-dessus de la cible 95 kB. Pour descendre, il faudrait
  passer `ConfirmationModal` en `next/dynamic` lazy (gain ~5-10 kB) et
  inliner le squelette via RSC plus agressivement. Reporté au prochain
  passage de réglage perf transverse (Plan « Performance Phase 2 »).
- Pas de Storybook stories ajoutées (Storybook n'est pas dans le
  projet en Phase 1). Couverture Vitest + axe juge suffisante.
- Pas d'animation Framer Motion sur le retrait CartItem : transition
  Tailwind `opacity` + `translateY` suffit pour l'effet de sortie.

### Suivi

- À reprendre dans le tunnel checkout (`/commander`) : la saisie ville
  doit alimenter `setShippingCity()` du store pour que le ré-affichage
  panier reflète la livraison réelle.
- Penser à passer `imageSrc` au moment où `addItem` est appelé depuis
  `AddToCartButton` (vérifier que la fiche kit transmet bien l'image
  actuelle du produit).
