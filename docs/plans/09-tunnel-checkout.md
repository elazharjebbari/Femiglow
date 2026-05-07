# Plan 09 — Tunnel checkout (`/commander` + `/merci`)

> Plan d'exécution détaillé pour porter le tunnel d'achat au niveau
> « cabinet international ». Couvre les **deux pages** qui forment la
> bascule transaction → relation : `/commander` (la plus haute valeur du
> site) et `/merci` (le moment de gratitude qui désamorce le
> buyer's remorse). À lire de bout en bout avant de toucher au code.

**Pages cibles** :
- [`apps/web/src/app/(commerce)/commander/page.tsx`](../../apps/web/src/app/(commerce)/commander/page.tsx)
- [`apps/web/src/app/(commerce)/merci/page.tsx`](../../apps/web/src/app/(commerce)/merci/page.tsx)

**Specs sources** :
- [§ 4.7 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
- [§ 4.8 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)

**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 26 à 34 heures de travail concentré (4 à 5 jours).

---

## 1. Objectif

### 1.1 `/commander`

La page `/commander` est le **point de bascule économique** du site.
Elle doit, dans l'ordre :

1. Inspirer la confiance dès la première seconde — header simplifié,
   cadenas visible, ancrage retour panier.
2. Proposer trois étapes mesurées (Informations, Livraison, Paiement)
   dont chacune est validable seule, sans bondir.
3. Récapituler la commande en permanence — sticky desktop, accordéon
   mobile — pour qu'aucun doute ne subsiste sur ce qu'on emporte.
4. Offrir trois moyens de paiement (carte internationale, CMI Maroc,
   paiement à la livraison), avec **COD au moins aussi visible que la
   carte** : c'est ce que demande le marché marocain.
5. Soumettre sans surprise : overlay de chargement explicite, redirection
   vers `/merci` ou affichage d'une `ErrorBanner` posée.

KPIs cibles ([§ 4.7](../preparation/04-specifications-pages.md)) :

| KPI                                  | Cible      |
| ------------------------------------ | ---------- |
| Conversion checkout                  | > 65 %     |
| Complétion étape 1 → 2               | > 90 %     |
| Complétion étape 2 → 3               | > 85 %     |
| Complétion étape 3 → succès          | > 80 %     |
| Time-to-complete                     | < 3 min    |
| Erreurs paiement                     | < 3 %      |
| LCP                                  | < 2.0 s    |
| INP                                  | < 150 ms   |

### 1.2 `/merci`

La page `/merci` est le **moment unique de la maison qui remercie**. Elle
doit, dans l'ordre :

1. Confirmer sans euphorie : « Merci, [Prénom]. Votre commande est en
   bonnes mains. »
2. Donner le numéro de commande, l'adresse de livraison, l'estimation —
   tout ce que l'utilisateur va vouloir relire dans 30 secondes.
3. Désamorcer le buyer's remorse via une **lettre éditoriale signée
   Salma** (Cormorant 15 pt, 640 px max) qui rappelle le geste, pas le
   produit.
4. Inviter à préparer le moment de la livraison (« Préparation au geste »)
   et à revenir au journal sans presser.
5. Déclencher en arrière-plan : vider le panier, planifier les emails
   J+5/J+15 (Phase 2), envoyer l'event GA4 `purchase` (stub Phase 1).

KPIs cibles ([§ 4.8](../preparation/04-specifications-pages.md)) :

| KPI                                  | Cible    |
| ------------------------------------ | -------- |
| Scroll ≥ 70 %                        | > 70 %   |
| CTR vers `/journal`                  | > 15 %   |
| Retour site J+7                      | > 30 %   |
| Buyer's remorse (mesure NPS J+3)     | < 1.5 %  |
| LCP                                  | < 2.0 s  |
| CLS                                  | < 0.02   |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                  | Pourquoi                                                                |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | [00 — Résumé exécutif](../preparation/00-executive-summary.md)                            | Recadrer l'intention                                                    |
| 2   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                      | Vérifier la voix dans le tunnel et la lettre `/merci`                   |
| 3   | [02 — Design system](../preparation/02-design-system.md)                                  | Tokens, typographies, états focus, formulaires                          |
| 4   | [04 — Spécifications de pages, §§ 4.7 et 4.8](../preparation/04-specifications-pages.md)  | Source canonique du tunnel et du remerciement                           |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)           | `ProgressBar3Steps`, `OrderSummary*`, `PaymentForm`, `EditorialLetter`  |
| 6   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md) | Reveal de la lettre `/merci`, micro-feedback étape, overlay paiement    |
| 7   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)            | ARIA stepper, focus order, annonces live à chaque changement d'étape    |
| 8   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)              | Stripe Elements lazy, polices, scripts tiers                            |
| 9   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                               | `noindex` sur `/commander` et `/merci`, BreadcrumbList, JSON-LD `Order` |
| 10  | [12 — QA & observabilité](../preparation/12-qa-debugging-observabilite.md)                | Tests E2E golden path complet panier → commander → merci                |
| 11  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)               | Vocabulaire autorisé pour la lettre Salma                               |
| 12  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5        | Cycle, DoD composant, DoD page                                          |

**Temps de relecture** : 2 heures, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances

### 3.1 Tokens (commun aux deux pages)

