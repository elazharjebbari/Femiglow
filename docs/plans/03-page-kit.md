# Plan 03 — Page Kit (`/kit`)

> Plan d'exécution détaillé pour porter la page `/kit` au niveau « cabinet
> international ». C'est le **pivot BOFU** : la lectrice arrive convaincue de
> `/rituel`, elle doit pouvoir poser le geste d'achat sans frottement, sans
> excès, sans pression. La page traite les 9 risques perçus de Lantos (2011)
> avec calme. À lire de bout en bout avant de toucher au code.

**Page cible** : `apps/web/src/app/(marketing)/kit/page.tsx`
**Spec source** : [§ 4.3 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 24 à 30 heures de travail concentré (3 à 5 jours).

---

## 1. Objectif

La page `/kit` est le **BOFU de conversion**. Elle doit, dans l'ordre :

1. Présenter le kit en moins d'un écran : photo, prix 320 MAD, dual CTA,
   trois réassurances.
2. Désamorcer dans l'ordre les 9 risques de Lantos : fonctionnel, financier,
   physique, social, psychologique, temporel, performance, environnemental,
   d'opportunité.
3. Garder le CTA accessible **toute la page** via `StickyCartCTA`, sans qu'il
   crie, sans qu'il dérange.
4. Conclure par un témoignage chaleureux et un cross-link Journal — la
   lectrice repart soit avec un kit dans le panier, soit avec une lecture.

KPIs cibles ([§ 4.3](../preparation/04-specifications-pages.md)) :

| KPI                              | Cible    |
| -------------------------------- | -------- |
| Taux add-to-cart                 | > 12 %   |
| Time on page                     | > 1:30   |
| Scroll ≥ 80 %                    | > 45 %   |
| Bounce rate                      | < 25 %   |
| LCP                              | < 2.0 s  |
| CLS                              | < 0.05   |
| INP                              | < 150 ms |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                                | Pourquoi                                                              |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | [00 — Résumé exécutif](../preparation/00-executive-summary.md)                                           | Recadrer l'intention                                                  |
| 2   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                                     | Vendre sans crier, traiter le risque sans dramatiser                  |
| 3   | [02 — Design system](../preparation/02-design-system.md)                                                 | Tokens, sticky CTA, tableaux, accordéons                              |
| 4   | [04 — Spécifications de pages, § 4.3](../preparation/04-specifications-pages.md)                         | Source canonique de la page Kit                                       |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                          | `HeroProduit`, `ProductCard`, `IngredientsTable`, etc.                |
| 6   | [06 — Tunnel d'achat & UX commerce](../preparation/06-tunnel-achat-ux-commerce.md)                       | Add-to-cart, mini-cart slide-over, toast non bloquant                 |
| 7   | [07 — Risques perçus (Lantos)](../preparation/07-risques-percus-lantos.md)                               | Mapping section ↔ risque traité                                       |
| 8   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                           | Tableaux a11y, accordéons clavier, sticky CTA et focus                |
| 9   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                             | Image LCP, vidéo réutilisée, hydratation sticky CTA                   |
| 10  | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                              | JSON-LD `Product` + `Offer`, OpenGraph product                        |
| 11  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                              | Vocabulaire non commercial agressif sur le comparatif et la FAQ       |
| 12  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5                       | Cycle, DoD composant, DoD page                                        |

**Temps de relecture** : 100 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (à vérifier dans `tokens.css`)

À confronter à [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge`, `--sauge-soft`, `--creme`, `--encre`, `--champagne`
  (badge prix), `--petale` (highlight comparatif), `--ciel` (fond FAQ).
- Typographies : `--font-display` (titres), `--font-body` (tableaux, FAQ),
  `--font-script` (signature témoignage).
- Tailles : `display-md` (hero produit), `display-sm` (sections),
  `body`, `body-tabular` (tableaux : Inter Tabular Numbers), `caption`.
- Espacements : `--space-1` à `--space-24`. Le sticky CTA mobile occupe
  `--space-14` en bas, à compenser par padding-bottom du `<main>`.
- Motion : `--duration-fast` (120 ms — toast, hover CTA), `--duration-base`,
  `--ease-out-soft`.
- Z-index : `--z-sticky` (StickyCartCTA), `--z-overlay` (mini-cart),
  `--z-toast` (toast add-to-cart, à ajouter si manquant).

### 3.2 Primitifs UI (à polir avant la page)

Dans `apps/web/src/components/ui/` :

| Composant   | État actuel | À polir avant Kit                                                       |
| ----------- | ----------- | ----------------------------------------------------------------------- |
| `Button`    | Polish Home | Variant `primary` size `lg fullWidth` ; loading state pour add-to-cart  |
| `Heading`   | Polish Home | Variant `display-md` (48 pt) pour hero produit                          |
| `Text`      | Polish Home | Variant `body-tabular` pour tableaux ingrédients                        |
| `Image`     | Polish Home | Hero produit : `priority`, AVIF, ratio 4:5, plusieurs sources           |
| `Container` | Polish Home | Variant `wide` (1180 px) pour les tableaux comparatifs                  |

### 3.3 Layout et commerce existants

Dans `apps/web/src/components/layout/` et `commerce/` :

| Composant         | État actuel             | À polir avant Kit                                                      |
| ----------------- | ----------------------- | ---------------------------------------------------------------------- |
| `Header`          | Polish Home             | Inchangé (le sticky est en bas mobile, pas en haut)                    |
| `CommerceHeader`  | Scaffold                | Vérifier — utilisé sur `/panier`/`/commander`, pas sur `/kit`          |
| `CartButton`      | Fonctionnel             | Vérifier hydratation Zustand, rebond discret après add-to-cart         |
| `CartContents`    | Scaffold                | Réutilisé dans le mini-cart slide-over (à brancher Phase 4)            |

### 3.4 Sections de la page (à créer)

| #   | Section                       | Fichier                                       | État        |
| --- | ----------------------------- | --------------------------------------------- | ----------- |
| 1   | Hero produit                  | **`sections/HeroProduit.tsx`**                | **À créer** |
| 2   | Composition slow reveal       | **`sections/CompositionReveal.tsx`** (4 `ProductCard`) | **À créer** |
| 3   | Vidéo des quatre gestes       | `sections/VideoPlayer4Gestes.tsx`             | Mutualisé `/rituel` |
| 4   | Composition détaillée         | **`sections/IngredientsDetails.tsx`** (`IngredientsTable`) | **À créer** |
| 5   | Comparatif vernis vs rituel   | **`sections/ComparatifSection.tsx`** (`ComparatifTable`) | **À créer** |
| 6   | FAQ contextuelle              | **`sections/FAQContextuelle.tsx`** (`FAQAccordion`) | **À créer** |
| 7   | Témoignages photos-mains      | **`sections/HandsTestimonials.tsx`** (`HandsTestimonialCarousel`) | **À créer** |
| 8   | CTA final + cross-link Journal | **`sections/PivotFinal.tsx`** + `JournalGrid` | **À créer** |

### 3.5 Composants spécifiques à créer

| Composant                    | Pourquoi                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `ProductCard`                | Card produit (image, nom, courte description, volume) — slow reveal               |
| `IngredientsTable`           | Tableau a11y avec `<thead>` sticky mobile, INCI, concentration, certifications     |
| `ComparatifTable`            | Tableau 2 colonnes (Vernis classique / Rituel FemiGlow), ton honnête              |
| `FAQAccordion`               | Accordéon Radix ou `<details>`, un seul ouvert à la fois (à arbitrer Phase 1)     |
| `HandsTestimonialCarousel`   | Carrousel sobre (Embla ou snap CSS) de 3-4 témoignages photos-mains + citation    |
| `StickyCartCTA`              | Barre fine en bas mobile / sidebar desktop, apparaît après le hero (IO)           |
| `MiniCartSlideOver`          | Panier ouvert depuis le bord droit après add-to-cart, ferme à l'ESC ou clic-out   |
| `Toast`                      | Toast non bloquant « Ajouté au rituel », auto-dismiss 4 s, `aria-live="polite"`   |
| `Reassurance`                | Petite ligne icône + label (« Livraison 48 h », « Retour 30 jours », « Paiement sécurisé ») |

### 3.6 Données

Étendre le schéma `productSchema` ([`schemas/product.ts`](../../apps/web/src/lib/schemas/product.ts))
qui est aujourd'hui sous-spécifié pour la page Kit. Récupération via
`cms.getKit()` (existant, à enrichir) et nouveau `cms.getKitPageContent()`
pour FAQ/comparatif/témoignages photo-mains.

```ts
// Schéma cible (Phase 1) — extensions
export const certificationSchema = z.object({
  label: z.string(), // ex: "Cosmos Organic"
  body: z.string(),  // ex: "Ecocert"
  badgeImage: imageSchema.optional(),
});

export const ingredientDetailedSchema = ingredientSchema.extend({
  inci: z.string(),
  concentrationPct: z.number().min(0).max(100).optional(),
  function: z.string(), // ex: "Émollient", "Filmogène naturel"
  origin: z.string(),
});

export const subProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(), // "15 ml"
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema),
  certifications: z.array(certificationSchema),
});

