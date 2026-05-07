# Annexe — Index alphabétique des composants

> *Tous les composants prévus pour la Phase 1, classés par couche puis alphabétiquement.*

---

## Convention de signatures

Chaque entrée suit le format :

```
NomComposant — couche/path
Description courte (1 ligne).
Props publiques principales : a, b, c.
Storybook : `UI/Catégorie/NomComposant`
```

Pour les types complets, voir [05 — Bibliothèque de composants](../05-bibliotheque-composants.md).

---

## 1. UI primitives (`components/ui/`)

### Badge
**`components/ui/Badge.tsx`** — Étiquette inline pour statut ou catégorie.
Props : `variant`, `tone`, `children`.

### Button
**`components/ui/Button.tsx`** — Action primaire/secondaire/ghost/link.
Props : `variant`, `size`, `loading`, `disabled`, `iconLeading`, `iconTrailing`, `asChild`.

### Card
**`components/ui/Card.tsx`** — Compound component carte modulaire.
Sub-components : `Card.Image`, `Card.Body`, `Card.Title`, `Card.Excerpt`, `Card.Meta`, `Card.Footer`.

### Container
**`components/ui/Container.tsx`** — Wrapper layout responsive.
Props : `width` (`prose | content | wide | page`), `padded`.

### Divider
**`components/ui/Divider.tsx`** — Trait fin horizontal ou vertical.
Props : `orientation`, `tone`.

### Etiquette
**`components/ui/Etiquette.tsx`** — Étiquette circulaire saisonnière (printemps, été, automne, hiver).
Props : `season`, `size`.

### Heading
**`components/ui/Heading.tsx`** — Titre stylé selon niveau, sémantiquement correct.
Props : `as` (h1-h4), `size`, `tone`.

### Image (OptimizedImage)
**`components/ui/Image.tsx`** — Wrapper next/image avec ratio obligatoire.
Props : `src`, `alt`, `ratio`, `priority`, `blurDataURL`, `sizes`.

### Inline
**`components/ui/Inline.tsx`** — Layout horizontal simple, gap configurable.
Props : `gap`, `align`, `wrap`.

### Kicker
**`components/ui/Kicker.tsx`** — Sur-titre tracked all-caps.
Props : `tone`.

### Link
**`components/ui/Link.tsx`** — Lien interne (next/link), externe ou contextuel.
Props : `href`, `external`, `variant` (`inline | nav | meta`).

### Logo
**`components/ui/Logo.tsx`** — Wordmark FemiGlow Pinyon Script.
Props : `size`, `tone`.

### Motif
**`components/ui/Motif.tsx`** — Motif décoratif SVG (vague, fleuron).
Props : `pattern`, `tone`, `size`.

### Pictogram
**`components/ui/Pictogram.tsx`** — Pictogramme SVG du système (40 picto).
Props : `name`, `size`, `decorative`.

### Stack
**`components/ui/Stack.tsx`** — Layout vertical, gap configurable.
Props : `gap`, `align`.

### Tag
**`components/ui/Tag.tsx`** — Étiquette catégorie article/produit.
Props : `tone`, `size`, `children`.

### Text
**`components/ui/Text.tsx`** — Paragraphe ou span typographique.
Props : `as`, `size` (`lead | body | small | caption`), `tone`, `prose`.

---

## 2. Layout (`components/layout/`)

### Footer
**`components/layout/Footer.tsx`** — Pied de page commun, 4 colonnes.
Reçoit liens construits depuis `routes.ts`.

### Header
**`components/layout/Header.tsx`** — En-tête sticky avec wordmark, nav, panier.
Sub : `HeaderStandard`, `HeaderCheckout`.

### MainContent
**`components/layout/MainContent.tsx`** — Wrapper `<main>` avec landmarks.

### Section
**`components/layout/Section.tsx`** — Conteneur section avec rythme vertical.
Props : `tone` (`creme | sauge-soft | encre`), `gap`.

### SkipLink
**`components/layout/SkipLink.tsx`** — Lien d'évitement accessibilité.

---

## 3. Patterns (`components/patterns/`)

### Accordion
**`components/patterns/Accordion.tsx`** — Compound accordéon ARIA-correct.
Sub : `Accordion.Item`, `Accordion.Trigger`, `Accordion.Panel`.

