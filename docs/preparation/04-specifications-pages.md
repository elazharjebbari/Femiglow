# 04 — Spécifications de pages

> *Synthèse condensée des 9 pages B2C — pour la spécification narrative complète, se référer à `../pages/b2c/`*

---

## Conventions de lecture

Chaque fiche page liste : **rôle**, **sections** (ordre d'apparition), **composants utilisés**, **données requises**, **CTAs**, **KPIs cibles**.

Les composants en **gras** sont propres à la page ; les autres sont mutualisés (cf. `05-bibliotheque-composants.md`).

---

## 4.1 `/` — Accueil

**Rôle** : landing éditorial TOFU, dual path funnel (CTA primaire `/rituel`, secondaire scroll manifeste).

**Sections**
1. **Hero éditorial** (92vh) — vagues sauge + pétale, titre Cormorant 96pt, dual CTA
2. **Les cinq gestes** — 5 cards avec étiquettes circulaires colorées (numérotation 01..05)
3. **Le manifeste** — bandeau sauge pâle, fleuron, 3 lignes Cormorant Italic 28pt
4. **Avis d'initiées** — 3 cards photos mains + citation + signature « initiée depuis [date] »
5. **Le journal · extraits** — grille asymétrique 1 hero + 2 secondaires
6. **Newsletter** — bandeau sauge pâle, formulaire email

**Composants** : `Header`, `HeroAccueil`, `GesteCard`, `Manifeste`, `TestimonialCard`, `JournalGridAsymetric`, `NewsletterForm`, `Footer`, `Fleuron`

**Données requises**
```ts
interface AccueilPageData {
  hero: { title: string; tagline: string; ctas: CTA[] };
  gestes: GesteEtape[];           // 5 items (Préparer, Limer, Hydrater, Base, Sceller)
  manifeste: { lignes: string[] }; // 3 lignes
  avis: Testimonial[];             // 3 items
  journalExtraits: Article[];      // 3 items (1 hero + 2)
  // newsletter: pas de données — composant standalone
}
```

**CTAs**
- Primaire hero → `/rituel`
- Secondaire hero → scroll vers `#manifeste`
- Newsletter submit → API `/api/newsletter`
- Article click → `/journal/[slug]`

**KPIs** : bounce < 55 %, scroll ≥ 50 % > 60 % sessions, CTR CTA primaire > 12 %, taux newsletter > 3 %.

---

## 4.2 `/rituel` — Page narrative

**Rôle** : page éditoriale MOFU, durée lecture 3-5 min, construit la conviction lente vers `/kit`.

**Sections**
1. **Hero photo lifestyle** (86vh) — photo mains + pots, surtitre champagne « LE RITUEL », titre Cormorant 64pt
2. **L'origine japonaise** — narration éditoriale + photo sépia 1920s
3. **Les quatre gestes (vidéo)** — vidéo 90s slow motion autoplay muet, captions FR/AR
4. **Sciences du soin** — 3 micro-essais + schéma SVG ongle animé + sources académiques
5. **Témoignage d'une initiée** — interview Q/R format magazine
6. **Pivot vers le kit** — bandeau sauge clair pleine largeur, fleuron champagne, CTA encre
7. **Cross-link Journal** — 3 articles connexes

**Composants** : `Header`, `HeroLifestyle`, **`SectionNarrative`**, **`VideoPlayer4Gestes`**, **`SchemaSVG`**, **`InterviewQR`**, **`PivotBanner`**, `JournalGrid`, `Footer`, `ScrollProgress`

**Données requises**
```ts
interface RituelPageData {
  hero: { photo: Image; surtitre: string; title: string; tagline: string };
  origine: NarrativeSection;
  videoGestes: { src: { mp4: string; webm: string }; captions: { fr: string; ar: string } };
  sciences: { titre: string; essais: MicroEssai[]; sourcesAcademiques: string[] };
  interview: { questions: QAItem[] };
  pivotCTA: { phrase: string; cta: CTA };
  journalCross: Article[];
}
```

**CTAs** : aucun jusqu'à section 6 → `/kit` ; section 7 → 3 articles `/journal/[slug]`.

**KPIs** : temps moyen > 2:30, scroll ≥ 75 % > 50 %, watch rate vidéo ≥ 50 % > 40 %, CTR pivot → `/kit` > 25 %, bounce < 35 %.

---

## 4.3 `/kit` — Fiche produit pivot

**Rôle** : pivot BOFU, conversion add-to-cart, traite 9 risques perçus (Lantos 2011).

**Sections**
1. **Hero produit** — photo composition kit (4 pots), prix 320 MAD, dual CTA primaire (« Recevoir le rituel ») + secondaire (« Voir le rituel »), 3 réassurances
2. **Composition slow reveal** — 4 cards par produit (pâte, poudre, buffer, vernis fini)
3. **Vidéo des quatre gestes** — réutilisée de `/rituel`
4. **Composition détaillée** — tableaux ingrédients + concentrations + certifications
5. **Comparatif vernis vs rituel** — tableau honnête 2 colonnes
6. **FAQ contextuelle** — 8-10 accordéons
7. **Témoignages photos-mains** — 3-4 photos avant/après + citations
8. **CTA final + cross-link Journal**

**Composants** : `Header`, **`HeroProduit`**, **`ProductCard`**, `VideoPlayer4Gestes`, **`IngredientsTable`**, **`ComparatifTable`**, **`FAQAccordion`**, **`HandsTestimonialCarousel`**, **`StickyCartCTA`**, `JournalGrid`, `Footer`

**Données requises**
```ts
interface KitPageData {
  product: Product;                     // kit complet
  composition: Product[];               // 4 sub-products
  faq: FAQItem[];                       // 8-10
  comparatif: ComparatifData;           // colonnes Vernis vs Rituel
  testimonialsHands: HandsTestimonial[]; // 3-4
  videoSrc: VideoSource;
  reassurances: Reassurance[];          // 3 items (livraison, retour, paiement)
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: 'MAD';
  images: Image[];
  ingredients: Ingredient[];
  certifications: Certification[];
  volume?: string; // "15ml"
  inStock: boolean;
}
```

**CTAs** : « Recevoir le rituel » → `addToCart()` puis modal succès ou `/panier` ; sticky CTA visible toute scroll.

**KPIs** : add-to-cart > 12 %, time on page > 1:30, scroll ≥ 80 % > 45 %, bounce < 25 %.

---

## 4.4 `/journal` — Hub éditorial

**Rôle** : autorité éditoriale + SEO long-tail + capture email organique.

**Sections**
1. **Hero du journal** — titre Cormorant Italic « Le carnet de la maison. », fleuron, intro
2. **Article featured** — layout 60/40, badge « À LA UNE » champagne
3. **Filtre par catégories** — 6 pills (Toutes + 5 catégories)
4. **Grille des articles** — 3 cols desktop / 2 tablet / 1 mobile, 12 cards initiales
5. **Newsletter** — bandeau sauge pâle dédié
6. **Cross-link maison** — bandeau image + texte → `/maison` ou `/rituel`

**Composants** : `Header`, **`JournalHero`**, **`FeaturedArticle`**, **`CategoryPills`**, **`ArticleGrid`**, **`ArticleCard`**, **`LoadMoreButton`**, `NewsletterForm`, **`CrossLinkBanner`**, `Footer`

**Données requises**
```ts
interface JournalPageData {
  featured: Article | null; // si null → fallback dernier article
  articles: Article[];      // 12 initiaux
  hasMore: boolean;
  categories: Category[];   // 5 + "Toutes"
  filterActive: CategoryKey | 'all';
}

interface Article {
  slug: string;
  title: string;
  description?: string;
  category: 'maison' | 'saison' | 'voix' | 'matieres' | 'pratique';
  readingTimeMinutes: number;
  publishedAt: Date;
  featuredImage: Image;
  isFeatured: boolean;
  content?: string; // markdown — pour /journal/[slug]
  seo: SEOMeta;
}
```

**CTAs** : « Lire l'article → » sur featured et chaque card, « Voir d'autres articles » (pagination), « S'inscrire » newsletter.

**KPIs** : CTR articles > 35 %, taux newsletter > 28 %, durée moyenne 3-15 min selon profondeur.

---

## 4.5 `/maison` — Récit fondateur

**Rôle** : page institutionnelle MOFU, convertit visiteur en partisan avant achat.

**Sections**
1. **Hero éditorial** (92vh) — titre « La maison d'éclat. », tagline, CTA scroll « Découvrir l'atelier → »
2. **L'origine** — 2-3 paragraphes + photo lifestyle
3. **La fondatrice** — 2-3 paragraphes humanisation + photo mains
4. **L'atelier (Casablanca)** — adresse, ambiance, 3 photos lieu
5. **Les matières** — 4 mini-fiches (Cire d'abeille, Jojoba, Kaolin, Mica) avec Origine + Pourquoi
6. **Les quatre engagements** — 4 cards (Sourcing éthique, Sans vernis, Rituel lent, Local)
7. **Cross-link** — 3 cards → `/rituel`, `/journal`, `/kit`

**Composants** : `Header`, **`HeroMaison`**, **`SectionNarrative`** (réutilisé), **`AtelierGallery`**, **`MatiereCard`**, **`EngagementCard`** (= GesteCard variante), **`CrossLinkCard`**, `Footer`

**Données requises**
```ts
interface MaisonPageData {
  hero: HeroData;
  origine: NarrativeSection;
  fondatrice: NarrativeSection;
  atelier: { adresse: string; quartier: string; description: string[]; gallerie: Image[] };
  matieres: Matiere[];        // 4 items
  engagements: Engagement[];   // 4 items
  crossLinks: CrossLink[];     // 3 items
}
```

**CTAs** : « Découvrir l'atelier → » (scroll), 3 cross-links sortants.

**KPIs** : bounce < 50 %, scroll ≥ 90 % > 40 %, temps > 2:30, CTR cross-links > 5 % chacun.

---

## 4.6 `/panier` — Pre-checkout

**Rôle** : vérification, ajustement quantité, engagement vers `/commander`.

**Sections**
1. **Hero panier** — titre « Votre panier. », sous-titre count + total
2. **Liste articles** — `CartItem` cards (photo + nom + selector quantité + prix + supprimer)
3. **Récap & CTA** — sous-total + livraison estimée + total + bouton « Commander → » (sticky desktop)
4. **Trust signals** — 3 colonnes (livraison, retour, sécurité)
5. **Cross-link journal**
6. **État vide** (cas alternatif) — message + CTA `/kit`

**Composants** : `Header`, **`CartItem`**, **`QuantitySelector`**, **`CartSummary`**, **`ConfirmationModal`**, `TrustSignalBlock`, `CrossLinkCard`, **`EmptyCartState`**, `Footer`

**Données requises**
```ts
interface PanierPageData {
  cart: Cart;
  shippingEstimate?: ShippingEstimate; // selon ville si saisie
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  estimatedShipping: number;
  total: number;
  createdAt: Date;
  lastModified: Date;
}
```

**CTAs** : « Commander → » → `/commander`, « Continuer mes achats » → `/kit`, « Supprimer » → modal confirmation.

**KPIs** : conversion panier → checkout > 75 %, temps moyen 45 s.

---

## 4.7 `/commander` — Tunnel checkout

**Rôle** : la page la plus haute valeur du site, conversion finale.

**Sections**
1. **Header simplifié** — wordmark (modal quitter) + cadenas + lien retour panier
2. **Barre de progression** — 3 étapes
3. **Étape 1 — Informations** — email + opt-in newsletter + opt-in compte
4. **Étape 2 — Livraison** — adresse + quartier + ville + téléphone + mode (standard / express)
5. **Étape 3 — Paiement** — choix carte / COD + Stripe Elements + code promo + acceptation CGU
6. **Récap commande** — sticky desktop / accordéon mobile
7. **État chargement paiement** — overlay spinner
8. **Footer simplifié**

**Composants** : **`HeaderCheckout`**, **`ProgressBar3Steps`**, **`InfoForm`**, **`AddressForm`**, **`ShippingModeSelector`**, **`PaymentForm`** (Stripe), **`PromoCodeInput`**, **`TermsCheckbox`**, **`OrderSummarySticky`**, **`OrderSummaryAccordion`**, **`PaymentLoadingOverlay`**, **`ErrorBanner`**, `FooterMinimal`

**Données requises**
```ts
interface CommanderPageData {
  cart: Cart;
  user?: User;            // pré-rempli si connecté (V2)
  shippingOptions: ShippingOption[];
  paymentMethods: PaymentMethod[];
  stripePublicKey: string;
}

interface OrderDraft {
  email: string;
  acceptNewsletter: boolean;
  createAccount: boolean;
  password?: string;
  shippingAddress: Address;
  shippingMode: 'standard' | 'express';
  paymentMode: 'card' | 'cod';
  promoCode?: string;
  termsAccepted: boolean;
}
```

**CTAs** : « Continuer → » étapes 1 et 2 ; « Payer 320 MAD » étape 3 ; wordmark click → modal quitter.

**KPIs** : conversion checkout > 65 %, complétion 1→2 > 90 %, 2→3 > 85 %, 3→succès > 80 %, time-to-complete < 3 min, erreurs paiement < 3 %.

---

## 4.8 `/merci` — Post-achat

**Rôle** : moment unique de bascule transaction → relation, désamorce buyer's remorse.

**Sections**
1. **Header standard**
2. **Hero remerciement** — fleuron champagne + titre personnalisé « Merci, [Prénom]. » + sous-titre « Votre commande est en bonnes mains. » + numéro FG-2026-XXXXX + filet pointillé sauge + livraison estimée
3. **Récap commande** — image produit + détails + adresse + paiement
4. **Suivi & étapes** — 3 étapes timeline (Préparation → Expédition → Livraison)
5. **Lettre éditoriale** — signée Salma, Cormorant 15pt, 640px max
6. **Préparation au geste** — photo lifestyle + texte court
7. **Cross-links** — 2 cards (`/journal`, `/maison`)
8. **Footer**

**Composants** : `Header`, **`OrderHero`**, **`OrderRecap`**, **`TimelineSteps`**, **`EditorialLetter`**, **`PreparationGesture`**, `CrossLinkCard`, `Footer`, `Fleuron`

**Données requises**
```ts
interface MerciPageData {
  order: Order;        // commande complète
  customer: { firstName?: string; email: string };
  estimatedDelivery: { min: Date; max: Date };
  letter: EditorialLetter; // contenu CMS-pilotable
  recommendedArticles: Article[]; // 1-2
}
```

**Sécurité** : `/merci?order=FG-XXXXX` requiert session valide. `Cache-Control: no-store`. Redirection `/` si pas de token.

**Triggers** : à l'arrivée → vider panier, envoyer email confirmation, planifier emails J+5/J+15, GA4 event `purchase`.

**KPIs** : scroll > 70 %, CTR `/journal` > 15 %, retour site J+7 > 30 %, buyer's remorse < 1.5 %.

---

## 4.9 `/contact` — Pont conversationnel

**Rôle** : point d'accès transverse B2C avant/après achat + B2B.

**Sections**
1. **Hero accueil** — titre « Contact. », sous-titre interrogatif, email cliquable `contact@femiglow.ma`
2. **Coordonnées directes** — email + adresse atelier Casablanca + filet sauge
3. **Formulaire** — sélecteur type (3 options) + champs adaptatifs + RGPD checkboxes
4. **FAQ courte** — 4 accordéons max
5. **Cross-links** — 2-3 liens contextuels
6. **État succès / erreur** — modal ou page `/contact?sent=1`

**Composants** : `Header`, **`ContactHero`**, **`DirectContactBlock`**, **`FormTypeSelector`**, **`ContactForm`** (avec champs conditionnels), `FAQAccordion`, **`SuccessState`**, **`ErrorState`**, `Footer`

**Données requises**
```ts
interface ContactPageData {
  faqs: FAQItem[];        // 4 items
  defaultType?: ContactType; // depuis ?type=order
}

interface ContactSubmission {
  type: 'question' | 'order' | 'professional';
  name: string;
  email: string;
  phone?: string;       // requis si type=professional
  orderNumber?: string; // requis si type=order
  companyName?: string; // requis si type=professional
  role?: string;        // requis si type=professional
  message: string;
  gdprConsent: boolean;
  newsletterOptIn: boolean;
  recaptchaToken: string;
}
```

**CTAs** : « Envoyer mon message » (POST `/api/contact`), email mailto direct, cross-links sortants.

**KPIs** : taux complétion form > 65 %, 25-35 % clics email direct, délai réponse < 24h, NPS > 8/10.

---

## Tableau récapitulatif — composants par page

| Composant | / | /rituel | /kit | /journal | /maison | /panier | /commander | /merci | /contact |
|---|---|---|---|---|---|---|---|---|---|
| Header standard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| Header checkout |  |  |  |  |  |  | ✓ |  |  |
| Footer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | minimal | ✓ | ✓ |
| Hero éditorial | ✓ | ✓ | ✓ | ✓ | ✓ |  |  | ✓ | ✓ |
| Fleuron | ✓ | ✓ |  | ✓ |  |  |  | ✓ |  |
| GesteCard / EngagementCard | ✓ | ✓ |  |  | ✓ |  |  |  |  |
| TestimonialCard | ✓ |  | ✓ |  |  |  |  |  |  |
| ArticleCard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |
| NewsletterForm | ✓ |  |  | ✓ |  |  |  |  |  |
| VideoPlayer |  | ✓ | ✓ |  |  |  |  |  |  |
| FAQAccordion |  |  | ✓ |  |  |  |  |  | ✓ |
| Cart components |  |  |  |  |  | ✓ | ✓ |  |  |
| Checkout forms |  |  |  |  |  |  | ✓ |  |  |

> *Document suivant : [05 — Bibliothèque de composants](./05-bibliotheque-composants.md)*
