# 05 — Bibliothèque de composants

> *Catalogue exhaustif · API · découplage data · documentation Storybook*

---

## 1. Philosophie d'architecture

Trois règles président à toute création de composant :

1. **Le composant est un contrat** — entrées (props) typées explicitement, sorties prévisibles, aucune logique d'accès aux données dans le composant lui-même.
2. **Le composant ne sait rien du CMS** — il consomme des objets typés (issus de schémas Zod portables) qui peuvent provenir d'un mock JSON, d'un CMS, d'une API, indistinctement.
3. **Le composant respecte le système** — couleurs, typographies, espacements, animations strictement issus de tokens. Aucune valeur magique.

## 2. Stratification (atomic design adapté)

```
src/components/
├─ ui/              ← atoms (Button, Input, Card, Image, Link, Badge…)
├─ layout/          ← squelette (Header, Footer, Container, Section)
├─ patterns/        ← molécules réutilisables (Fleuron, GesteCard, ArticleCard, NewsletterForm…)
├─ forms/           ← molécules de formulaire (TextField, Select, Checkbox, FormError…)
├─ commerce/        ← molécules e-commerce (CartItem, QuantitySelector, OrderRecap…)
├─ sections/        ← organismes spécifiques pages (HeroAccueil, JournalGrid, PivotBanner…)
└─ overlays/        ← Modal, Toast, Drawer
```

**Règle de dépendance** : un niveau ne peut importer que les niveaux *au-dessus* dans la liste. `ui/` ne dépend de rien. `sections/` peut tout consommer.

## 3. Catalogue détaillé

### 3.1 `ui/` — Atomes

#### `<Button>`
```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;        // default 'primary'
  size?: ButtonSize;              // default 'md'
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;       // utilisé pour la flèche →
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  asChild?: boolean;              // pattern Radix : rend en `<Link>` ou `<a>`
}
```
- `variant='primary'` : fond Encre, texte Crème, hover Encre claire
- `variant='secondary'` : transparent, bordure Encre 1 px
- `variant='ghost'` : sans fond ni bordure, hover sauge pâle
- `variant='link'` : underline sauge dark, no padding
- Hauteur : `sm` 40 px, `md` 48 px, `lg` 56 px
- Loading : spinner mini centré, label disabled
- Microcopy : voir doc 01 (toujours « Découvrir », « Recevoir », jamais « Acheter »)

#### `<Link>`
```ts
interface LinkProps extends NextLinkProps {
  variant?: 'default' | 'underlined' | 'plain';
  external?: boolean;            // ajoute target=_blank + rel=noopener
  prefetch?: boolean;            // default true
  children: ReactNode;
}
```
Wrap autour de `next/link`, applique tokens et conventions accessibilité.

#### `<Image>`
Wrap `next/image`, ajoute :
- `aspectRatio` (4:3, 4:5, 1:1, 16:9) pour layout shift = 0
- `placeholder='blur'` automatique si BlurDataURL fourni
- `sizes` pré-paramétré selon contexte (card, hero, gallery)

#### `<Heading>`
```ts
type HeadingLevel = 'display-xl' | 'display-l' | 'display-m' | 'h1' | 'h2' | 'h3' | 'h4';

interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; // sémantique HTML, indépendant du visuel
  level: HeadingLevel;                            // visuel (token typo)
  align?: 'left' | 'center' | 'right';
  children: ReactNode;
}
```
Découple sémantique HTML (importance dans la page) du visuel (taille).

#### `<Text>`
```ts
interface TextProps {
  variant?: 'lead' | 'body' | 'ui' | 'ui-sm' | 'caption' | 'microcopy' | 'kicker';
  italic?: boolean;
  color?: 'encre' | 'encre-claire' | 'brume' | 'champagne';
  align?: 'left' | 'center' | 'right';
  as?: 'p' | 'span' | 'div';
  children: ReactNode;
}
```

#### `<Badge>`
Pour « À LA UNE » sur featured article, statuts, mentions.

#### `<Divider>`
Variantes : `line`, `dotted`, `fleuron-A`, `fleuron-B`, `fleuron-C`.

---

### 3.2 `layout/` — Squelette