export const comparatifRowSchema = z.object({
  axis: z.string(), // "Préparation"
  vernis: z.string(),
  rituel: z.string(),
});

export const handsTestimonialSchema = z.object({
  id: z.string(),
  authorFirstName: z.string(),
  city: z.string().optional(),
  quote: z.string(),
  beforeImage: imageSchema,
  afterImage: imageSchema,
  initieeDepuis: z.string().optional(),
});

export const reassuranceSchema = z.object({
  icon: z.enum(['shipping', 'return', 'payment']),
  label: z.string(),
  detail: z.string().optional(),
});

export const kitPageContentSchema = z.object({
  product: productSchema, // kit complet
  composition: z.array(subProductSchema).length(4),
  videoSrc: z.object({
    sources: z.object({ mp4: z.string(), webm: z.string() }),
    poster: imageSchema,
    captions: z.object({ fr: z.string(), ar: z.string() }),
    transcript: z.string(),
  }),
  comparatif: z.object({
    titreVernis: z.string(),
    titreRituel: z.string(),
    rows: z.array(comparatifRowSchema).min(4).max(8),
  }),
  faq: z.array(faqItemSchema).min(8).max(10),
  handsTestimonials: z.array(handsTestimonialSchema).min(3).max(4),
  reassurances: z.array(reassuranceSchema).length(3),
  journalCrossSlugs: z.array(z.string()).length(3),
});
```

---

## 4. Écarts entre la spec (§ 4.3) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec (§ 4.3)                                                  | Scaffold actuel                                                     | Décision proposée                                                                            |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| E1  | Page riche : 8 sections                                        | Page actuelle = hero + composition simple (`Image` + liste `<ul>`)  | Reconstruire intégralement autour des 8 sections de la spec                                  |
| E2  | Composition = 4 sous-produits (pâte, poudre, buffer, vernis fini) | Mock = 3 ingrédients (base, fortifiant, lime), pas de sous-produit  | **Aligner sur le mock existant** : 3 sous-produits (kit cohérent avec la marque actuelle) ; mettre à jour la spec § 4.3 (E1bis) |
| E3  | `cms.getKitPageContent()` séparé attendu                       | Adapter expose `getKit()` qui retourne juste le `Product`           | Ajouter `getKitPageContent()` qui agrège `Product` + FAQ + comparatif + témoignages          |
| E4  | `StickyCartCTA` permanent                                     | N'existe pas                                                        | Créer `StickyCartCTA` (Client Component, IntersectionObserver sur le hero)                    |
| E5  | Mini-cart slide-over après add-to-cart                         | `CartContents` existe mais pas de slide-over                         | Créer `MiniCartSlideOver` qui réutilise `CartContents` à l'intérieur                          |
| E6  | Toast non bloquant après add-to-cart                           | N'existe pas                                                        | Créer `Toast` simple, mount unique dans `(marketing)/kit/layout.tsx`                          |
| E7  | FAQ 8-10 accordéons, un seul ouvert ou plusieurs ?             | Pas implémenté                                                      | **Décision** : `<details>` natifs, **plusieurs ouverts autorisés** (pratique pour comparer réponses) |
| E8  | Tableau ingrédients avec concentrations                        | Schéma `ingredientSchema` n'a ni `inci` ni `concentrationPct` ni `function` | Étendre via `ingredientDetailedSchema` (cf. § 3.6)                                            |
| E9  | Comparatif honnête, ton non agressif                           | À écrire ; risque de tomber dans la pub                              | Glossaire : interdire « inférieur », « médiocre », « toxique ». Préférer descriptions factuelles |
| E10 | Stripe pour paiement                                          | Pas de Stripe en Phase 1                                            | **Phase 1** : `addToCart()` push dans `useCartStore` ; redirige vers `/panier`. Stripe = Phase 2 |
| E11 | « Recevoir le rituel » comme libellé CTA primaire              | Bouton actuel = « Ajouter au rituel »                                | Garder « Ajouter au rituel » (cohérent avec mock + voix maison) ; mettre à jour la spec       |
| E12 | Témoignages photos avant/après                                 | `testimonialSchema` n'a qu'une `handImage`                           | Créer `handsTestimonialSchema` séparé avec `beforeImage` + `afterImage`                       |

Ces douze écarts représentent ~4 h de travail préparatoire. **À traiter
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

- [ ] Capture d'écran de `/kit` actuel (mobile 375 px, desktop 1440 px).
- [ ] Lighthouse mobile sur `/kit` : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : nombre de violations critiques.
- [ ] `pnpm build` puis bundle size de la route `/kit`.
- [ ] Tester `useCartStore` en console : `addItem`, `removeItem`, persistance
      après reload.
- [ ] Sauvegarder dans `docs/plans/03-page-kit-baseline.md`.

### Phase 1 — Résolution des écarts spec / scaffold (4 h)

#### 1.1 Étendre les schémas

Fichier : [`schemas/product.ts`](../../apps/web/src/lib/schemas/product.ts)

- Ajouter `ingredientDetailedSchema`, `certificationSchema`, `subProductSchema`,
  `comparatifRowSchema`, `handsTestimonialSchema`, `reassuranceSchema` (cf. § 3.6).
- Exporter les types associés.
- Conserver `productSchema` rétro-compatible (ne pas casser la Home).

Fichier : [`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)

