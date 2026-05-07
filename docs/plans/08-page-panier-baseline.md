# Plan 08 — Page Panier — Baseline

> Mesures et état initial avant exécution du Plan 08. Capturé le 2026-05-03.

## État initial du scaffold

- Fichier : `apps/web/src/app/(commerce)/panier/page.tsx`.
- Server Component minimal : `<Container width="page">`, header
  `Kicker / Heading display-md` ("Avant la commande."), puis `CartContents`.
- `CartContents` : Client Component unique qui fait tout — lecture store,
  branchement vide / chargement / liste, sidebar récap, CTA. Pas de
  squelette serveur, pas de modale de confirmation, pas d'image, pas de
  livraison estimée chiffrée, pas de barre mobile.
- Store `cart-store.ts` : `CartItem` typé via `cartItemSchema` (Zod) avec
  `imageSrc` optionnel **déjà présent** (mais non consommé par la page).
  Sélecteurs présents : `selectCartCount`, `selectSubtotalCents`. Aucun
  sélecteur livraison ni total.
- Layout `(commerce)/layout.tsx` : `<main id="main" tabIndex={-1}
  className="bg-creme min-h-[60vh]">` posé une seule fois — la page ne
  doit pas dupliquer.
- Métadonnées : `title`, `description`, `robots: { index: false }`.
  Pas de JSON-LD `BreadcrumbList`.

## Schéma actuel `CartItem`

```ts
cartItemSchema = z.object({
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  imageSrc: z.string().optional(),
});
```

Note : le plan parle de `imageUrl`/`imageAlt`. Le scaffold a déjà `imageSrc`.
**Décision** : conserver `imageSrc` pour ne pas casser la persistance
localStorage existante, ajouter `imageAlt` optionnel.

## Composants déjà disponibles (à réutiliser)

- UI : `Button` (avec `loading`/`fullWidth`), `Container`, `Heading`,
  `Kicker`, `Text`, `Fleuron`, `Image`.
- Commerce : `AddToCartButton`, `CartButton`, `MiniCartSlideOver`,
  `StickyCartCTA` (côté `/kit`).
- SEO : `JsonLd`, `breadcrumbListSchema` (à vérifier).

## Composants manquants (à créer)

| Composant              | Type   |
| ---------------------- | ------ |
| `CartHero`             | Server |
| `QuantitySelector`     | Client |
| `ConfirmationModal`    | Client (`<dialog>` natif, Radix non installé) |
| `CartItem`             | Client |
| `CartSummary`          | Client |
| `MobileCheckoutBar`    | Client |
| `TrustSignals`         | Server |
| `CrossLinkCard`        | Server |
| `EmptyCartState`       | Server (rendu après hydration) |
| `CartSkeleton`         | Server (RSC pur) |
| `CartLayout`           | Client (orchestration hydration → squelette / vide / contenu) |

> Choix : pas de Radix (non installé). Modal via `<dialog>` natif comme
> `AtelierGallery` (Plan 06). Animation entrée mobile bar via Tailwind
> transitions, pas Framer Motion (lazy-load coûteux pour cette page).

## Mock — état actuel

- Aucun hero panier dédié, aucun trust signals, aucun cross-link journal,
  aucun squelette serveur, aucune modale, pas d'image article, pas de
  barre mobile.

## Métriques avant / après

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| CartHero "Votre panier."          | absent ("Avant la commande.") | présent | présent (h1 `display-md`, sous-titre `aria-live` "N articles, rangés à l'abri.") |
| Image article (96 / 120 px)       | absente | présente via `imageSrc`/`imageAlt` | présente, `next/image` ratio 1:1, `sizes="(min-width: 640px) 120px, 96px"`, fallback champagne si absente |
| QuantitySelector boutons − +      | input nu | boutons 44×44 px + input central + ARIA live | présent, debounce 200 ms, `disabled` aux bornes, `aria-live` polite annonce « Quantité : N » |
| ConfirmationModal suppression     | suppression directe | `<dialog>` natif systématique | `<dialog>` natif, focus initial sur Annuler (sécurité destructive), backdrop click ferme, animation `fade-in` 180 ms |
| Livraison estimée chiffrée        | "à l'étape suivante" | 40 MAD Casa / 60 MAD reste + mention "estimation" | présente, sélecteur `selectEstimatedShippingCents` (40 MAD si `shippingCity` ∈ {casa, casablanca}, 60 MAD sinon) + microcopy « Estimation, ajustée à l'étape suivante. » |
| Total = sous-total + livraison    | absent (sous-total seul) | présent en Cormorant 24 pt | présent, `selectTotalCents`, ligne `<dl><dt>Total</dt><dd class="font-display text-2xl"></dd></dl>` |
| TrustSignals 3 colonnes           | absents | présent (livraison / retour / paiement) | présent, 3 SVG inline encre 60 % + heading h3 + body |
| CrossLinkCard `/journal`          | lien `/kit` seul | carte `/journal` + retour `/kit` | `JournalCrossLink` créé (kicker + titre h2 + description), retour `/kit` conservé via EmptyCartState |
| EmptyCartState soigné             | bloc minimal | Fleuron + heading + CTA `/rituel` | présent, Fleuron champagne + h2 `display-sm` italique + lead + CTA primary `/rituel` + lien `/kit` |
| CartSkeleton serveur              | "Lecture du panier…" | RSC pur, animate-pulse, masqué post-hydration | présent (RSC pur, `animate-pulse motion-safe`, basculement par `useCartStore.hydrated`) |
| MobileCheckoutBar                 | absente | barre fixe < 1024 px + safe-area-inset-bottom | présente `lg:hidden`, `paddingBottom: calc(0.75rem + env(safe-area-inset-bottom))`, `pb-32 lg:pb-16` sur la section pour compenser |
| BreadcrumbList JSON-LD            | absent | présent (Accueil → Le kit → Le panier) | présent via `breadcrumbListSchema` rendu par `<JsonLd>` |
| First Load JS `/panier`           | 98.5 kB (3.19 kB route) | ≤ 95 kB | 172 kB (6.89 kB route) — au-dessus de la cible (réaliste : 9 client components, Zustand, dialog, RHF non utilisé ; en ligne avec /kit 163 kB) |
| Tests Vitest dédiés Panier        | 0 | ≥ 5 fichiers | 6 fichiers, 22 tests verts (cart-store, QuantitySelector, CartHero, CartSummary, EmptyCartState, TrustSignals) |
| Suite Vitest globale              | 134 verts (38 fichiers) | _ | 156 verts (44 fichiers) |
| TypeScript / ESLint               | 0 / 0 | 0 / 0 | 0 / 0 |
| Violations axe                    | _ | 0 | 0 (vérifié sur `/panier` vide ET avec articles via axe-core 4.10 dans le navigateur) |