#### `<Header>`
```ts
interface HeaderProps {
  variant?: 'default' | 'checkout';
  cartCount?: number;
}
```
- `variant='default'` : 4 entrées menu + panier
- `variant='checkout'` : wordmark + cadenas + retour panier (cf. `<HeaderCheckout>`)
- Sticky `z-index: 100`, transition fond crème blur au scroll > 80 px
- Mobile : burger menu drawer plein écran (slide-in 280 ms)
- Active route : underline 1 px sauge dark sous label menu

#### `<Footer>`
```ts
interface FooterProps {
  variant?: 'default' | 'minimal';
}
```
- `default` : 4 colonnes + copyright + sociaux
- `minimal` : copyright + cadenas + 3 liens légaux (utilisé `/commander`)

#### `<Container>`
```ts
interface ContainerProps {
  size?: 'narrow' | 'editorial' | 'content' | 'wide' | 'bleed';
  children: ReactNode;
}
```
Applique max-width + padding latéral responsive.

#### `<Section>`
```ts
interface SectionProps {
  spacing?: 'sm' | 'md' | 'lg' | 'xl' | 'editorial';
  background?: 'creme' | 'sauge-pale' | 'creme-pure' | 'encre';
  id?: string;                    // pour ancres (#manifeste)
  children: ReactNode;
}
```
Wrapper qui gère padding vertical + fond + scroll-margin-top (header sticky offset).

---

### 3.3 `patterns/` — Molécules réutilisables

#### `<Fleuron>`
```ts
interface FleuronProps {
  variant?: 'A' | 'B' | 'C';      // A = losange (signature), B = point, C = double filet
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
}
```
SVG champagne, exception décorative justifiée.

#### `<GesteCard>`
```ts
interface GesteCardProps {
  geste: GesteEtape;
  onHover?: () => void;
}

interface GesteEtape {
  numero: 1 | 2 | 3 | 4;
  motItalique: 'paste' | 'powder' | 'shine' | 'polish';
  couleurEtiquette: 'sauge' | 'petale' | 'creme' | 'ciel';
  verbe: string;                  // "Préparer", "Lisser", "Polir", "Révéler"
  phraseDescriptive: string;
}
```
Réutilisé en `EngagementCard` (page Maison) avec variante prop.

#### `<TestimonialCard>`
```ts
interface TestimonialCardProps {
  testimonial: Testimonial;
  layout?: 'card' | 'inline';
}

interface Testimonial {
  id: string;
  citation: string;
  prenom: string;
  ville: string;
  initieDepuis: string;            // "avril 2026"
  photo: Image;                    // mains/détails uniquement
}
```

#### `<ArticleCard>`
```ts
interface ArticleCardProps {
  article: Article;
  variant?: 'standard' | 'featured' | 'compact';
}
```
- `standard` : grid item 4:3 photo + titre + filet sauge + métas
- `featured` : 60/40 layout, photo 4:5, badge « À LA UNE »
- `compact` : photo plus petite (130 px), pour footer journal accueil

#### `<NewsletterForm>`
```ts
interface NewsletterFormProps {
  source: 'accueil' | 'journal' | 'merci';
  variant?: 'inline' | 'banner';
  onSuccess?: () => void;
}
```
Validation Zod côté client + serveur, double opt-in, états (idle / loading / success / error).

#### `<MatiereCard>`
```ts
interface MatiereCardProps {
  matiere: Matiere;
}

interface Matiere {
  nom: string;                     // "Cire d'abeille"
  origine: string;                 // "Imouzzer Kandar..."
  pourquoi: string;
  image?: Image;
}
```

#### `<HeroAccueil>` / `<HeroLifestyle>` / `<HeroProduit>` / `<HeroMaison>` / `<JournalHero>` / `<ContactHero>`
Variantes typées de hero. Tous partagent props : `title`, `tagline`, `ctas`, `backgroundVariant` (vagues / photo / uni).

#### `<PivotBanner>`
```ts
interface PivotBannerProps {
  phrase: string;
  cta: CTA;
  background?: 'sauge-clair' | 'creme';
  withFleuron?: boolean;
}
```
Section pivot vers `/kit` (utilisée `/rituel` section 6).