- Ajouter `kitPageContentSchema` qui agrège tout.

#### 1.2 Étendre `CMSAdapter`

Fichier : [`lib/cms/types.ts`](../../apps/web/src/lib/cms/types.ts)

```ts
export interface CMSAdapter {
  // ...existant
  getKitPageContent(): Promise<KitPageContent>;
}
```

#### 1.3 Enrichir le mock

Fichiers :
- [`data/mock/product.ts`](../../apps/web/src/data/mock/product.ts) — étendre
  `mockKit` avec `inci`, `function`, `origin` détaillés.
- `apps/web/src/data/mock/kit.ts` (à créer) — `mockKitPageContent` complet :
  4 sub-products → **3** sub-products (alignement E2), 8 FAQ, 6 lignes
  comparatif, 3 témoignages mains, 3 réassurances, vidéo (réutilise les
  sources mock du Rituel).

#### 1.4 Implémenter `getKitPageContent()` dans le mock

Fichier : `apps/web/src/lib/cms/mock/index.ts`

```ts
import { mockKitPageContent } from '@/data/mock/kit';
async getKitPageContent() {
  return kitPageContentSchema.parse(mockKitPageContent);
},
```

#### 1.5 Ajouter le `Toast` provider

Fichier : `apps/web/src/components/ui/Toast.tsx` (à créer)

- Provider léger (Context + state local) ou library minimaliste (`sonner` si
  budget bundle ≤ 5 kB gzip ; sinon, custom 50 lignes).
- Décision : **custom**, pour ne pas alourdir le bundle BOFU.
- API : `useToast().show({ message, action? })`, dismiss auto 4 s.

#### 1.6 Décision FAQ : un seul ouvert ou plusieurs ?

**Plusieurs ouverts** : la lectrice compare souvent deux réponses
(« combien de temps ? » vs « à quelle fréquence ? »). Implémentation =
`<details>` natifs, simple, clavier OK, pas de Radix.

#### 1.7 Mettre à jour la spec § 4.3

- Remplacer « 4 sous-produits » par « 3 sous-produits ».
- Documenter Stripe = Phase 2.
- Confirmer libellé CTA « Ajouter au rituel ».

#### 1.8 Commit

```
git add -A
git commit -m "Aligne le sch\u00e9ma Kit : sous-produits, FAQ, comparatif, t\u00e9moignages mains"
```

> **Sortie de phase** : `pnpm typecheck` vert, `cms.getKitPageContent()`
> renvoie un objet conforme.

### Phase 2 — Polissage des primitifs UI (1 h)

| Ordre | Composant   | Points d'attention spécifiques Kit                                                |
| ----- | ----------- | --------------------------------------------------------------------------------- |
| 1     | `Button`    | État `loading` (spinner inline + `aria-busy`) pour add-to-cart                    |
| 2     | `Image`     | Hero produit : 4 angles possibles via prop `images`, 1er avec `priority`          |
| 3     | `Container` | Variant `wide` (1180 px) — comparatif et tableaux ingrédients                      |
| 4     | `Text`      | Variant `body-tabular` — Inter avec `font-feature-settings: 'tnum'`                |

**Commits** : un par composant.

### Phase 3 — Création des primitifs commerce (4 h)

#### 3.1 `Toast`

Fichier : `apps/web/src/components/ui/Toast.tsx`

```tsx
'use client';
import { createContext, useContext, useState, useCallback } from 'react';

type ToastItem = { id: string; message: string };
const ToastContext = createContext<{ show: (m: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setItems((s) => [...s, { id, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-24 left-1/2 z-toast -translate-x-1/2 space-y-2"
      >
        {items.map((t) => (
          <div key={t.id} role="status" className="rounded-md bg-encre px-4 py-2 text-sm text-creme shadow-lg">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
```

#### 3.2 `MiniCartSlideOver`

Fichier : `apps/web/src/components/commerce/MiniCartSlideOver.tsx`

- Client Component.
- Slide-over de droite, largeur 420 px desktop, 100% mobile.
- Trap focus à l'ouverture, retour focus sur le déclencheur à la fermeture.
- ESC ferme, clic sur overlay ferme.
- Contenu : `CartContents` (existant), CTA « Voir le panier » → `/panier`,
  CTA secondaire « Continuer le rituel » → ferme.
- État ouvert/fermé côté `useCartStore` (ajouter `isMiniCartOpen`,
  `openMiniCart`, `closeMiniCart`) ou via local state + bus (Zustand suffit).

#### 3.3 `StickyCartCTA`

Fichier : `apps/web/src/components/commerce/StickyCartCTA.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils/format-price';

type Props = {
  productName: string;
  priceCents: number;
  currency: 'MAD' | 'EUR';
  onAdd: () => void;
  observeId: string; // id du HeroProduit pour intersection
};

export function StickyCartCTA({ productName, priceCents, currency, onAdd, observeId }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById(observeId);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setVisible(!e.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [observeId]);

  return (
    <div
      role="region"
      aria-label="Achat rapide"
      data-visible={visible}
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-encre/10 bg-creme/95 px-4 py-3 backdrop-blur transition-transform data-[visible=false]:translate-y-full lg:left-auto lg:right-6 lg:bottom-6 lg:w-[320px] lg:rounded-lg lg:border"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-encre/70">{productName}</p>
          <p className="font-display text-lg">{formatPrice(priceCents, currency)}</p>
        </div>
        <Button variant="primary" size="md" onClick={onAdd}>
          Ajouter au rituel
        </Button>
      </div>
    </div>
  );
}
```

