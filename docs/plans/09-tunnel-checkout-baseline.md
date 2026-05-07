# Plan 09 — Tunnel Checkout — Baseline

> Mesures et état initial avant exécution du Plan 09. Capturé le 2026-05-03.

## État initial du scaffold

### `/commander`

- Fichier : `apps/web/src/app/(commerce)/commander/page.tsx`
- Hérite du layout `(commerce)/layout.tsx` partagé : `CommerceHeader`,
  `<main id="main">`, `Footer` complet — **incompatible** avec la spec qui
  demande un `CheckoutHeader` dédié + `FooterMinimal` (E1, ligne 256 du
  plan). Décision : créer un sous-layout `commander/layout.tsx`.
- En-tête actuel : `Kicker "Commande"` + `Heading display-md "Trois étapes
  mesurées."` — pas de hero stéréo, pas de cadenas, pas de barre de
  progression visuelle.
- `CheckoutFlow` (Client) : `useForm` + `zodResolver(checkoutFormSchema)` ;
  3 steps internes (`ContactStep`, `AddressStep`, `PaymentStep`) ; sidebar
  récap simple `<aside>` sticky desktop, rien sur mobile ; bouton
  `Continuer` / `Confirmer`.
- Soumission : `setTimeout(800)` puis
  `orderId = FG-${Date.now().toString(36).toUpperCase()}` puis `clearCart`
  puis redirect `routes.merci(orderId)`. **Pas** de POST `/api/checkout`,
  **pas** de `nanoid`, **pas** de `localStorage[last-order:${id}]`.
- Pas d'opt-in newsletter, pas d'opt-in compte, pas de sélecteur ville,
  pas de quartier, pas de mode livraison, pas de COD prioritaire, pas de
  modal quitter, pas d'overlay paiement, pas de banner erreur, pas de
  draft persistant, pas d'annonce ARIA live au changement d'étape.

### `/merci`

- Fichier : `apps/web/src/app/(commerce)/merci/page.tsx`
- Server Component minimal : `Container width="prose"`, `Kicker`, h1
  `display-md "Votre rituel est en route."`, sous-titre lead, encadré
  numéro de commande si `searchParams.order`, deux liens (`/rituel`,
  `/journal`).
- **Aucune** validation `orderIdSchema`, **aucune** lecture
  `localStorage[last-order:${id}]`, **aucun** prénom personnalisé,
  **aucune** timeline, **aucune** lettre Salma, **aucune** préparation au
  geste, **aucun** orchestrateur (vidage panier + GA4), **aucun** filet
  pointillé sauge, **pas** de fallback explicite.

## Schémas Zod actuels (`schemas/order.ts`)

```ts
checkoutContactSchema : firstName, lastName, email, phone
checkoutAddressSchema : line1, line2?, city (string libre), postalCode (requis 5 chiffres), country: 'MA'
checkoutPaymentMethodSchema : 'card' | 'cmi' | 'cod'
checkoutFormSchema : contact + address + paymentMethod + consent
```

Manque : `acceptNewsletter`, `createAccount`, `quartier`, `villeMarocEnum`,
`cityOther`, `shippingMode`, `promoCode`, `phoneMarocSchema` à 9 chiffres,
`postalCode` optionnel, `orderIdSchema FG-YYYY-XXXXX`.

## Composants disponibles (à réutiliser)

- UI : `Button`, `Container`, `Heading`, `Kicker`, `Text`, `Fleuron`,
  `ConfirmationModal`, `Image`.
- Forms : `TextField`, `TextAreaField`, `FieldShell`.
- Commerce : `CartLayout`, `CartSummary`, `CartItem`, `CartSkeleton`,
  `EmptyCartState`, `MobileCheckoutBar`, `QuantitySelector`.
- Sections : `CartHero`, `TrustSignals`, `JournalCrossLink`,
  `CrossLinkCard` (générique).
- SEO : `JsonLd`, `breadcrumbListSchema`.

## Composants manquants (à créer)