### Breadcrumb
**`components/patterns/Breadcrumb.tsx`** — Fil d'Ariane sémantique.
Props : `items: { label, href }[]`.

### Carousel
**`components/patterns/Carousel.tsx`** — Carrousel manuel, jamais auto-rotatif.
Props : `items`, `gap`, `peek`.

### Pagination
**`components/patterns/Pagination.tsx`** — Pagination journal Phase 2.
Props : `currentPage`, `totalPages`, `baseHref`.

### Reveal
**`components/patterns/Reveal.tsx`** — Wrapper Framer Motion `whileInView`.
Props : `as`, `delay`, `distance`, `direction`, `once`.

### Stepper
**`components/patterns/Stepper.tsx`** — Indicateur 3-étapes checkout.
Props : `current`, `steps: { label, href? }[]`.

### Tabs
**`components/patterns/Tabs.tsx`** — Compound onglets ARIA-correct, animation underline.
Sub : `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`.

---

## 4. Forms (`components/forms/`)

### CheckboxField
**`components/forms/CheckboxField.tsx`** — Champ checkbox + label + erreur.
Props RHF + a11y.

### FormProvider
**`components/forms/FormProvider.tsx`** — Wrapper React Hook Form + Zod resolver.

### Field (générique)
**`components/forms/Field.tsx`** — Wrapper champ : label, helper, error.
Props : `name`, `label`, `helper`, `required`, `children`.

### InputField
**`components/forms/InputField.tsx`** — Champ texte (text, email, tel, password).
Props : `type`, `inputMode`, `autoComplete`, `placeholder`.

### PhoneFieldMaroc
**`components/forms/PhoneFieldMaroc.tsx`** — Champ téléphone formatage Maroc.

### RadioGroupField
**`components/forms/RadioGroupField.tsx`** — Groupe radio (mode livraison, paiement).

### SelectField
**`components/forms/SelectField.tsx`** — Select natif stylé (pays, ville).

### SubmitButton
**`components/forms/SubmitButton.tsx`** — Button submit + état pending RHF.

### TextareaField
**`components/forms/TextareaField.tsx`** — Champ multiligne (contact).

---

## 5. Commerce (`components/commerce/`)

### AddToCartButton
**`components/commerce/AddToCartButton.tsx`** — CTA pivot avec orchestration.
Props : `productId`, `quantity`, `onSuccess`.

### CartDrawer
**`components/commerce/CartDrawer.tsx`** — Overlay panier latéral.
Props : `isOpen`, `onClose`.

### CartItem
**`components/commerce/CartItem.tsx`** — Ligne article dans drawer ou page panier.
Props : `item: OrderItem`, `onUpdateQty`, `onRemove`.

### CartSummary
**`components/commerce/CartSummary.tsx`** — Récap totaux (sous-total, livraison, total).
Props : `items`, `shippingMode`, `promoCode?`.

### EmptyCart
**`components/commerce/EmptyCart.tsx`** — État vide panier.

### PriceTag
**`components/commerce/PriceTag.tsx`** — Affichage prix MAD avec format.
Props : `amount`, `currency`, `original?`.

### ProductHero
**`components/commerce/ProductHero.tsx`** — Section hero `/kit`.
Props : `product`.

### ProductGallery
**`components/commerce/ProductGallery.tsx`** — Galerie photos produit.
Props : `images`.

### Reassurances
**`components/commerce/Reassurances.tsx`** — Bandeau de garanties (livraison, paiement, retours).

### ShippingEstimator
**`components/commerce/ShippingEstimator.tsx`** — Calcul livraison selon ville.

---

## 6. Sections de page (`components/sections/`)

### AvisStrip
**`components/sections/AvisStrip.tsx`** — Bandeau d'avis textuels (3 quotes).
Props : `quotes: Testimonial[]`.

### CompositionList
**`components/sections/CompositionList.tsx`** — Liste ingrédients/composants.
Props : `items: Ingredient[]`.

### Comparatif
**`components/sections/Comparatif.tsx`** — Tableau comparatif `/kit`.
Props : `rows`.

### Contact
**`components/sections/Contact.tsx`** — Section formulaire contact.

### CrossLinks
**`components/sections/CrossLinks.tsx`** — Bloc 3 cards cross-pages.
Props : `links: { title, href, kicker }[]`.