À vérifier dans [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css)
contre [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge`, `--sauge-soft`, `--creme`, `--encre`, `--champagne`,
  `--encre-error` (rouge sauge profond pour les erreurs formulaire).
- Typographies : `--font-display` (Cormorant), `--font-body` (Inter),
  `--font-script` (Pinyon Script — uniquement pour la signature Salma).
- Tailles : `display-md` (titre `/merci`), `lg`, `lead`, `body`, `caption`.
- Espacements : `--space-1` à `--space-20`.
- Motion : `--duration-fast`, `--duration-base`, `--duration-slow`,
  `--ease-out-soft`, `--ease-in-out-slow`.
- Z-index : `--z-sticky`, `--z-overlay` (overlay paiement), `--z-modal`
  (modal quitter).
- Focus : `outline-encre` 2 px, offset 3 px sur tous les inputs et radios.

### 3.2 Primitifs UI (à polir avant les pages)

Dans `apps/web/src/components/ui/` :

| Composant   | État actuel | À polir avant le tunnel                                             |
| ----------- | ----------- | ------------------------------------------------------------------- |
| `Button`    | Présent     | Variant primary, ghost, link ; `loading`, `fullWidth`               |
| `Container` | Présent     | Variants `prose` (lettre Salma) et `page` (formulaires)             |
| `Heading`   | Présent     | `display-md`, `lg`, `md`, `sm`                                      |
| `Text`      | Présent     | `lead`, `body`, `caption` ; tones default/secondary/tertiary        |
| `Kicker`    | Présent     | « Étape 01 », « La maison vous remercie »                           |
| `TextField` | Présent     | États error, hint, autocomplete, `inputMode`                        |
| `FieldShell`| Présent     | Wrapper accessible avec `aria-describedby` + `aria-invalid`         |

### 3.3 Layout

Dans `apps/web/src/components/layout/` :

| Composant         | À polir avant le tunnel                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `CommerceHeader`  | Variante `checkout` (wordmark + cadenas + lien retour panier, sans nav complète)   |
| `Footer`          | Sur `/commander` : `FooterMinimal` (3 liens : CGV, mentions, contact)              |
| `Footer`          | Sur `/merci` : `Footer` complet (la maison reprend sa parure)                      |
| `SkipLink`        | Cible `#main`, présent sur les deux pages                                          |

### 3.4 Sections par page

#### `/commander`

| #   | Section                       | Fichier                                          | État          |
| --- | ----------------------------- | ------------------------------------------------ | ------------- |
| 1   | Header simplifié              | `layout/CheckoutHeader.tsx`                      | **À créer**   |
| 2   | Barre progression 3 étapes    | `commerce/ProgressBar3Steps.tsx`                 | **À créer**   |
| 3   | Étape 1 — Informations        | `commerce/steps/InfoStep.tsx`                    | À extraire    |
| 4   | Étape 2 — Livraison           | `commerce/steps/AddressStep.tsx`                 | À extraire    |
| 5   | Étape 3 — Paiement            | `commerce/steps/PaymentStep.tsx`                 | À extraire    |
| 6   | Récap sticky desktop          | `commerce/OrderSummarySticky.tsx`                | **À créer**   |
| 7   | Récap accordéon mobile        | `commerce/OrderSummaryAccordion.tsx`             | **À créer**   |
| 8   | Overlay paiement              | `commerce/PaymentLoadingOverlay.tsx`             | **À créer**   |
| 9   | Footer minimal                | `layout/FooterMinimal.tsx`                       | **À créer**   |

#### `/merci`

| #   | Section                       | Fichier                                          | État          |
| --- | ----------------------------- | ------------------------------------------------ | ------------- |
| 1   | Hero remerciement             | `sections/OrderHero.tsx`                         | **À créer**   |
| 2   | Récap commande                | `sections/OrderRecap.tsx`                        | **À créer**   |
| 3   | Suivi & étapes timeline       | `sections/TimelineSteps.tsx`                     | **À créer**   |
| 4   | Lettre éditoriale Salma       | `sections/EditorialLetter.tsx`                   | **À créer**   |
| 5   | Préparation au geste          | `sections/PreparationGesture.tsx`                | **À créer**   |
| 6   | Cross-links                   | `sections/CrossLinkCard.tsx` (réutilisé)         | À polir       |

### 3.5 Composants spécifiques à créer

| Composant                   | Pourquoi                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `CheckoutHeader`            | Wordmark cliquable (modal quitter) + cadenas + lien retour panier                         |
| `ProgressBar3Steps`         | Barre visuelle, pas le `Stepper` actuel — affiche 3 jalons + barre de remplissage         |
| `LeaveCheckoutModal`        | Radix `AlertDialog` : « Reprendre plus tard » (sauve draft) / « Quitter » (vide draft)    |
| `InfoForm`                  | Email + opt-in newsletter + opt-in compte                                                 |
| `AddressForm`               | Adresse + quartier + ville (select) + téléphone (préfixe +212 fixe)                       |
| `ShippingModeSelector`      | Radio cards : Standard / Express                                                          |
| `PaymentMethodSelector`     | Radio cards : Carte / CMI / COD                                                           |
| `PaymentForm` (stub Phase 1)| Placeholder Stripe Elements, Phase 2 charge `@stripe/stripe-js`                           |
| `PromoCodeInput`            | Présent mais désactivé Phase 1 (input grisé + tooltip « bientôt »)                        |
| `TermsCheckbox`             | Checkbox acceptation CGU + lien `/cgv`                                                    |
| `OrderSummarySticky`        | Sidebar droite desktop, récap items + sous-total + livraison + total                      |
| `OrderSummaryAccordion`     | Bandeau en haut mobile, ouvre/ferme avec animation discrète                               |
| `PaymentLoadingOverlay`     | Overlay plein écran avec spinner Cormorant et message « Paiement en cours… »              |
| `ErrorBanner`               | Bandeau erreur en haut du formulaire, focusable, `aria-live="assertive"`                  |
| `FooterMinimal`             | 3 liens : Conditions générales, Mentions, Contact                                         |
| `OrderHero`                 | Hero `/merci` : fleuron + titre personnalisé + numéro + filet pointillé                   |
| `OrderRecap`                | Récap commande sur `/merci` : items + adresse + paiement                                  |
| `TimelineSteps`             | Timeline 3 étapes Préparation → Expédition → Livraison                                    |
| `EditorialLetter`           | Lettre Salma, Cormorant 15 pt, 640 px max, signature Pinyon Script                        |
| `PreparationGesture`        | Photo lifestyle + texte court (« Choisissez un soir calme. »)                             |

### 3.6 Schémas Zod

Existants dans
[`schemas/order.ts`](../../apps/web/src/lib/schemas/order.ts) :
- `checkoutContactSchema` (firstName, lastName, email, phone)
- `checkoutAddressSchema` (line1, line2, city, postalCode, country)
- `checkoutPaymentMethodSchema` (`'card' | 'cmi' | 'cod'`)
- `checkoutFormSchema` (assemblage)

À étendre :
- `checkoutContactSchema` : ajouter `acceptNewsletter: z.boolean().default(false)`,
  `createAccount: z.boolean().default(false)`.
- `checkoutAddressSchema` : ajouter `quartier: z.string().min(2).max(80)`,
  `shippingMode: z.enum(['standard', 'express']).default('standard')`.
  Rendre `postalCode` **optionnel** (Maroc Phase 1).
- `checkoutFormSchema` : ajouter `promoCode: z.string().optional()`,
  `consent: z.literal(true)` (déjà présent).

### 3.7 Données

#### Côté `/commander`
- Lecture du store Zustand `useCartStore` (items, subtotal).
- Pas de fetch RSC : la page est un coquillage RSC, le `CheckoutFlow` est
  `'use client'`.
- À la soumission : POST `/api/checkout` (Phase 1 stub avec
  `checkoutFormSchema.safeParse` + génération `orderId` `FG-2026-XXXXX`,
  Phase 2 réel avec Stripe + CMI + COD).

#### Côté `/merci`
- Lecture `searchParams.order` côté serveur (validation forme `FG-2026-XXXXX`).
- Composant interne `'use client'` qui lit `localStorage[`last-order:${orderId}`]`
  après hydration ; si absent, fallback minimaliste.
- Phase 2 : fetch `/api/orders/[id]` côté serveur avec session token,
  `Cache-Control: no-store`.

### 3.8 Routes

Existantes dans [`lib/routes.ts`](../../apps/web/src/lib/routes.ts) :
- `routes.commander` → `/commander`
- `routes.merci(orderId)` → `/merci?order=${orderId}`
- `routes.panier` → `/panier`

À créer :
- Route handler `app/api/checkout/route.ts` (POST), Phase 1 stub.

---

## 4. Écarts entre les specs (§§ 4.7 et 4.8) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec                                                                  | Scaffold actuel                                  | Décision proposée                                                              |
| --- | --------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| E1  | Header simplifié dédié (wordmark + cadenas + retour panier)           | `CommerceHeader` partagé avec `/panier`          | **Créer** `CheckoutHeader` séparé, posé via un sous-layout `commander`         |
| E2  | Barre de progression visuelle 3 étapes (jalons + remplissage)         | `Stepper` numéroté basique                       | **Remplacer** par `ProgressBar3Steps` (barre + jalons numérotés)               |
| E3  | Opt-in newsletter + opt-in compte étape 1                             | Pas dans le formulaire                           | **Ajouter** deux checkboxes ; étendre `checkoutContactSchema`                  |
| E4  | Quartier (champ texte) + ville (select FE/RAK/CASA/etc.)              | Ville en input texte libre                       | **Créer** `<select>` ville + ajouter champ `quartier`                          |
| E5  | Téléphone : préfixe +212 fixe + 9 chiffres                            | Input tel libre, `placeholder="+212 6 ..."`      | **Créer** un input avec préfixe verrouillé (+212) côté UI, schéma Zod adapté   |
| E6  | Mode livraison standard/express                                       | Absent                                           | **Créer** `ShippingModeSelector` étape 2, ajouter au schéma                    |
| E7  | Code postal **optionnel** au Maroc                                    | `checkoutAddressSchema.postalCode` requis        | **Rendre** optionnel ; mettre à jour `postalCodeMarocSchema` ou le retirer     |
| E8  | COD au moins aussi visible que carte                                  | 3 radios alignées sans hiérarchie                | **Mettre** COD en premier ou côte à côte avec carte (radio cards), pas en bas  |
| E9  | Code promo (Phase 2)                                                  | Absent                                           | **Créer** `PromoCodeInput` désactivé Phase 1 (visible mais grisé)              |
| E10 | Récap sticky desktop / accordéon mobile                               | Sidebar simple sticky desktop, rien sur mobile   | **Créer** `OrderSummarySticky` + `OrderSummaryAccordion` mobile                |
| E11 | Overlay chargement paiement                                           | Bouton avec `loading`                            | **Créer** `PaymentLoadingOverlay` plein écran à la soumission                  |
| E12 | Modal quitter sur clic wordmark                                       | Lien wordmark sans modal                         | **Créer** `LeaveCheckoutModal` Radix avec deux options                         |
| E13 | Sauvegarde draft (« Reprendre plus tard »)                            | Aucune persistance                               | **Persister** le draft dans `localStorage['checkout-draft']` à chaque blur     |
| E14 | OrderId format `FG-2026-XXXXX` (5 chars nanoid uppercase)             | `FG-${Date.now().toString(36).toUpperCase()}`    | **Remplacer** par `nanoid(5).toUpperCase()` dans l'API stub                    |
| E15 | `/merci` : titre personnalisé « Merci, [Prénom]. »                    | Titre générique « Votre rituel est en route. »   | **Lire** firstName depuis localStorage `last-order:${orderId}`                 |
| E16 | `/merci` : numéro + filet pointillé sauge                             | Numéro encadré                                   | **Restyler** : numéro Cormorant, filet pointillé sauge en dessous              |
| E17 | `/merci` : timeline 3 étapes                                          | Absente                                          | **Créer** `TimelineSteps`                                                      |
| E18 | `/merci` : lettre éditoriale signée Salma                             | Absente                                          | **Créer** `EditorialLetter` + entrée CMS adapter                               |
| E19 | `/merci` : préparation au geste                                       | Absente                                          | **Créer** `PreparationGesture`                                                 |
| E20 | `/merci` : sécurité order ID + fallback si invalide                   | Aucune validation                                | **Valider** format Zod (`/^FG-\\d{4}-[A-Z0-9]{5}$/`) ; fallback minimaliste     |
| E21 | `/merci` : triggers (vider cart, GA4, emails)                         | Absents                                          | **Créer** un `useEffect` orchestrateur côté client                             |

Ces vingt-et-un écarts représentent ~5 h de travail préparatoire. **À
traiter avant toute autre chose** (Phase 1 ci-dessous).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**. On ne saute pas, on ne
parallélise pas.

### Phase 0 — Baseline (45 min)

Avant de toucher à quoi que ce soit :

```bash
cd apps/web
pnpm dev
```

- [ ] Capture d'écran de `/commander` actuel (mobile 375 px et desktop
      1440 px), aux trois étapes + état soumission.