#### `<JournalGridAsymetric>` / `<JournalGrid>` / `<ArticleGrid>`
Variantes de grille articles : asymétrique (1 hero + 2), régulière 3 cols, infinite-scrollable avec `<LoadMoreButton>`.

#### `<CategoryPills>`
```ts
interface CategoryPillsProps {
  categories: Category[];
  active: CategoryKey | 'all';
  onChange: (key: CategoryKey | 'all') => void;
}
```
URL-driven via `useSearchParams`.

#### `<CrossLinkCard>` / `<CrossLinkBanner>`
Cards finales de page renvoyant vers cross-links.

---

### 3.4 `forms/` — Formulaires

#### `<TextField>`
```ts
interface TextFieldProps {
  name: string;
  label: string;
  hint?: string;
  type?: 'text' | 'email' | 'tel' | 'password' | 'url';
  required?: boolean;
  autocomplete?: string;
  inputMode?: string;
  placeholder?: string;
  error?: string;                  // affiche message + état rouge
  success?: boolean;               // affiche checkmark
  disabled?: boolean;
}
```
Intégré React Hook Form via `<Controller>` ou register.

#### `<Textarea>`
Identique avec `rows` + compteur caractères optionnel.

#### `<Select>`
Native select sur mobile, custom sur desktop (Radix Select), compatible RHF.

#### `<Checkbox>`
**Jamais pré-cochée** par défaut (RGPD). Touch ≥ 44 px.

#### `<RadioGroup>`
Pour choix mode livraison/paiement, accessible avec `<fieldset>` + `<legend>`.

#### `<FormError>`
Composant message d'erreur Cormorant Italic 12 pt rouge feutré.

#### `<FormFieldset>`
Wrapper pour grouper champs + légende sémantique.

---

### 3.5 `commerce/` — E-commerce

#### `<CartItem>`
```ts
interface CartItemProps {
  item: CartItem;
  onQuantityChange: (qty: number) => void;
  onRemove: () => void;
}
```

#### `<QuantitySelector>`
- Bouton `−` / valeur centrée / bouton `+`
- Validation min 1 max 10 (V1)
- Annonce ARIA `aria-live` au changement

#### `<CartSummary>`
Sous-total, livraison estimée, total + CTA `/commander`.

#### `<OrderRecap>`
Récap commande sur `/merci`. Read-only.

#### `<OrderSummarySticky>` / `<OrderSummaryAccordion>`
Récap dans tunnel checkout — sticky desktop / accordéon mobile.

#### `<ProductCard>`
Sur `/kit` section composition.

#### `<IngredientsTable>`
Liste ingrédients + concentrations + certifications avec icônes.

#### `<ComparatifTable>`
Vernis vs Rituel — 2 colonnes responsives (passe en cards mobile).

#### `<HandsTestimonialCarousel>`
Carousel mains avant/après, dots navigation, swipe mobile.

#### `<StickyCartCTA>`
Bouton « Recevoir le rituel » fixe sur `/kit`, apparaît au scroll > 200 px.

#### `<ProgressBar3Steps>`
Barre progression checkout, navigation flexible étapes complétées.

#### `<AddressForm>`
Champs adresse Maroc-spécifiques : adresse 1 + complément + quartier + ville (autocomplete) + téléphone.

#### `<ShippingModeSelector>`
Cards radio standard vs express avec frais dynamiques.

#### `<PaymentForm>`
Wrap Stripe Elements + choix mode (carte / COD), gestion erreurs inline.

#### `<PromoCodeInput>`
Champ collapse, validation API, affichage réduction.

---

### 3.6 `sections/` — Organismes spécifiques

Composants page-spécifiques composant patterns + ui pour produire une section complète.