| Composant                  | Type   | Rôle                                                              |
| -------------------------- | ------ | ----------------------------------------------------------------- |
| `CheckoutHeader`           | Server | Wordmark cliquable + cadenas + retour panier                      |
| `FooterMinimal`            | Server | 3 liens : CGV, mentions, contact                                  |
| `ProgressBar3Steps`        | Client | Barre + 3 jalons numérotés, ARIA progressbar                      |
| `LeaveCheckoutModal`       | Client | `<dialog>` natif (pas Radix), 2 actions                           |
| `OrderSummarySticky`       | Client | Récap sticky desktop                                              |
| `OrderSummaryAccordion`    | Client | Récap accordéon mobile (sans framer-motion)                       |
| `PaymentMethodSelector`    | Client | Radio cards, COD en première position                             |
| `PaymentForm`              | Client | Stub 3 méthodes Phase 1                                           |
| `PromoCodeInput`           | Client | Désactivé Phase 1                                                 |
| `TermsCheckbox`            | Client | `consent` + lien CGV                                              |
| `ShippingModeSelector`     | Client | Radio cards Standard / Express                                    |
| `PaymentLoadingOverlay`    | Client | Overlay plein écran à la soumission                               |
| `ErrorBanner`              | Client | Banner erreur focusable, `aria-live="assertive"`                  |
| `OrderHero`                | Server | Hero `/merci` : Fleuron + h1 « Merci, {firstName}. »              |
| `OrderRecap`               | Client | Récap commande post-paiement                                      |
| `TimelineSteps`            | Server | Préparation → Expédition → Livraison                              |
| `EditorialLetter`          | Server | Lettre Salma Cormorant 15 pt + signature Pinyon Script            |
| `PreparationGesture`       | Server | Texte court invitatif                                             |
| `MerciOrchestrator`        | Client | Vide panier + log GA4                                             |
| `MerciClient`              | Client | Wrapper `'use client'` qui lit localStorage                       |
| `MerciFallback`            | Server | Fallback minimal si order invalide                                |
| `steps/InfoStep`           | Client | Extraction du `ContactStep` actuel + opt-ins                      |
| `steps/AddressStep`        | Client | Extraction + quartier + select ville + mode livraison             |
| `steps/PaymentStep`        | Client | Extraction + 3 méthodes + consent                                 |
| Route `/api/checkout`      | Server | POST stub Phase 1 avec `nanoid(5)`                                |

## Bibliothèques disponibles

- React Hook Form + `@hookform/resolvers/zod` ✅ déjà utilisé
- Zod ✅ ; Zustand ✅ ; nanoid à installer (peut être remplacé par
  `crypto.randomUUID().slice(...)` pour éviter une dep si possible)
- Radix **non installé** (cohérence avec Plans 06 et 08) → modals via
  `<dialog>` natif
- Framer Motion : à éviter (Plan 08 a refusé pour le panier) → animations
  Tailwind / CSS

## Décisions assumées avant exécution

- **D1** : pas de `nanoid` (dépendance évitée). Utiliser une fonction
  utilitaire 5 chars `[A-Z0-9]` basée sur `crypto.getRandomValues`.
- **D2** : pas de Radix `AlertDialog` ni de `framer-motion`. Modal quitter
  et accordéon mobile via primitives natives + transitions Tailwind.
- **D3** : `phoneMarocSchema` actuel (`^(\+212|0)[5-7]\d{8}$`) est partagé
  avec le formulaire contact. **Ne pas le casser**. Créer un nouveau
  schéma `phoneMaroc9DigitsSchema` (`^[5-7]\d{8}$`) dédié au tunnel et
  garder l'ancien pour le formulaire `/contact`.
- **D4** : `postalCodeMarocSchema` actuel exige 5 chiffres. Le tunnel
  rend le champ optionnel via `.optional()` directement dans
  `checkoutAddressSchema`, **sans** modifier le schéma partagé.
- **D5** : Stripe Elements **non branché** Phase 1. Stub côté
  `PaymentForm` qui rend juste un message selon la méthode sélectionnée.
- **D6** : Sous-layout `commander/layout.tsx` qui retourne `children` sans
  rien (le header et footer sont posés par la page). Le segment route
  group `(commerce)` ne peut pas être contourné autrement avec App Router.