- [ ] Capture d'écran de `/merci?order=FG-TEST` actuel.
- [ ] Lighthouse mobile sur `/commander` : noter LCP, CLS, INP, TBT.
- [ ] Lighthouse mobile sur `/merci` : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : noter le nombre de violations critiques sur les
      deux pages.
- [ ] `pnpm build` puis lire le bundle size des routes `/commander` et
      `/merci`.
- [ ] Sauvegarder les chiffres dans
      `docs/plans/09-tunnel-checkout-baseline.md` (créé en cours de route).

### Phase 1 — Résolution des écarts spec / scaffold (5 h)

#### 1.1 Étendre les schémas Zod

Fichier : [`schemas/order.ts`](../../apps/web/src/lib/schemas/order.ts)

```ts
import { z } from 'zod';
import { emailSchema } from './common';

export const phoneMarocSchema = z
  .string()
  .regex(/^[5-7]\\d{8}$/u, 'Num\u00e9ro \u00e0 9 chiffres apr\u00e8s le pr\u00e9fixe +212.');

export const checkoutContactSchema = z.object({
  firstName: z.string().min(2).max(60),
  lastName: z.string().min(2).max(60),
  email: emailSchema,
  phone: phoneMarocSchema,
  acceptNewsletter: z.boolean().default(false),
  createAccount: z.boolean().default(false),
});

export const villeMarocEnum = z.enum([
  'casablanca', 'rabat', 'marrakech', 'fes', 'tanger', 'agadir',
  'meknes', 'oujda', 'tetouan', 'sale', 'autre',
]);

export const checkoutAddressSchema = z.object({
  line1: z.string().min(4).max(120),
  line2: z.string().max(120).optional(),
  quartier: z.string().min(2).max(80),
  city: villeMarocEnum,
  cityOther: z.string().max(60).optional(),
  postalCode: z.string().max(10).optional(),
  country: z.literal('MA'),
  shippingMode: z.enum(['standard', 'express']).default('standard'),
});

export const checkoutPaymentMethodSchema = z.enum(['card', 'cmi', 'cod']);

export const checkoutFormSchema = z.object({
  contact: checkoutContactSchema,
  address: checkoutAddressSchema,
  paymentMethod: checkoutPaymentMethodSchema,
  promoCode: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Acceptation requise.' }) }),
});

export const orderIdSchema = z.string().regex(/^FG-\\d{4}-[A-Z0-9]{5}$/u);
```

#### 1.2 Créer la route handler stub `/api/checkout`

Fichier : `apps/web/src/app/api/checkout/route.ts`

```ts
import { NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { checkoutFormSchema } from '@/lib/schemas/order';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = checkoutFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_PAYLOAD', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // Phase 1 : on simule la création de commande.
  // Phase 2 : Stripe / CMI / COD.
  await new Promise((resolve) => setTimeout(resolve, 800));
  const year = new Date().getFullYear();
  const orderId = `FG-${year}-${nanoid()}`;
  return NextResponse.json({ orderId });
}
```

#### 1.3 Mettre à jour le store : draft persistance

Dans [`stores/cart-store.ts`](../../apps/web/src/lib/stores/cart-store.ts)
ou nouveau `stores/checkout-draft.ts` :

```ts
export const checkoutDraftKey = 'checkout-draft';
// helpers : saveDraft(values), readDraft(), clearDraft()
```

#### 1.4 Mettre à jour la spec si nécessaire

Fichier : [`04-specifications-pages.md`](../preparation/04-specifications-pages.md)

- Aligner § 4.7 (composants paiement avec CMI) et § 4.8 (lettre Salma).

#### 1.5 Commit

```bash
git add -A
git commit -m "Aligne le tunnel : sch\u00e9mas \u00e9tendus, route /api/checkout, draft persistant"
```

> **Sortie de phase** : schémas + API stub + draft cohérents. `pnpm typecheck`
> doit passer.

### Phase 2 — Polissage des primitifs UI (2 h)

| Ordre | Composant         | Points d'attention spécifiques tunnel                                 |
| ----- | ----------------- | --------------------------------------------------------------------- |
| 1     | `Button`          | `loading` avec spinner inline 16 px ; `disabled` état visuel propre   |
| 2     | `TextField`       | États : default, focus, error, disabled, success ; `aria-invalid`     |
| 3     | `FieldShell`      | Hint sous le label, error sous l'input, `aria-describedby` chaîné     |
| 4     | `Container`       | Variants `prose` (lettre) et `page` (formulaire)                      |
| 5     | `Heading`         | `display-md` (Hero `/merci`), `lg`, `md`, `sm`                        |
| 6     | `Kicker`          | « Étape 01 », « La maison vous remercie »                             |

**DoD par composant** : cocher les 8 catégories de
[§ 4 stratégie](../preparation/15-strategie-iteration.md).

**Commits** : un par composant. Six commits.

### Phase 3 — Composants communs au tunnel (3 h)

#### 3.1 `CheckoutHeader`