| Composant | Page | Composé de |
|---|---|---|
| `HeroAccueilWithVagues` | `/` | Hero + SVGVagues + DualCTA |
| `Manifeste` | `/`, autres | Section + Fleuron + Heading italic |
| `QuatreGestesGrid` | `/` | 4 × GesteCard |
| `JournalExtraitsAsym` | `/` | 1 × ArticleCard featured + 2 × ArticleCard standard |
| `Newsletter` | `/`, `/journal` | Section + NewsletterForm + Fleuron |
| `OrigineNarrative` | `/rituel`, `/maison` | SectionNarrative |
| `VideoQuatreGestes` | `/rituel`, `/kit` | VideoPlayer + Captions |
| `SciencesDuSoin` | `/rituel` | 3 colonnes + SchemaSVG + Sources |
| `InterviewQR` | `/rituel` | Liste questions/réponses |
| `PivotKitBanner` | `/rituel` | PivotBanner + Fleuron |
| `KitHero` | `/kit` | HeroProduit + Réassurances |
| `CompositionKit` | `/kit` | 4 × ProductCard |
| `ComparatifVernis` | `/kit` | ComparatifTable |
| `FAQKit` | `/kit` | 8-10 × FAQAccordion |
| `MatieresGrid` | `/maison` | 4 × MatiereCard |
| `EngagementsGrid` | `/maison` | 4 × GesteCard variante |
| `AtelierBlock` | `/maison` | Section + Gallery + Address |
| `OrderHero` | `/merci` | Fleuron + Heading personnalisé + numéro + livraison |
| `EditorialLetter` | `/merci` | Section + lettre + signature Pinyon |
| `TimelineSteps` | `/merci` | 3 × étape avec icônes |
| `PreparationGesture` | `/merci` | Photo + texte court italic |

---

### 3.7 `overlays/` — Calques

#### `<Modal>`
Radix Dialog, focus trap, escape close, backdrop rgba(44,42,40,0.4).

#### `<Toast>`
Notifications éphémères (ajout panier, succès newsletter). Sonner ou react-hot-toast adapté tokens.

#### `<Drawer>`
Mobile menu burger, panier mobile (V2).

#### `<ConfirmationModal>`
Spécialisée : modal quitter checkout, supprimer article, etc.

---

## 4. Documentation Storybook

Chaque composant publié dispose d'**au moins** :

1. **Une story par variante** principale (`primary`, `secondary`, `ghost`, etc.)
2. **Une story `Playground`** avec contrôles tous props
3. **Un fichier `.mdx`** description usage + accessibilité + ne pas faire
4. **Test a11y** addon `@storybook/addon-a11y` automatique
5. **Snapshot Chromatic** pour régression visuelle (Phase 2 si budget)

Structure :
```
src/components/ui/Button/
├─ Button.tsx
├─ Button.stories.tsx
├─ Button.module.css     (si non Tailwind)
├─ Button.test.tsx
└─ Button.mdx
```

## 5. Découplage data — pattern adopté

```tsx
// ❌ Couplé : composant connaît la source
function ArticleCard() {
  const { data } = useFetch('/api/article');  // NON
}

// ✅ Découplé : composant reçoit data en prop
function ArticleCard({ article }: { article: Article }) {
  return <article>{article.title}</article>;
}

// La récupération vit dans la page (Server Component)
async function JournalPage() {
  const articles = await getArticles();        // adapter pluggable
  return articles.map(a => <ArticleCard key={a.slug} article={a} />);
}
```

Le composant `<ArticleCard>` ignore tout du *où* et du *comment* la donnée est obtenue. Cela permet :
- Mock JSON aujourd'hui → CMS demain sans toucher au composant
- Storybook avec fixtures sans serveur
- Tests unitaires faciles
- SSG, SSR, ISR au choix par page

## 6. Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichier composant | PascalCase + `.tsx` | `ArticleCard.tsx` |
| Story | `.stories.tsx` | `ArticleCard.stories.tsx` |
| Test | `.test.tsx` | `ArticleCard.test.tsx` |
| Type props | `[Component]Props` | `ArticleCardProps` |
| Hook custom | `use[Name]` | `useCart`, `useScrollProgress` |
| Helper / lib | camelCase | `formatPrice`, `getArticles` |
| Constante | UPPER_SNAKE | `MAX_CART_ITEMS` |

## 7. Index des composants

Voir [`annexes/composants-index.md`](./annexes/composants-index.md) pour la liste alphabétique exhaustive avec liens vers les fichiers correspondants dans la structure Next.js.

> *Document suivant : [06 — Architecture technique Next.js](./06-architecture-technique.md)*