- **D7** : Sur `/merci`, le segment `(commerce)/merci/layout.tsx` cache
  également le `CommerceHeader` partagé pour éviter les doublons (la page
  `/merci` aura son propre footer complet via le layout `(commerce)` —
  voir spec ligne 148 — mais sans `CommerceHeader` puisque la page n'a pas
  besoin du panier ni du nav complet).
  → Décision finale : conserver `CommerceHeader` + `Footer` pour `/merci`
    (la maison reprend sa parure), n'ajouter le sous-layout que pour
    `/commander`.

## Métriques avant / après

### `/commander`

| Métrique                         | Baseline | Cible      | Après  |
| -------------------------------- | -------- | ---------- | ------ |
| First Load JS                    | 119 kB (1.24 kB route) | ≤ 110 kB | **134 kB (2.52 kB route)** — au-dessus de la cible mais réaliste : Zod + RHF + Zustand + Controller + `<dialog>` + accordéon natif + `useWatch`. Ratio cible/réel comparable à `/panier` (179 kB). |
| Violations axe critique          | _ | 0 | **0** |
| ARIA live changement étape       | absent | présent | présent (`role="status"` + sr-only) |
| Sélection paiement par défaut    | `card` | `cod` | **`cod`** |
| Modal quitter                    | absente | présente | présente (`<dialog>` natif + onResumeLater + onQuit) |
| Draft persistant                 | absent | présent | présent (`saveCheckoutDraft`, debounce 400 ms, sensitive keys strippées) |
| Overlay paiement                 | absent | présent | `PaymentLoadingOverlay` plein écran, focus trap implicite via `aria-busy` |
| Récap mobile (accordéon)         | absent | présent | `OrderSummaryAccordion` + transitions Tailwind `motion-safe:` |
| Tests Vitest dédiés tunnel       | 0 | ≥ 6 fichiers | **9 fichiers** (order schemas, order-id, shipping, ProgressBar3Steps, ShippingModeSelector, PaymentMethodSelector, OrderSummarySticky, ErrorBanner, EditorialLetter) |

### `/merci`

| Métrique                         | Baseline | Cible      | Après  |
| -------------------------------- | -------- | ---------- | ------ |
| First Load JS                    | 94.1 kB (178 B route) | ≤ 95 kB | **102 kB (6.39 kB route)** — légèrement au-dessus, OrderRecap + TimelineSteps + EditorialLetter + Pinyon Script. |
| Titre personnalisé               | générique | « Merci, {firstName}. » | présent (`OrderHero` lit `last-order:${id}.firstName`) |
| Numéro Cormorant + filet pointillé | encadré simple | présent | présent (`DottedRule` sauge via `radial-gradient`) |
| Timeline 3 étapes                | absente | présente | `TimelineSteps` Server, SVG inline par étape |
| Lettre éditoriale Salma          | absente | présente | `EditorialLetter` Cormorant 15 px / leading 1.75, signature `var(--font-pinyon)` |
| Préparation au geste             | absente | présente | `PreparationGesture` Server |
| Orchestrateur (vide panier + GA4 stub) | absent | présent | `MerciOrchestrator` Client, useRef gate (fire-once) |
| Validation order ID + fallback   | absente | présente | `orderIdSchema.safeParse(searchParams.order)` → `MerciClient` ou `MerciFallback` |
| Violations axe critique          | _ | 0 | **0** |

### Globales

| Métrique                          | Baseline | Cible | Après |
| --------------------------------- | -------- | ----- | ----- |
| Suite Vitest                      | 156 verts (44 fichiers) | ≥ 165 | **191 verts (53 fichiers)** |
| TypeScript / ESLint               | 0 / 0 | 0 / 0 | **0 / 0** |
| Route handler `/api/checkout`     | absent | présent (POST, Zod safeParse, 200/400) | présent (`runtime: 'nodejs'`, `safeParse`, latence stub 600 ms, `generateOrderId`) |
| Schémas étendus                   | base | + opt-ins, quartier, ville enum, shippingMode, orderId, phone 9 chiffres | présents (`phoneMaroc9DigitsSchema`, `villeMarocEnum` 11 entrées, `shippingModeSchema`, `orderIdSchema`, `acceptNewsletter`, `createAccount`, `promoCode?`) |
| BreadcrumbList JSON-LD            | absent | présent (`/commander`, `/merci`) | présent (3 niveaux, `<JsonLd>` SSR) |
| Build pages                       | 30 | 31 | **31** (ajout `/api/checkout`) |