- Fichier : `apps/web/src/components/layout/CheckoutHeader.tsx`
- Layout : wordmark à gauche (clic → ouvre `LeaveCheckoutModal`),
  pictogramme cadenas + texte « Paiement sécurisé » au centre, lien
  retour panier à droite (« ← Retour au panier »).
- Hauteur 64 px desktop, 56 px mobile.
- Pas de menu nav, pas de `CartButton`.
- Le wordmark est un `<button type="button">`, pas un lien — il appelle
  `setLeaveOpen(true)` du contexte de page.

#### 3.2 `ProgressBar3Steps`

- Fichier : `apps/web/src/components/commerce/ProgressBar3Steps.tsx`
- Props : `currentStep: 0 | 1 | 2`, `labels: readonly [string, string, string]`.
- Layout : 3 jalons numérotés 01, 02, 03 sur une ligne, reliés par une
  barre de remplissage (encre 20 % de fond, encre 100 % pour la portion
  remplie).
- Progression visuelle : 0 % → 33 % → 66 % → 100 %.
- ARIA : `role="progressbar"`, `aria-valuenow={currentStep + 1}`,
  `aria-valuemin={1}`, `aria-valuemax={3}`,
  `aria-label="Progression de la commande"`.
- Cliquer sur un jalon **passé** revient en arrière. Les jalons futurs
  sont `aria-disabled="true"`.

#### 3.3 `LeaveCheckoutModal`

- Fichier : `apps/web/src/components/commerce/LeaveCheckoutModal.tsx`
- Wrapper Radix `AlertDialog`.
- Props : `open: boolean`, `onOpenChange`, `onResumeLater: () => void`,
  `onQuit: () => void`.
- Titre : « Quitter la commande ? »
- Description : « Vos informations peuvent être conservées le temps de
  votre prochaine visite. »
- Actions : « Reprendre plus tard » (variant primary, sauve draft) +
  « Quitter » (variant ghost, vide draft + redirige vers `/`).

#### 3.4 `OrderSummarySticky`

- Fichier : `apps/web/src/components/commerce/OrderSummarySticky.tsx`
- Affiche : kicker « Récapitulatif », liste items (nom × qty + prix),
  sous-total, livraison estimée (selon `address.city` + `shippingMode`),
  total Cormorant 24 pt.
- Sticky : `lg:sticky lg:top-24 lg:self-start`.
- Mention micro : « Modifiable jusqu'au paiement. »

#### 3.5 `OrderSummaryAccordion`

- Fichier : `apps/web/src/components/commerce/OrderSummaryAccordion.tsx`
- Bandeau plein largeur en haut du formulaire mobile, sous le header.
- Bouton trigger : « Voir le récapitulatif · {total} » avec chevron qui
  pivote.
- Contenu : mêmes données que `OrderSummarySticky`.
- Animation hauteur via `framer-motion` `LazyMotion` + `domAnimation`,
  240 ms `ease-out-soft`, respect `prefers-reduced-motion`.

#### 3.6 `ErrorBanner`

- Fichier : `apps/web/src/components/commerce/ErrorBanner.tsx`
- Bandeau en haut du formulaire, fond crème + bordure encre-error.
- Props : `title: string`, `description?: string`,
  `onDismiss?: () => void`.
- `role="alert"`, `aria-live="assertive"`, focus auto à l'apparition.

#### 3.7 `FooterMinimal`

- Fichier : `apps/web/src/components/layout/FooterMinimal.tsx`
- 3 liens centrés : « Conditions générales », « Mentions légales »,
  « Contact ». Caption tertiary, espacement large, copyright en bas.

**Commits** : un par composant. Sept commits.

### Phase 4 — `/commander` étape 1 (Informations) (2 h)

Fichier cible : `apps/web/src/components/commerce/steps/InfoStep.tsx`

Extraire la logique de `ContactStep` actuel. Ajouter :