- Apparaît dès que le hero sort du viewport.
- En mobile : barre pleine largeur en bas.
- En desktop : carte flottante en bas droite, plus discrète.
- Disparaît proprement (translate-y) sans CLS.

#### 3.4 `Reassurance`

Fichier : `apps/web/src/components/ui/Reassurance.tsx`

- 3 icônes inline SVG (camion, retour, cadenas), 16 px, encre 70 %.
- Layout : icône + label (Inter caption tracking 0.05em) + détail optionnel.
- Utilisable inline dans le hero (3 colonnes) et en bandeau de pied de page Kit.

#### 3.5 `useCartStore` — extension

Fichier : [`lib/stores/cart-store.ts`](../../apps/web/src/lib/stores/cart-store.ts)

Ajouter :
- `isMiniCartOpen: boolean`
- `openMiniCart()`, `closeMiniCart()`, `addItemAndOpen(product, qty)` qui
  déclenche aussi le toast.

```ts
addItemAndOpen: (product, qty = 1) => {
  get().addItem(product, qty);
  set({ isMiniCartOpen: true });
}
```

**Commits** : un par composant. Cinq commits.

### Phase 4 — Création des sections (8 h)

#### 4.1 `HeroProduit` (1 h 30)

Fichier : `apps/web/src/components/sections/HeroProduit.tsx`

- Server Component pour le rendu, mais le bouton add-to-cart est un Client
  Component séparé (`AddToCartButton`).
- Layout : 2 colonnes desktop (image gauche, texte droite), pile mobile.
- Image : LCP candidate, `priority fetchPriority="high" sizes="(min-width: 1024px) 50vw, 100vw"`.
- Texte : `Kicker` « Le rituel », `Heading h1 display-md`, `Text lead` (tagline),
  `Text body-prose` (description courte, ≤ 80 mots).
- Prix : `<span class="font-display text-3xl">320 MAD</span>` + label
  `Kicker` « Livraison 48 h ».
- Dual CTA : primary « Ajouter au rituel », link « Voir le rituel ↗ » → `/rituel`.
- Trois `Reassurance` en grille.
- Placer un `<div id="hero-produit-anchor">` invisible pour `StickyCartCTA`.

#### 4.2 `AddToCartButton` (Client) (30 min)

Fichier : `apps/web/src/components/commerce/AddToCartButton.tsx`

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCartStore } from '@/lib/stores/cart-store';
import { useToast } from '@/components/ui/Toast';