### FAQSection
**`components/sections/FAQSection.tsx`** — Section FAQ avec accordion.
Props : `items: FAQItem[]`.

### GestesGrid
**`components/sections/GestesGrid.tsx`** — Grille 5 gestes du rituel.
Props : `etapes: GesteEtape[]`.

### Hero
**`components/sections/Hero.tsx`** — Hero générique (variantes : `editorial`, `produit`, `lettre`).
Props : `variant`, `title`, `kicker?`, `subtitle?`, `cta?`, `image?`.

### JournalGrid
**`components/sections/JournalGrid.tsx`** — Grille articles journal.
Props : `articles: Article[]`, `featured?`.

### Manifeste
**`components/sections/Manifeste.tsx`** — Section narrative manifeste.
Props : `title`, `paragraphs: string[]`, `image?`.

### MaisonStory
**`components/sections/MaisonStory.tsx`** — Récit fondateur `/maison`.

### MerciLetter
**`components/sections/MerciLetter.tsx`** — Lettre éditoriale `/merci` avec signature.
Props : `firstName`, `orderId`.

### Newsletter
**`components/sections/Newsletter.tsx`** — Form inscription, présent uniquement sur `/journal`.

### TestimonialsHands
**`components/sections/TestimonialsHands.tsx`** — Témoignages avec photo mains.
Props : `testimonials: Testimonial[]`.

### VideoBlock
**`components/sections/VideoBlock.tsx`** — Bloc vidéo avec controls + transcript link.
Props : `src`, `poster`, `transcriptHref?`, `caption`.

---

## 7. Overlays (`components/overlays/`)

### Dialog
**`components/overlays/Dialog.tsx`** — Modal accessible (focus trap, ESC).
Props : `isOpen`, `onClose`, `title`, `children`.

### Drawer
**`components/overlays/Drawer.tsx`** — Tiroir latéral (cart, mobile menu).
Props : `isOpen`, `onClose`, `side` (`left | right`), `title`.

### MobileMenu
**`components/overlays/MobileMenu.tsx`** — Menu mobile plein-écran.

### Lightbox
**`components/overlays/Lightbox.tsx`** — Visualisation image agrandie.
Props : `images`, `initialIndex`, `onClose`.

### CookieBanner
**`components/overlays/CookieBanner.tsx`** — Consentement RGPD.

### Toast (utilitaire interne)
**`components/overlays/Toast.tsx`** — Notification sobre, auto-dismiss.

---

## 8. Statistiques

| Catégorie | Composants |
|---|---|
| UI primitives | 17 |
| Layout | 5 |
| Patterns | 7 |
| Forms | 9 |
| Commerce | 10 |
| Sections | 16 |
| Overlays | 6 |
| **Total Phase 1** | **70** |

## 9. Mapping page ↔ composants principaux

| Page | Composants pivots |
|---|---|
| `/` | Hero, GestesGrid, Manifeste, AvisStrip, JournalGrid (3), CrossLinks |
| `/rituel` | Hero, GestesGrid (détaillé), Manifeste, VideoBlock, Reveal x N, CrossLinks |
| `/kit` | ProductHero, CompositionList, Tabs (composition/FAQ/avis), Comparatif, TestimonialsHands, Reassurances, AddToCartButton |
| `/journal` | Hero, JournalGrid (featured + grid), Newsletter, CrossLinks |
| `/journal/[slug]` | Breadcrumb, MDX content, JournalGrid (related 3), CrossLinks |
| `/maison` | Hero, MaisonStory, Manifeste, CrossLinks |
| `/panier` | CartItem (list), CartSummary, EmptyCart |
| `/commander` | Stepper, FormProvider + champs, CartSummary (sticky) |
| `/merci` | MerciLetter, JournalGrid (3) |
| `/contact` | Contact (form), Reassurances |

## 10. Composants à créer en priorité (S1-S2)

1. Button
2. Container
3. Stack / Inline
4. Heading / Text
5. Image (wrapper)
6. Link
7. Logo
8. Header (standard)
9. Footer
10. Section

Sans ces 10, rien ne tourne. Le reste s'empile en sprints suivants.

> *Voir : [05 — Bibliothèque de composants](../05-bibliotheque-composants.md) pour signatures TypeScript détaillées.*