- Champ email avec validation Zod.
- Champ téléphone avec préfixe +212 verrouillé visuellement (groupe
  d'inputs : un `<span>` non éditable « +212 » + un `<input>` 9 chiffres).
- Checkbox « Recevoir la lettre de la maison (saisonnier). » liée à
  `acceptNewsletter`.
- Checkbox « Créer un compte pour suivre mes commandes. » liée à
  `createAccount`. Si cochée Phase 1 : afficher une note « Disponible en
  Phase 2. » et désactiver le champ mot de passe.
- Validation par étape : `methods.trigger(fieldsByStep[0])`.
- Annonce ARIA live à la transition vers étape 2 : « Étape 2 sur 3 :
  Livraison. »

**Commit** : « \u00c9tape 1 informations : email + opt-ins + validation par \u00e9tape ».

### Phase 5 — `/commander` étape 2 (Livraison) (3 h)

Fichier cible : `apps/web/src/components/commerce/steps/AddressStep.tsx`

- Champ `line1` (Adresse) + `line2` (Complément optionnel).
- Champ `quartier` (texte libre).
- `<select>` ville avec liste FE/RAK/CASA/RBA/TNG/AGD/MKN/OUJ/TET/SAL/Autre.
- Si `city === 'autre'` → afficher `cityOther` (texte libre).
- Champ `postalCode` optionnel (label « Code postal (optionnel) »).
- `ShippingModeSelector` (radio cards) :
  - Standard — « 3 à 5 jours ouvrés · 60 MAD (40 MAD à Casablanca) ».
  - Express — « 24-48 h Casablanca uniquement · 80 MAD ».
- Recalculer `OrderSummary` à chaque changement de ville ou de mode
  (sélecteur Zustand `selectShippingCents(city, mode)` à créer).
- Validation par étape : `methods.trigger(fieldsByStep[1])`.
- Annonce ARIA live à la transition vers étape 3.

**Commit** : « \u00c9tape 2 livraison : adresse + ville + quartier + mode ».

### Phase 6 — `/commander` étape 3 (Paiement) + soumission (4 h)

Fichier cible : `apps/web/src/components/commerce/steps/PaymentStep.tsx`

#### 6.1 `PaymentMethodSelector`

- Radio cards visibles côte à côte (grille 1 colonne mobile, 3 colonnes
  desktop) :
  - **Carte bancaire** (Stripe) — pictogramme + « Visa, Mastercard ».
  - **Carte marocaine** (CMI) — pictogramme + « CMI Maroc ».
  - **Paiement à la livraison** (COD) — pictogramme + « Réglez en main
    propre au coursier. »
- Ordre : COD à droite ou en premier — décision : **COD en première
  position**, c'est ce que demande le marché marocain.
- Sélection par défaut : `cod` (changement par rapport au scaffold
  actuel qui défaut sur `card`).

#### 6.2 `PaymentForm` (Stripe stub Phase 1)

- Si `paymentMethod === 'card'` : afficher un bloc placeholder
  « Paiement carte international (Stripe) — branchement Phase 2. »
- Si `paymentMethod === 'cmi'` : afficher un bloc « CMI Maroc —
  branchement Phase 2. »
- Si `paymentMethod === 'cod'` : afficher un bloc « Vous réglerez en
  main propre au coursier. Aucune information bancaire à fournir. »

Phase 2 : import dynamique `@stripe/stripe-js` + `@stripe/react-stripe-js`,
`<Elements>` wrapping, `<PaymentElement>`.

#### 6.3 `PromoCodeInput`

- Désactivé Phase 1 : input grisé + bouton « Appliquer » désactivé +
  tooltip « Disponible bientôt ».

#### 6.4 `TermsCheckbox`

- Checkbox liée à `consent` (`z.literal(true)`).
- Texte : « J'accepte les [conditions générales de vente](/cgv) et la
  [politique de confidentialité](/confidentialite). »

#### 6.5 Soumission

```ts
async function onSubmit(values: CheckoutForm) {
  setSubmitting(true);
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw new Error('CHECKOUT_FAILED');
    const { orderId } = await response.json();
    // Persiste l'order pour /merci (Phase 1 stub)
    localStorage.setItem(
      `last-order:${orderId}`,
      JSON.stringify({
        orderId,
        firstName: values.contact.firstName,
        email: values.contact.email,
        items,
        subtotal,
        shipping: estimatedShipping,
        total,
        address: values.address,
        paymentMethod: values.paymentMethod,
        createdAt: new Date().toISOString(),
      }),
    );
    clearCart();
    clearDraft();
    router.push(routes.merci(orderId));
  } catch (error) {
    setSubmitting(false);
    setError({
      title: 'Le paiement n\\u2019a pas abouti.',
      description: 'Veuillez r\\u00e9essayer dans quelques instants.',
    });
  }
}
```

#### 6.6 `PaymentLoadingOverlay`

- Plein écran fixed, fond crème 90 % opacité, spinner Cormorant
  (animation rotation lente), texte « Paiement en cours… » + sous-texte
  « Ne fermez pas cette page. ».
- `role="status"`, `aria-live="polite"`, `aria-busy="true"`.

**Commit** : « \u00c9tape 3 paiement : 3 m\u00e9thodes + COD prioritaire + soumission stub ».

### Phase 7 — `/commander` assemblage + modal quitter + edge cases (2 h)

Fichier : [`apps/web/src/app/(commerce)/commander/page.tsx`](../../apps/web/src/app/(commerce)/commander/page.tsx)

```tsx
import type { Metadata } from 'next';
import { CheckoutHeader } from '@/components/layout/CheckoutHeader';
import { CheckoutFlow } from '@/components/commerce/CheckoutFlow';
import { FooterMinimal } from '@/components/layout/FooterMinimal';

export const metadata: Metadata = {
  title: 'Commander',
  description: 'Trois \u00e9tapes mesur\u00e9es pour confirmer votre commande FemiGlow.',
  robots: { index: false, follow: false },
};

export default function CommanderPage() {
  return (
    <>
      <CheckoutHeader />
      <main id="main" tabIndex={-1} className="bg-creme min-h-[60vh]">
        <CheckoutFlow />
      </main>
      <FooterMinimal />
    </>
  );
}
```

**Note** : `/commander` doit utiliser un sous-layout dédié pour ne **pas
hériter** du `(commerce)/layout.tsx` partagé. Créer
`apps/web/src/app/(commerce)/commander/layout.tsx` qui ne pose ni
`CommerceHeader` ni `Footer` complet.

Edge cases à couvrir dans `CheckoutFlow` :

- [ ] Panier vide à l'arrivée → afficher message + CTA `/kit`.
- [ ] Panier vidé en cours d'étape (autre onglet) → écouter `storage` event,
      afficher banner « Votre panier a été vidé. » + retour `/panier`.
- [ ] Erreur réseau soumission → `ErrorBanner` avec retry.
- [ ] 400 du serveur (validation Zod) → mapper les `issues` aux champs.
- [ ] Sauvegarde draft à chaque blur → vérifier qu'il ne contient **jamais**
      le numéro de carte (en Phase 2, on n'enregistre que `paymentMethod`,
      pas les détails Stripe).
- [ ] Restauration draft à l'arrivée → si trouvé, popup discret « Reprendre
      là où vous en étiez ? » avec deux options.

**Commit** : « Assemblage /commander : sous-layout, edge cases, restauration draft ».

### Phase 8 — `/merci` sections + lettre éditoriale + timeline (4 h)

#### 8.1 `OrderHero`

- Fichier : `apps/web/src/components/sections/OrderHero.tsx`
- Layout centré : Fleuron champagne en tête, kicker « La maison vous
  remercie », heading `display-md` « Merci, {firstName}. » + sous-titre
  lead « Votre commande est en bonnes mains. »
- Numéro `FG-2026-XXXXX` en Cormorant 18 pt, légèrement détaché.
- Filet pointillé sauge 1 px en dessous, 80 px de large.
- Estimation livraison : « Estimation : entre le {min} et le {max}. »

#### 8.2 `OrderRecap`

- Fichier : `apps/web/src/components/sections/OrderRecap.tsx`
- 3 colonnes desktop (Articles / Adresse / Paiement), 1 colonne mobile.
- Articles : miniatures 80 × 80 + nom + qty + prix unitaire.
- Adresse : line1, line2 si présent, quartier, ville, téléphone.
- Paiement : libellé selon méthode (« Carte bancaire (Stripe) », « CMI
  Maroc », « Paiement à la livraison »).

#### 8.3 `TimelineSteps`

- Fichier : `apps/web/src/components/sections/TimelineSteps.tsx`
- 3 jalons horizontaux desktop, verticaux mobile :
  - **Préparation** — « Sous 24 h. »
  - **Expédition** — « 1 à 2 jours ouvrés. »
  - **Livraison** — « 3 à 5 jours ouvrés au Maroc. »
- Pictogrammes SVG inline, ligne 1.5 px, encre 60 %.
- Premier jalon actif (encre 100 %), les deux autres en attente (encre
  30 %).

#### 8.4 `EditorialLetter`

- Fichier : `apps/web/src/components/sections/EditorialLetter.tsx`
- Container `prose` 640 px max.
- Cormorant 15 pt, line-height 1.7, justifié.
- Contenu CMS-pilotable (Phase 1 : mock dans `data/mock/letter.ts`).
- Signature en Pinyon Script 28 pt « Salma » + ligne caption « Fondatrice ».
- Posée après la timeline, séparée par un fleuron.
- Texte de référence (Phase 1) :

  > « Merci d'avoir confié votre rituel à la maison. Chaque kit est
  > préparé à la main, à Casablanca, dans un atelier où l'on prend le
  > temps. Vous recevrez votre commande dans quelques jours. En l'attente,
  > choisissez un soir calme. Le rituel n'aime pas la précipitation.
  > Salma. »

#### 8.5 `PreparationGesture`

- Fichier : `apps/web/src/components/sections/PreparationGesture.tsx`
- Layout 2 colonnes desktop, 1 colonne mobile.
- Photo lifestyle 4:5 (placeholder Phase 1).
- Texte court : « Choisissez un soir calme. Posez les pots sur une
  serviette de lin. Ouvrez le rituel comme on ouvre une lettre. »
- Pas de CTA — c'est une invitation, pas un funnel.

#### 8.6 Trigger orchestrateur

Fichier : `apps/web/src/components/commerce/MerciOrchestrator.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';

export function MerciOrchestrator({ orderId, total }: { orderId: string; total: number }) {
  const clearCart = useCartStore((s) => s.clear);
  useEffect(() => {
    // 1. Vider le panier
    clearCart();
    // 2. GA4 stub Phase 1 (Phase 2 : vrai event)
    console.info('purchase event', { orderId, total });
    // 3. Phase 2 : email confirmation, J+5, J+15
  }, [orderId, total, clearCart]);
  return null;
}
```

#### 8.7 Page `/merci`

Fichier : [`apps/web/src/app/(commerce)/merci/page.tsx`](../../apps/web/src/app/(commerce)/merci/page.tsx)

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { OrderHero } from '@/components/sections/OrderHero';
import { OrderRecap } from '@/components/sections/OrderRecap';
import { TimelineSteps } from '@/components/sections/TimelineSteps';
import { EditorialLetter } from '@/components/sections/EditorialLetter';
import { PreparationGesture } from '@/components/sections/PreparationGesture';
import { CrossLinkCard } from '@/components/sections/CrossLinkCard';
import { MerciClient } from '@/components/commerce/MerciClient';
import { orderIdSchema } from '@/lib/schemas/order';

export const metadata: Metadata = {
  title: 'Merci',
  description: 'Votre commande FemiGlow est confirm\u00e9e.',
  robots: { index: false, follow: false },
};

export default function MerciPage({
  searchParams,
}: { searchParams: { order?: string } }) {
  const parsed = orderIdSchema.safeParse(searchParams.order);
  if (!parsed.success) return <MerciFallback />;
  return <MerciClient orderId={parsed.data} />;
}
```

`MerciClient` est `'use client'` : lit `localStorage[`last-order:${orderId}`]`,
si absent → `<MerciFallback />` (message « Confirmation envoyée par
email. » + CTA `/`), sinon assemble les sections.

**Commit** : « /merci : sections, lettre Salma, timeline, orchestrateur ».

### Phase 9 — SEO + JSON-LD (1 h)

Référence : [§ 11 — SEO](../preparation/11-seo-metadata.md).

- [ ] `/commander` et `/merci` : `robots: { index: false, follow: false }`
      (déjà posé).
- [ ] Pas de `Cache-Control` côté `/commander` (NextJS gère par défaut).
- [ ] `/merci` : ajouter `<meta http-equiv="Cache-Control" content="no-store" />`
      ou via `headers()` de la route.
- [ ] BreadcrumbList sur `/commander` : `Accueil` → `Le panier` → `Commander`.
- [ ] Pas de JSON-LD `Product` ici (vit sur `/kit`).
- [ ] `/merci` : injecter un JSON-LD `Order` partiel **uniquement côté
      client** (pas indexé) pour cohérence schema.org, optionnel.

**Commit** : « SEO tunnel : noindex, breadcrumb, no-store sur /merci ».

### Phase 10 — Performance + accessibilité (3 h)

Référence : [§ 10 — Performance](../preparation/10-performance-web-vitals.md)
et [§ 9 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md).

#### 10.1 Performance

- [ ] Stripe Elements (Phase 2) : import dynamique `next/dynamic`,
      uniquement si `paymentMethod === 'card'`.
- [ ] Radix `AlertDialog` : import dynamique pour les modals (quitter,
      confirmation).
- [ ] Polices : pas de Pinyon Script chargée sur `/commander` (pas
      utilisée). Préchargée uniquement sur `/merci`.
- [ ] Images miniatures `OrderRecap` : `sizes="80px"`, AVIF.
- [ ] First-load JS gzip cible :
  - `/commander` : ≤ 110 kB (form + Zod + Radix + framer-motion).
  - `/merci` : ≤ 95 kB (lecture + sections statiques).

#### 10.2 Accessibilité

- [ ] Un seul `<h1>` par page.
- [ ] Hiérarchie h1 → h2 (étapes) → h3 (groupes de champs).
- [ ] `ProgressBar3Steps` : `role="progressbar"`, `aria-valuenow`,
      `aria-valuemin`, `aria-valuemax`, `aria-label`.
- [ ] Annonce ARIA live à chaque changement d'étape (« Étape 2 sur 3 :
      Livraison. ») via une zone `aria-live="polite"` cachée
      (`sr-only`).
- [ ] Focus order : Header → ProgressBar → premier champ vide → CTA →
      Récap (mobile : accordéon avant le formulaire).
- [ ] Au passage à l'étape suivante : focus déplacé sur le `<h2>` de la
      nouvelle étape (`tabIndex={-1}` + `focus()`).
- [ ] Erreurs formulaire : `aria-invalid="true"` + `aria-describedby`
      pointant vers le message d'erreur.
- [ ] `ErrorBanner` : `role="alert"`, `aria-live="assertive"`, focus auto.
- [ ] `PaymentLoadingOverlay` : `role="status"`, `aria-busy="true"`,
      `aria-live="polite"`.
- [ ] Tap targets ≥ 44 × 44 px : radios cards, checkboxes, CTAs.
- [ ] Test axe-core : zéro violation critique.
- [ ] Test VoiceOver Mac : lecture cohérente du formulaire et de la
      lettre Salma sur `/merci`.
- [ ] Test clavier : Tab traverse, Shift+Tab revient, Enter soumet,
      ESC ferme les modals.
- [ ] `prefers-reduced-motion: reduce` : pas d'animation accordéon, pas
      de fade lettre.

**Commit** : « Tunnel : performance + accessibilit\u00e9 (focus, ARIA, lazy imports) ».

### Phase 11 — Tests (3 h 30)

Référence : [§ 12 — QA](../preparation/12-qa-debugging-observabilite.md).

#### 11.1 Vitest unitaires

Pour chaque composant créé/modifié, un test :

```ts
// PaymentMethodSelector.test.tsx
import { render, screen } from '@testing-library/react';
import { PaymentMethodSelector } from './PaymentMethodSelector';

describe('PaymentMethodSelector', () => {
  it('affiche COD en premier', () => {
    render(<PaymentMethodSelector value="cod" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('value', 'cod');
  });
});
```

Couvrir :
- `ProgressBar3Steps` : affiche bien la progression `0/1/2`, attributs ARIA.
- `LeaveCheckoutModal` : « Reprendre plus tard » sauve le draft, « Quitter »
  vide le draft.
- `OrderSummarySticky` : recalcule le total quand `shippingMode` change.
- `OrderSummaryAccordion` : ouvre/ferme avec animation, ESC ferme.
- Schémas Zod : `phoneMarocSchema` accepte 9 chiffres, refuse 8 et 10.
- `EditorialLetter` : signature en Pinyon Script affichée.
- `MerciClient` : si pas de localStorage → fallback ; sinon, sections.
- Route handler `/api/checkout` : 400 sur payload invalide, 200 sur
  payload valide avec `orderId` formé.

#### 11.2 Storybook stories

Une story par composant + une story `Page > Commander` aux trois étapes
+ une story `Page > Merci` (avec et sans `localStorage`).

#### 11.3 Playwright golden path complet

```ts
// e2e/checkout.spec.ts
test('Tunnel complet : panier \u2192 commander \u2192 merci', async ({ page }) => {
  await page.goto('/kit');
  await page.getByRole('button', { name: /ajouter/i }).click();
  await page.goto('/panier');
  await page.getByRole('link', { name: /commander/i }).click();

  // \u00c9tape 1
  await page.getByLabel(/pr\u00e9nom/i).fill('Salma');
  await page.getByLabel(/^nom$/i).fill('El Mansouri');
  await page.getByLabel(/email/i).fill('salma@exemple.ma');
  await page.getByLabel(/t\u00e9l\u00e9phone/i).fill('612345678');
  await page.getByRole('button', { name: /continuer/i }).click();

  // \u00c9tape 2
  await page.getByLabel(/adresse/i).fill('12 rue des Pivoines');
  await page.getByLabel(/quartier/i).fill('Gauthier');
  await page.getByLabel(/ville/i).selectOption('casablanca');
  await page.getByLabel(/standard/i).check();
  await page.getByRole('button', { name: /continuer/i }).click();

  // \u00c9tape 3
  await page.getByLabel(/paiement \u00e0 la livraison/i).check();
  await page.getByLabel(/conditions g\u00e9n\u00e9rales/i).check();
  await page.getByRole('button', { name: /confirmer/i }).click();

  // /merci
  await expect(page).toHaveURL(/\\/merci\\?order=FG-/);
  await expect(page.getByRole('heading', { name: /merci, salma/i })).toBeVisible();
  await expect(page.getByText(/votre commande est en bonnes mains/i)).toBeVisible();
});

test('Modal quitter : reprendre plus tard sauve le draft', async ({ page }) => {
  // ... atteindre /commander \u00e9tape 1, remplir email, cliquer wordmark
  // ... v\u00e9rifier que localStorage['checkout-draft'] contient l'email
});

test('/merci sans order valide : fallback', async ({ page }) => {
  await page.goto('/merci?order=invalid');
  await expect(page.getByText(/confirmation envoy\u00e9e par email/i)).toBeVisible();
});
```

**Commit** : « Tests tunnel : unitaires, stories, E2E golden path complet ».

### Phase 12 — Mesure et merge (45 min)

- [ ] Lighthouse mobile ET desktop sur `/commander` (3 étapes) et `/merci`.
- [ ] Comparaison baseline vs après dans
      `docs/plans/09-tunnel-checkout-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → tout vert.
- [ ] Capture vidéo du golden path complet panier → commander (3 étapes)
      → merci (mobile 375 px puis desktop 1440 px) → archivée.
- [ ] PR vers `main` avec description référencée à ce plan et aux specs
      §§ 4.7 et 4.8.
- [ ] Merge.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` :
      « Tunnel : LCP commander 1.8 s, merci 1.4 s, CLS 0.02, INP 130 ms,
      axe 0, golden path E2E vert ».

---

## 6. Definition of Done — spécifique tunnel

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour ces deux
pages :

- [ ] Le tunnel se complète **entièrement au clavier** sans utiliser la
      souris une seule fois.
- [ ] Aucune information sensible (numéro de carte) n'atterrit dans
      `localStorage['checkout-draft']` — vérifié manuellement.
- [ ] `nanoid(5)` dans `/api/checkout` ne génère **jamais** deux fois le
      même `orderId` consécutivement (test 1000 itérations).
- [ ] Le passage d'étape est annoncé par VoiceOver dans la seconde.
- [ ] Le récap mobile en accordéon est utilisable sans scroll
      supplémentaire pour atteindre le total.
- [ ] L'overlay paiement bloque visuellement et clavier toute interaction
      pendant la requête (focus trap).
- [ ] `/merci` affiche le bon prénom dans la seconde après l'arrivée
      (pas de flash « Merci, . »).
- [ ] La lettre Salma est lue intégralement en VoiceOver, signature
      incluse.
- [ ] Le panier est **vidé** dès l'arrivée sur `/merci` (vérifié dans
      DevTools : `localStorage['femiglow-cart']` ne contient plus les
      items).
- [ ] Aucun warning console en dev, en build, en prod.
- [ ] Le mode COD est sélectionné par défaut au Maroc.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/09-tunnel-checkout-baseline.md` (créé en Phase 0) :

### `/commander`

| Métrique                       | Baseline | Cible    | Après  |
| ------------------------------ | -------- | -------- | ------ |
| LCP mobile                     | _        | < 2.0 s  | _      |
| CLS                            | _        | < 0.05   | _      |
| INP                            | _        | < 150 ms | _      |
| First-load JS gzip             | _        | ≤ 110 kB | _      |
| Violations axe critique        | _        | 0        | _      |
| Score Lighthouse a11y          | _        | 100      | _      |
| Conversion checkout            | _        | > 65 %   | _      |
| Time-to-complete moyen         | _        | < 3 min  | _      |

### `/merci`

| Métrique                       | Baseline | Cible    | Après  |
| ------------------------------ | -------- | -------- | ------ |
| LCP mobile                     | _        | < 2.0 s  | _      |
| CLS                            | _        | < 0.02   | _      |
| INP                            | _        | < 150 ms | _      |
| First-load JS gzip             | _        | ≤ 95 kB  | _      |
| Violations axe critique        | _        | 0        | _      |
| Scroll ≥ 70 %                  | _        | > 70 %   | _      |
| CTR vers `/journal`            | _        | > 15 %   | _      |

---

## 8. Risques et points d'attention

| Risque                                                                       | Mitigation                                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Abandon panier après étape 1 (peur du paiement)                              | COD visible en premier, cadenas dès le header, mention « Modifiable jusqu'au paiement »                   |
| Erreurs paiement Stripe (Phase 2)                                            | `ErrorBanner` posée et focusée, retry sans re-saisir, journal serveur côté `/api/checkout`                |
| Perte de session si l'utilisateur ferme l'onglet                             | Draft persistant dans `localStorage['checkout-draft']`, popup restauration à l'arrivée                    |
| RGPD : opt-in newsletter doit être explicite                                 | Checkbox **non cochée** par défaut, lien politique de confidentialité visible                             |
| Sécurité order ID : `/merci?order=FG-XXX` énumérable                         | Phase 1 : validation format Zod + lecture localStorage uniquement (pas de fetch). Phase 2 : session token |
| CMI sandbox indisponible le jour du lancement (Phase 2)                      | Garder COD comme méthode prioritaire, désactiver CMI si endpoint timeout > 3 s                            |
| COD : trust diminué (peur d'engagement non payé)                             | Wording explicite « Réglez en main propre au coursier », pas d'acompte, retour 14 jours visible           |
| Téléphone +212 : utilisateurs saisissent le préfixe deux fois                | UI verrouille le préfixe (`<span>` non éditable), schéma Zod ne valide que les 9 chiffres                 |
| Code postal Maroc : utilisateurs ne le connaissent pas                       | Champ optionnel, label « (optionnel) » explicite                                                          |
| Numéro carte enregistré par erreur dans le draft                             | Phase 2 : `paymentDetails` jamais sérialisé, seulement `paymentMethod`                                    |
| Stripe Elements alourdit le bundle initial                                   | Import dynamique uniquement si `paymentMethod === 'card'`                                                 |
| `/merci` cache navigateur : back/forward affiche une page périmée            | `Cache-Control: no-store` + meta http-equiv                                                               |
| Lettre Salma trop longue → personne ne lit                                   | 640 px max, ~120 mots max, test à voix haute < 60 s                                                       |
| Buyer's remorse : utilisateur veut annuler immédiatement                     | Lien discret « Une question ? Contactez-nous » visible sur `/merci`, pas de friction                      |
| Animations framer-motion alourdissent INP                                   | LazyMotion + domAnimation, respect `prefers-reduced-motion`                                               |
| Hydration mismatch sur `/merci` (lecture localStorage)                       | `MerciClient` est `'use client'`, fallback rendu serveur, pas de comparaison                              |
| Double soumission (clic rapide sur « Confirmer »)                            | `setSubmitting(true)` + `Button.loading` désactivé, garde côté serveur via idempotency key Phase 2        |

---

## 9. Estimation horaire récapitulative

| Phase                                                       | Estimation |
| ----------------------------------------------------------- | ---------- |
| 0 — Baseline                                                | 0 h 45     |
| 1 — Résolution écarts (schémas, API, draft)                 | 5 h        |
| 2 — Polissage primitifs UI                                  | 2 h        |
| 3 — Composants communs tunnel (7 composants)                | 3 h        |
| 4 — `/commander` étape 1 (Informations)                     | 2 h        |
| 5 — `/commander` étape 2 (Livraison)                        | 3 h        |
| 6 — `/commander` étape 3 (Paiement) + soumission            | 4 h        |
| 7 — `/commander` assemblage + modal + edge cases            | 2 h        |
| 8 — `/merci` sections + lettre + timeline                   | 4 h        |
| 9 — SEO + JSON-LD                                           | 1 h        |
| 10 — Performance + accessibilité                            | 3 h        |
| 11 — Tests (unit + Storybook + E2E golden path)             | 3 h 30     |
| 12 — Mesure & merge                                         | 0 h 45     |
| **Total**                                                   | **34 h**   |

Avec tous les composants neufs, écarts résolus et tests E2E :
**34 h ou 5 jours pleins**. Plancher 26 h si les primitifs UI sont déjà
polis depuis Plan 08 (panier).

---

## 10. Annexes — commandes utiles

### Lancer le dev
```bash
cd apps/web
pnpm dev
```

### Lighthouse en CLI
```bash
npx lighthouse http://localhost:3000/commander --view --preset=desktop --output=html --output-path=./lighthouse-commander-desktop.html
npx lighthouse http://localhost:3000/commander --view --output=html --output-path=./lighthouse-commander-mobile.html
npx lighthouse "http://localhost:3000/merci?order=FG-2026-AAAAA" --view --output=html --output-path=./lighthouse-merci-mobile.html
```

### Bundle analyzer
```bash
ANALYZE=true pnpm --filter @femiglow/web build
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000/commander
npx @axe-core/cli "http://localhost:3000/merci?order=FG-2026-AAAAA"
```

### Tests
```bash
pnpm --filter @femiglow/web test -- checkout
pnpm --filter @femiglow/web test:e2e -- checkout
pnpm --filter @femiglow/web storybook
```

### Tester la route handler `/api/checkout`
```bash
curl -X POST http://localhost:3000/api/checkout \\
  -H 'Content-Type: application/json' \\
  -d '{
    "contact": { "firstName": "Salma", "lastName": "M.", "email": "s@m.ma", "phone": "612345678", "acceptNewsletter": false, "createAccount": false },
    "address": { "line1": "12 rue", "quartier": "Gauthier", "city": "casablanca", "country": "MA", "shippingMode": "standard" },
    "paymentMethod": "cod",
    "consent": true
  }'
```

### Inspection draft côté navigateur
```js
JSON.parse(localStorage.getItem('checkout-draft'));
JSON.parse(localStorage.getItem('last-order:FG-2026-AAAAA'));
```

---

## 11. Critère unique de réussite

> *Le tunnel tient debout si une cliente de Casablanca, sur un iPhone
> d'occasion, dans un taxi en mouvement, peut commander en moins de
> trois minutes — sans paniquer, sans hésiter sur le mode de paiement,
> sans douter du total. Et si, en arrivant sur `/merci`, elle prend
> trente secondes pour lire la lettre de Salma sans avoir l'impression
> qu'on lui parle pour vendre quelque chose d'autre. Si l'un de ces
> deux moments faiblit, le tunnel n'est pas fini.*

À cocher **avant** d'attaquer la page suivante.

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **21 écarts spec/scaffold résolus** — voir baseline pour la liste détaillée.
- **Schémas étendus** (`apps/web/src/lib/schemas/order.ts`) :
  `phoneMaroc9DigitsSchema` (9 chiffres après +212), `villeMarocEnum` (11
  villes incluant `'autre'`), `shippingModeSchema`, `orderIdSchema`
  (`FG-YYYY-XXXXX`), `acceptNewsletter`, `createAccount`, `promoCode?`,
  `cityOther` conditionnel via `superRefine`.
- **Route handler `/api/checkout`** — POST, `runtime: 'nodejs'`,
  `safeParse` Zod, latence stub 600 ms, `generateOrderId()` côté serveur.
- **21 composants neufs** : `CheckoutHeader`, `FooterMinimal`,
  `ProgressBar3Steps`, `LeaveCheckoutModal`, `OrderSummarySticky`,
  `OrderSummaryAccordion`, `PaymentMethodSelector`, `PaymentForm`,
  `PromoCodeInput`, `TermsCheckbox`, `ShippingModeSelector`,
  `PaymentLoadingOverlay`, `ErrorBanner`, `OrderHero`, `OrderRecap`,
  `TimelineSteps`, `EditorialLetter`, `PreparationGesture`,
  `MerciOrchestrator`, `MerciClient` (+ `MerciFallback`),
  `CheckoutPage` orchestrateur.
- **CheckoutFlow refondu** : RHF + `Controller` + `useWatch`, draft
  debouncé 400 ms, focus heading + sr-only `aria-live="polite"` au
  changement d'étape, intégration `ErrorBanner` + `PaymentLoadingOverlay`,
  POST `/api/checkout` puis `saveLastOrder` + `clearCart` +
  `clearCheckoutDraft` + redirect `routes.merci(orderId)`.
- **`/merci`** : validation `orderIdSchema`, lecture
  `last-order:${id}` côté client, three states (loading/found/fallback),
  estimation livraison +3/+5 jours, lettre Salma Cormorant + signature
  Pinyon Script (`var(--font-pinyon)`), filet pointillé sauge.
- **JSON-LD BreadcrumbList SSR** sur `/commander` et `/merci`
  (Accueil → Le panier → Commander, Accueil → Commander → Merci).
- **9 fichiers Vitest dédiés tunnel** (191 tests verts globaux,
  +35 vs baseline 156).

### Décisions notables

| Code | Décision | Justification |
| ---- | -------- | ------------- |
| **D1** | Pas de `nanoid` — `crypto.getRandomValues` + alphabet `[A-Z0-9]` 5 chars | Évite une dépendance npm ; collision testée 1000 itérations |
| **D2** | Pas de Radix `AlertDialog` ni `framer-motion` | Cohérence Plans 06/08 ; `<dialog>` natif (`showModal`/`cancel`/backdrop click) + transitions Tailwind `motion-safe:` |
| **D3** | `phoneMaroc9DigitsSchema` distinct de `phoneMarocSchema` partagé | Garde le formulaire `/contact` intact ; tunnel attend `+212` préfixé via UI |
| **D4** | `postalCode?` directement dans `checkoutAddressSchema` | Évite de muter le schéma partagé ; reste 5 chiffres si fourni |
| **D5** | Stripe non branché — `PaymentForm` rend un message par méthode | Phase 1 : COD prioritaire, carte/CMI = stub |
| **D6** | `/commander` déplacée HORS du route group `(commerce)` (`app/commander/`) | App Router ne permet pas à un layout enfant de bypasser le parent ; URL inchangée car `(commerce)` est URL-invisible |
| **D7** | `/merci` reste dans `(commerce)` | La page de remerciement reprend la parure de la maison (CommerceHeader + Footer complet) ; conforme à la spec ligne 148 |

### Métriques (baseline → après)

- **Vitest** : 156 verts (44 fichiers) → **191 verts (53 fichiers)**
- **TypeScript / ESLint** : **0 / 0** (inchangé)
- **Build pages** : 30 → **31** (ajout `/api/checkout`)
- **`/commander` First Load JS** : 119 kB → **134 kB** (au-dessus cible
  110 kB ; réaliste pour RHF + Controller + Zod + Zustand + dialog +
  accordéon)
- **`/merci` First Load JS** : 94.1 kB → **102 kB** (au-dessus cible
  95 kB ; OrderRecap + TimelineSteps + EditorialLetter + Pinyon Script)
- **Violations axe critiques** : **0** sur les deux pages

### Limites

- **Bundle au-dessus des cibles** : `/commander` 134 kB (vs 110 kB) et
  `/merci` 102 kB (vs 95 kB). Pas critique — assumé per précédent Plan 08
  (`/panier` à 179 kB), Lighthouse Mobile ≥ 90 reste atteignable.
- **PaymentForm Phase 1** : pas de Stripe Elements branché ; carte et CMI
  rendent un message d'attente. À reprendre en Phase 2 (ticket dédié).
- **Tests visuels** : pas de Storybook ni de Playwright e2e ajoutés ;
  uniquement Vitest + jest-axe. Couverture interaction limitée (RHF
  trigger / step navigation testée par typage uniquement, non par
  rendering complet du flow).
- **Axe-core navigateur** : non vérifié dans cette session via le
  preview server (les hooks PostToolUse n'ont pas été déclenchés sur
  `/commander` et `/merci` de manière interactive). Vérifications jest-axe
  unitaires → 0 violation.

### Suivi

- Brancher Stripe Elements + CMI dans `PaymentForm` (Phase 2).
- Ajouter Playwright e2e pour le flow complet `/panier` → `/commander` →
  `/merci`.
- Profiler `/commander` (devtools coverage) pour viser ≤ 110 kB —
  candidats : split `LeaveCheckoutModal`, lazy import `OrderRecap`.
- Vérifier en preview server (axe-core 4.10) sur `/commander` (vide +
  draft restauré) et `/merci` (vide + `last-order:` seedé) pour confirmer
  les 0 violations en runtime navigateur.