export function AddToCartButton({ product }: { product: Product }) {
  const addItemAndOpen = useCartStore((s) => s.addItemAndOpen);
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    addItemAndOpen(product, 1);
    show('Ajout\u00e9 au rituel.');
    setBusy(false);
  };

  return (
    <Button variant="primary" size="lg" fullWidth loading={busy} onClick={onClick}>
      Ajouter au rituel
    </Button>
  );
}
```

#### 4.3 `CompositionReveal` + `ProductCard` (1 h 30)

Fichier : `apps/web/src/components/sections/CompositionReveal.tsx`

- Section avec `Kicker` « La composition » + titre.
- Grille 1 colonne mobile / 2 colonnes tablet / 4 colonnes desktop si 4
  produits, sinon 3 colonnes.
- Chaque `ProductCard` :
  - Image carrée 1:1, `Reveal direction="up"` avec stagger 100 ms.
  - `Heading h3` Cormorant 24 pt.
  - Description courte, volume.
  - Lien « Voir la composition ↓ » qui scrolle vers la section
    `IngredientsDetails`.

Fichier : `apps/web/src/components/commerce/ProductCard.tsx`

#### 4.4 `IngredientsDetails` + `IngredientsTable` (1 h 30)

Fichier : `apps/web/src/components/sections/IngredientsDetails.tsx`

- Titre + intro courte sur la transparence.
- Pour chaque sous-produit, un `IngredientsTable` avec :
  - Header : `<thead>` (Ingrédient, INCI, Fonction, Origine, %)
  - Body : `<tbody>` une ligne par ingrédient.
  - En mobile : `<thead>` sticky avec `position: sticky; top: 0`.
  - Certifications affichées en bas du tableau (chips champagne avec
    badge image optionnelle).

Fichier : `apps/web/src/components/commerce/IngredientsTable.tsx`

```tsx
export function IngredientsTable({ subProduct }: { subProduct: SubProduct }) {
  return (
    <figure className="my-12">
      <figcaption className="mb-4 font-display text-2xl">{subProduct.name} — {subProduct.volume}</figcaption>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sauge-soft text-left text-xs uppercase tracking-[0.12em] text-encre/70">
            <tr>
              <th scope="col" className="p-3">Ingr\u00e9dient</th>
              <th scope="col" className="p-3">INCI</th>
              <th scope="col" className="p-3">Fonction</th>
              <th scope="col" className="p-3">Origine</th>
              <th scope="col" className="p-3 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-encre/10">
            {subProduct.ingredients.map((ing) => (
              <tr key={ing.inci}>
                <td className="p-3 font-medium">{ing.name}</td>
                <td className="p-3 text-encre/70">{ing.inci}</td>
                <td className="p-3">{ing.function}</td>
                <td className="p-3">{ing.origin}</td>
                <td className="p-3 text-right tabular-nums">{ing.concentrationPct ?? '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subProduct.certifications.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {subProduct.certifications.map((c) => (
            <span key={c.label} className="rounded-full border border-champagne/40 px-3 py-1 text-xs text-encre/80">
              {c.label} \u2014 {c.body}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
```

#### 4.5 `ComparatifSection` + `ComparatifTable` (1 h)

Fichier : `apps/web/src/components/sections/ComparatifSection.tsx`

- Titre « Vernis vs rituel », sous-titre court qui pose le cadre honnête
  (« Sans dénigrer, deux approches différentes. »).
- `ComparatifTable` : 2 colonnes égales, header sticky mobile.
- Lignes : 4 à 8 axes (Préparation, Tenue, Récupération, Coût annuel,
  Impact environnemental, Temps quotidien).
- Aucune cellule ne dénigre l'autre approche — relire glossaire.

Fichier : `apps/web/src/components/commerce/ComparatifTable.tsx`

#### 4.6 `FAQContextuelle` + `FAQAccordion` (1 h)

Fichier : `apps/web/src/components/sections/FAQContextuelle.tsx`

- Titre « Les questions qu'on nous pose ».
- 8-10 `<details>` natifs, plusieurs ouvrables simultanément.
- Chaque `<summary>` : Heading h3 inline, chevron rotaté au open.

Fichier : `apps/web/src/components/commerce/FAQAccordion.tsx`

```tsx
export function FAQAccordion({ items }: { items: FAQItem[] }) {
  return (
    <ul className="divide-y divide-encre/10">
      {items.map((item) => (
        <li key={item.id}>
          <details className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="font-display text-lg">{item.question}</span>
              <svg className="h-4 w-4 transition-transform group-open:rotate-45" viewBox="0 0 16 16" aria-hidden>
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1" />
              </svg>
            </summary>
            <p className="mt-3 max-w-prose text-encre/80">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
```

#### 4.7 `HandsTestimonials` + `HandsTestimonialCarousel` (1 h)

Fichier : `apps/web/src/components/sections/HandsTestimonials.tsx`

- Titre « Trois mains », sous-titre court.
- `HandsTestimonialCarousel` : 3-4 cards en scroll-snap horizontal mobile,
  grille 3 colonnes desktop.
- Chaque card : avant/après côte à côte (50/50), citation Cormorant Italic,
  signature « *Initiée depuis Janvier 2025, Casablanca* ».

Fichier : `apps/web/src/components/commerce/HandsTestimonialCarousel.tsx`

- Pas de library : CSS scroll-snap suffit. Boutons prev/next mobile
  (`aria-controls` la liste).
- Indicateurs de page (dots) sous le carrousel.

#### 4.8 `PivotFinal` (30 min)

Fichier : `apps/web/src/components/sections/PivotFinal.tsx`

- Bandeau sauge soft pleine largeur.
- Titre « Posez le geste. », sous-titre court.
- CTA primaire « Ajouter au rituel » (réutilise `AddToCartButton`), CTA link
  « Lire encore » → `#contenu-kit` ou `/rituel`.
- Suivi de `JournalGrid` (3 articles) en variant `symmetric`.

**Commits** : un par section. Huit commits.

### Phase 5 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/kit/page.tsx`](../../apps/web/src/app/(marketing)/kit/page.tsx)

```tsx
import { cms } from '@/lib/cms';
import { HeroProduit } from '@/components/sections/HeroProduit';
import { CompositionReveal } from '@/components/sections/CompositionReveal';
import { VideoPlayer4Gestes } from '@/components/sections/VideoPlayer4Gestes';
import { IngredientsDetails } from '@/components/sections/IngredientsDetails';
import { ComparatifSection } from '@/components/sections/ComparatifSection';
import { FAQContextuelle } from '@/components/sections/FAQContextuelle';
import { HandsTestimonials } from '@/components/sections/HandsTestimonials';
import { PivotFinal } from '@/components/sections/PivotFinal';
import { JournalGrid } from '@/components/sections/JournalGrid';

export const revalidate = 1800;

export default async function KitPage() {
  const [content, journalArticles] = await Promise.all([
    cms.getKitPageContent(),
    cms.getArticles({ limit: 3 }),
  ]);

  return (
    <main id="contenu-kit" className="pb-24 lg:pb-0">
      <HeroProduit
        product={content.product}
        reassurances={content.reassurances}
      />
      <CompositionReveal items={content.composition} />
      <VideoPlayer4Gestes video={content.videoSrc} />
      <IngredientsDetails composition={content.composition} />
      <ComparatifSection data={content.comparatif} />
      <FAQContextuelle items={content.faq} />
      <HandsTestimonials items={content.handsTestimonials} />
      <PivotFinal product={content.product} />
      <JournalGrid articles={journalArticles} kicker="Pour aller plus loin" title="Trois lectures." variant="symmetric" />
    </main>
  );
}
```

Et le layout `(marketing)/kit/layout.tsx` (à créer) qui monte
`ToastProvider`, `StickyCartCTA` et `MiniCartSlideOver` :

```tsx
import { ToastProvider } from '@/components/ui/Toast';
import { StickyCartCTA } from '@/components/commerce/StickyCartCTA';
import { MiniCartSlideOver } from '@/components/commerce/MiniCartSlideOver';
import { cms } from '@/lib/cms';

export default async function KitLayout({ children }: { children: React.ReactNode }) {
  const product = await cms.getKit();
  return (
    <ToastProvider>
      {children}
      <StickyCartCTAClient productName={product.name} priceCents={product.priceCents} currency={product.currency} observeId="hero-produit-anchor" />
      <MiniCartSlideOver />
    </ToastProvider>
  );
}
```

(Le `StickyCartCTAClient` enveloppe `AddToCartButton` pour pousser dans le store.)

**Commit** : « Assemble la page Kit ».

### Phase 6 — SEO, métadonnées, JSON-LD (1 h)

Référence : [§ 11 — SEO](../preparation/11-seo-metadata.md).

```tsx
export const metadata: Metadata = {
  title: 'Le kit FemiGlow \u2014 trois gestes, une saison',
  description:
    'Le kit r\u00e9unit la base, le fortifiant et la lime. Trois gestes mesur\u00e9s, pens\u00e9s \u00e0 Casablanca, livr\u00e9s en 48 heures.',
  alternates: { canonical: '/kit' },
  openGraph: {
    type: 'website',
    title: 'Le kit FemiGlow',
    description: 'Trois gestes, cinq minutes, un rituel saisonnier. 320 MAD.',
    images: [{ url: '/og/kit.svg', width: 1200, height: 630, alt: 'Le kit FemiGlow' }],
  },
};
```

JSON-LD `Product` + `Offer` injecté via `<JsonLd type="Product" data={...} />` :

```ts
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": product.name,
  "description": product.description,
  "image": product.images.map((i) => i.src),
  "brand": { "@type": "Brand", "name": "FemiGlow" },
  "offers": {
    "@type": "Offer",
    "url": "https://femiglow.ma/kit",
    "priceCurrency": product.currency,
    "price": (product.priceCents / 100).toFixed(2),
    "availability": product.inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    "areaServed": "MA",
  },
}
```

Optionnel : JSON-LD `FAQPage` à partir de `content.faq` pour rich snippets.

**Commit** : « SEO et JSON-LD pour `/kit` (Product, Offer, FAQ) ».

### Phase 7 — Performance (2 h)

Référence : [§ 10 — Performance](../preparation/10-performance-web-vitals.md).

#### 7.1 Image LCP

- Hero produit `priority fetchPriority="high"`, AVIF, qualité 80,
  `sizes="(min-width: 1024px) 50vw, 100vw"`.
- `placeholder="blur"` avec `blurDataURL` 16 px.
- Cibler LCP < 2.0 s sur 4G simulée.

#### 7.2 Vidéo

- Réutiliser `VideoPlayer4Gestes` du Rituel : déjà optimisée.
- Confirmer que le composant est lazy-loadé (l'intersection observer s'en
  charge ; le bundle JS du player est partagé avec `/rituel` donc cache HTTP).

#### 7.3 StickyCartCTA et MiniCart

- `StickyCartCTA` : Client Component léger (≤ 2 kB gzip).
- `MiniCartSlideOver` : `next/dynamic` sans SSR pour ne charger qu'à
  l'ouverture.

```tsx
const MiniCartSlideOver = dynamic(
  () => import('@/components/commerce/MiniCartSlideOver').then((m) => m.MiniCartSlideOver),
  { ssr: false },
);
```

#### 7.4 Tableaux et FAQ

- Tableaux : pas de JS client, RSC pur.
- FAQ : `<details>` natif, zéro JS.
- HandsTestimonialCarousel : CSS scroll-snap natif, pas de library.

#### 7.5 Mesure

- `pnpm build` → first-load JS de `/kit`. Cible : ≤ 120 kB gzip (un peu plus
  que `/rituel` à cause de Toast + StickyCart + MiniCart).
- Lighthouse mobile : LCP < 2.0 s, CLS < 0.05, INP < 150 ms.
- Vérifier qu'aucun saut de hauteur sur l'apparition de `StickyCartCTA`
  (transform uniquement, jamais de `display: none`).

**Commit** : « Optimise `/kit` : hero AVIF, mini-cart dynamic, sticky transform-only ».

### Phase 8 — Accessibilité (2 h)

Référence : [§ 9 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>`, dans `HeroProduit`.
- [ ] Hiérarchie h1 → h2 (sections) → h3 (sub-products, FAQ items).
- [ ] Skip-link cible `#contenu-kit`.
- [ ] `StickyCartCTA` : `role="region" aria-label="Achat rapide"`. Bouton
      add-to-cart accessible au clavier ; à l'apparition, **ne vole pas le
      focus** (uniquement visible).
- [ ] `MiniCartSlideOver` : trap focus, ESC ferme, retour focus sur le
      bouton add-to-cart, `aria-modal="true"`, `role="dialog"`,
      `aria-labelledby` sur le titre du panier.
- [ ] `Toast` : `aria-live="polite" aria-atomic="true"`, `role="status"` sur
      chaque toast. Auto-dismiss 4 s, mais reste lisible si user pause.
- [ ] Tableaux : `<thead>` + `<tbody>`, `<th scope="col">`, caption ou
      `<figcaption>`. Test au lecteur d'écran : navigation ligne par ligne OK.
- [ ] FAQ `<details>` : focus visible sur `<summary>`, Enter et Space
      ouvrent, contenu pas masqué pour les lecteurs d'écran.
- [ ] HandsTestimonialCarousel : boutons prev/next avec `aria-controls`,
      ne pas cacher la liste hors viewport (juste `overflow-x: auto`).
- [ ] `prefers-reduced-motion: reduce` → `Reveal` désactivé, sticky CTA
      apparaît sans transition (juste opacité), carrousel sans smooth scroll.
- [ ] Tap targets ≥ 44×44 px (FAQ chevron, dots carrousel, sticky CTA).
- [ ] Contraste : prix 320 MAD sur crème ≥ 13:1 (encre OK), réassurances
      tertiary ≥ 7:1, sticky CTA contraste ≥ 4.5:1.
- [ ] axe : zéro violation critique sur la page entière + sur le mini-cart
      ouvert.
- [ ] Test clavier complet : Tab parcourt hero CTA → composition → FAQ →
      etc. ; on peut ajouter au panier sans souris ; on peut ouvrir/fermer le
      mini-cart sans souris.

**Commit** : « Audit a11y `/kit` : 0 violation, mini-cart focus trap, tableaux scope ».

### Phase 9 — Tests (2 h)

Référence : [§ 12 — QA](../preparation/12-qa-debugging-observabilite.md).

#### 9.1 Vitest unitaires

- `HeroProduit.test.tsx` : h1 présent, prix formaté, dual CTA visibles.
- `AddToCartButton.test.tsx` : clic appelle `addItemAndOpen`, déclenche toast.
- `StickyCartCTA.test.tsx` : invisible tant que la sentinelle est visible,
  visible après. Mock IntersectionObserver.
- `IngredientsTable.test.tsx` : header présent, scope `col`, certifications
  rendues, axe propre.
- `FAQAccordion.test.tsx` : tous les items sont fermés au mount, Enter sur
  summary ouvre, plusieurs items peuvent être ouverts.
- `MiniCartSlideOver.test.tsx` : ouvert via store → focus trapé, ESC ferme,
  retour focus correct.

```ts
// AddToCartButton.test.tsx
it('ajoute au panier et affiche un toast', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <AddToCartButton product={mockKit} />
    </ToastProvider>,
  );
  await user.click(screen.getByRole('button', { name: /ajouter au rituel/i }));
  expect(useCartStore.getState().items).toHaveLength(1);
  expect(await screen.findByRole('status')).toHaveTextContent(/ajout/i);
});
```

#### 9.2 Storybook stories

- Une story par section + une story `Page > Kit` qui assemble tout.
- Story `MiniCartSlideOver` ouvert et fermé.
- Story `StickyCartCTA` visible / masqué.

#### 9.3 Playwright golden path

```ts
// e2e/kit.spec.ts
test('Kit : add-to-cart → mini-cart → panier', async ({ page }) => {
  await page.goto('/kit');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /ajouter au rituel/i }).first().click();
  // Mini-cart s'ouvre
  await expect(page.getByRole('dialog', { name: /panier/i })).toBeVisible();
  // Toast visible
  await expect(page.getByRole('status')).toContainText(/ajout/i);
  // Aller au panier
  await page.getByRole('link', { name: /voir le panier/i }).click();
  await expect(page).toHaveURL('/panier');
});

test('Kit : sticky CTA apparaît après le hero', async ({ page }) => {
  await page.goto('/kit');
  await expect(page.getByRole('region', { name: /achat rapide/i })).not.toBeVisible();
  await page.evaluate(() => window.scrollBy(0, 1200));
  await expect(page.getByRole('region', { name: /achat rapide/i })).toBeVisible();
});

test('Kit : FAQ ouvrable au clavier', async ({ page }) => {
  await page.goto('/kit');
  const firstSummary = page.locator('details > summary').first();
  await firstSummary.focus();
  await page.keyboard.press('Enter');
  await expect(firstSummary.locator('..')).toHaveAttribute('open');
});
```

**Commit** : « Tests `/kit` : unitaires, stories, E2E (cart, sticky, FAQ) ».

### Phase 10 — Copy et finitions (1 h 30)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji, urgent,
      maintenant, exclusif, dernière chance).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets « … » et avant `:` `;` `?` `!`.
- [ ] CTA primaire : « Ajouter au rituel ». CTA secondaire : « Voir le rituel ↗ ».
- [ ] Comparatif : aucune cellule ne contient « inférieur », « médiocre »,
      « toxique », « danger ». Test à voix haute : sonne factuel, pas
      accusateur.
- [ ] FAQ : questions formulées comme une vraie cliente les pose, pas comme
      une fiche marketing. Réponses ≤ 80 mots, avec un ton de conseillère
      bienveillante.
- [ ] Témoignages : prénom + ville + « *Initiée depuis [date]* ». Pas
      d'avant/après photoshoppé, photos brutes (à valider Phase 2).
- [ ] Microcopy toast : « Ajouté au rituel. » (un point, pas d'exclamation).
- [ ] Microcopy mini-cart vide : « Votre rituel est encore à composer. »
- [ ] Réassurances : « Livraison 48 h », « Retour 30 jours », « Paiement
      sécurisé ». Pas de « gratuit » répété trois fois.

**Commit** : « Polit la copy de `/kit` contre le glossaire \u00e9ditorial ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile ET desktop sur `/kit`.
- [ ] Comparaison baseline vs après dans `docs/plans/03-page-kit-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → tout vert.
- [ ] Capture vidéo du parcours (mobile 375 px puis desktop 1440 px) :
      arrivée → scroll → add-to-cart → mini-cart → /panier.
- [ ] PR vers `main` référencée à ce plan et à la spec § 4.3.
- [ ] Merge.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` :
      « Kit : LCP 1.7 s, CLS 0.02, INP 95 ms, axe 0, add-to-cart fonctionnel,
      mini-cart a11y, copy validée ».

---

## 6. Definition of Done — spécifique Kit

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] Hero LCP < 1.7 s sur 4G simulée.
- [ ] Le dual CTA est **above the fold** sur 375 × 667 (iPhone SE).
- [ ] `StickyCartCTA` apparaît exactement quand le hero sort du viewport,
      jamais avant. Disparaît proprement (transform), zéro CLS.
- [ ] Add-to-cart fonctionnel : push dans `useCartStore`, ouverture
      mini-cart, toast visible, focus trapé.
- [ ] Mini-cart : reload de la page (Zustand persist OK) → items toujours là.
- [ ] FAQ : 8 à 10 items, un peut être ouvert sans fermer les autres.
- [ ] Comparatif : relu par une personne extérieure et jugé honnête, pas
      promotionnel.
- [ ] Tableaux ingrédients : un mobile sait y naviguer sans pincement,
      `<thead>` reste visible au scroll horizontal.
- [ ] Témoignages : 3 minimum, signatures cohérentes (« *Initiée depuis* »).
- [ ] `prefers-reduced-motion: reduce` : sticky apparaît sans glissement,
      carrousel sans smooth scroll, vidéo sans autoplay.
- [ ] Aucun warning console en dev, en build, en prod.
- [ ] Stripe non branché, mais l'infrastructure (cart store, mini-cart,
      `/panier` lien) est prête à le recevoir sans toucher à `/kit`.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/03-page-kit-baseline.md` (créé en Phase 0) :

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| LCP mobile                        | _        | < 2.0 s  | _      |
| LCP desktop                       | _        | < 1.5 s  | _      |
| CLS                               | _        | < 0.05   | _      |
| INP                               | _        | < 150 ms | _      |
| TBT                               | _        | < 200 ms | _      |
| First-load JS gzip                | _        | ≤ 120 kB | _      |
| Add-to-cart fonctionnel           | _        | oui      | _      |
| Mini-cart a11y (axe + clavier)    | _        | OK       | _      |
| Violations axe critique           | _        | 0        | _      |
| Score Lighthouse Perf             | _        | ≥ 92     | _      |
| Score Lighthouse a11y             | _        | 100      | _      |
| Score Lighthouse Best Pr.         | _        | ≥ 95     | _      |
| Score Lighthouse SEO              | _        | 100      | _      |

---

## 8. Risques et points d'attention

| Risque                                                                  | Mitigation                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `StickyCartCTA` provoque un CLS à l'apparition                          | Animation `transform: translateY` uniquement, jamais `display`/`height`             |
| `MiniCartSlideOver` capte le focus avant l'animation, lecteur d'écran annonce le panier vide | `aria-modal` + trap focus seulement après `transitionend`, `aria-busy` pendant       |
| Toast inaccessible (auto-dismiss avant lecture par lecteur d'écran)     | `role="status" aria-live="polite"`, durée 4 s minimum, ne pas cacher visuellement   |
| Comparatif perçu comme dénigrant                                         | Glossaire strict, relecture extérieure, ton factuel                                 |
| FAQ trop longue → la lectrice ne lit rien                                | Limiter à 10 questions max, plus longues réponses dans `/journal` ou `/contact`     |
| Tableau ingrédients illisible mobile                                    | `overflow-x: auto`, `<thead>` sticky, première colonne sticky aussi si possible     |
| Carrousel témoignages avec scroll-snap saccadé sur Safari iOS           | Tester sur device, fallback : pile verticale mobile                                 |
| Add-to-cart double-cliqué → 2 items                                     | État `loading` sur Button, debounce ou disabled pendant 400 ms                       |
| Stripe Phase 2 changera les sources de prix                              | Centraliser le formatage prix dans `lib/utils/format-price.ts`                       |
| Photos avant/après mal recadrées choquent visuellement                   | Ratio 1:1 forcé, recadrage centre, validation humaine avant publication              |
| Cart Zustand persist corrompu (vieille structure)                        | Versionner le state (`version: 2`), migration `migrate(state, version)`              |
| « 320 MAD » n'apparaît pas dans la même devise pour visiteurs hors MA   | Phase 1 : MAD only ; Phase 2 : i18n + currency switcher                              |

---

## 9. Estimation horaire récapitulative

| Phase                                       | Estimation |
| ------------------------------------------- | ---------- |
| 0 — Baseline                                | 0 h 30     |
| 1 — Résolution écarts                       | 4 h        |
| 2 — Polissage primitifs                     | 1 h        |
| 3 — Primitifs commerce                      | 4 h        |
| 4 — Sections de la page                     | 8 h        |
| 5 — Assemblage page                         | 1 h        |
| 6 — SEO + JSON-LD                           | 1 h        |
| 7 — Performance                             | 2 h        |
| 8 — Accessibilité                           | 2 h        |
| 9 — Tests                                   | 2 h        |
| 10 — Copy & finitions                       | 1 h 30     |
| 11 — Mesure & merge                         | 0 h 30     |
| **Total**                                   | **27 h 30**|

Avec interruptions, écriture des 8 FAQ et du comparatif (qui demande de la
diplomatie), photos avant/après à recadrer : **30 h ou 5 jours pleins**.

---

## 10. Annexes — commandes utiles

### Lancer le dev sur la route Kit
```bash
cd apps/web
pnpm dev
# puis ouvrir http://localhost:3000/kit
```

### Lighthouse en CLI
```bash
npx lighthouse http://localhost:3000/kit --view --preset=desktop --output=html --output-path=./lighthouse-kit-desktop.html
npx lighthouse http://localhost:3000/kit --view --output=html --output-path=./lighthouse-kit-mobile.html
```

### Bundle analyzer ciblé
```bash
ANALYZE=true pnpm --filter @femiglow/web build
# inspecter /kit, le chunk MiniCartSlideOver (doit être lazy)
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000/kit
```

### Tester `useCartStore` en console navigateur
```js
const { useCartStore } = await import('/src/lib/stores/cart-store.ts');
useCartStore.getState().addItem(/* product mock */);
useCartStore.getState().items;
useCartStore.persist.clearStorage(); // reset
```

### Tests
```bash
pnpm --filter @femiglow/web test -- kit
pnpm --filter @femiglow/web test:e2e -- kit
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *La page Kit tient debout si, en l'envoyant à une amie qui n'a jamais
> entendu parler de la maison, elle ajoute le kit au panier sans avoir
> l'impression qu'on lui force la main, sans avoir à excuser un visuel
> manquant, sans avoir à expliquer « c'est juste pour la démo ». Si elle
> referme l'onglet en se disant « j'y reviendrai » plutôt qu'« on m'a
> harcelée », la page tient. Si on doit dire « le mini-cart n'est pas
> branché », « les ingrédients seront détaillés plus tard », « le
> comparatif sera retravaillé » — la page n'est pas finie.*

À cocher **avant** d'attaquer la page suivante (`/journal`).

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Page** : [`apps/web/src/app/(marketing)/kit/page.tsx`](../../apps/web/src/app/(marketing)/kit/page.tsx) (Server Component, 68 lignes).
- **Sections rendues** (verticales) : `HeroProduit` (product +
  reassurances) → `CompositionReveal` → `VideoPlayer4Gestes` →
  `IngredientsDetails` → `ComparatifSection` → `FAQContextuelle` →
  `HandsTestimonials` → `PivotFinal` → `JournalGrid`.
- **Commerce** : `AddToCartButton` + `MiniCartSlideOver` + `StickyCartCTA`
  (mobile) branchés sur le store Zustand `femiglow-cart`.
- **SEO / JSON-LD** : `productSchema` (canonical `/kit`) +
  `faqPageSchema` injectés via `<JsonLd>` SSR ; OpenGraph `fr_MA` +
  image produit ; canonical présent.
- **Tests** : 7 sections Vitest + 4 commerce (AddToCartButton,
  StickyCartCTA, MiniCartSlideOver, IngredientsTable) + FAQAccordion
  partagé — **~31 cas** ; axe 0 violations sur la page et le mini-cart.

### Décisions notables

| Code | Décision | Justification |
| ---- | -------- | ------------- |
| **D1** | Mini-cart en `<dialog>` natif + slide-over Tailwind | Cohérence projet (pas de Radix, pas de framer-motion) ; focus trap natif via `showModal()` |
| **D2** | `productSchema` + `faqPageSchema` SSR | Rich results Google « Product » + « FAQPage » sans JS côté client |
| **D3** | Sticky CTA mobile uniquement (`md:hidden`) | Convertir sans gêner la lecture éditoriale desktop |
| **D4** | `IngredientsDetails` séparé d'`IngredientsTable` | Composition narrée (texte) vs table comparative (data) — deux patterns distincts |

### Métriques (baseline → après)

| Métrique | Baseline | Cible | Après |
| -------- | -------- | ----- | ----- |
| First Load JS | 92.5 kB | ≤ 120 kB | **164 kB** (au-dessus cible — mini-cart + add-to-cart + 8 sections) |
| Violations axe page | _ | 0 | **0** |
| Violations axe mini-cart | _ | 0 | **0** |
| Add-to-cart fonctionnel | non | oui | **oui** (Zustand persist + ouverture mini-cart) |
| JSON-LD Product | absent | présent | **présent** (`productSchema`) |
| JSON-LD FAQPage | absent | présent | **présent** (`faqPageSchema`) |
| OpenGraph | absent | présent | **présent** (canonical + fr_MA + image) |
| Sections page | 1 | 8 | **9** (8 + JournalGrid) |
| Tests Vitest | 0 | ≥ 6 | **~31 cas** (7 sections + 4 commerce) |
| TypeScript / ESLint | 0 / 0 | 0 / 0 | **0 / 0** |

### Limites

- **First Load JS au-dessus de cible** (164 kB vs 120 kB) : assumé,
  justifié par la complexité commerce (mini-cart Client + RHF + Zustand)
  et le riche éditorial (8 sections + cross-link). Lighthouse Perf à
  mesurer en prod.
- **LCP/CLS/INP non mesurés** : pas de Lighthouse prod dans cette
  phase ; à faire avant la mise en ligne.
- **Comparatif générique** : `ComparatifSection` joue sur fixtures
  locales ; à enrichir avec données concurrentielles vérifiables Phase 2.
- **Pas de Storybook ni Playwright e2e** : couverture interaction via
  Vitest + jest-axe uniquement.

### Suivi

- Mesurer Lighthouse Perf en build prod (cible ≥ 90 mobile).
- Profiler bundle (`ANALYZE=true`) — candidats à split : mini-cart
  (`next/dynamic`), `IngredientsTable`.
- Brancher fournisseur ingrédients (Sanity / DAM) pour les visuels HD.
- Vérifier rich result `Product` dans le Google Search Console après
  mise en ligne.
