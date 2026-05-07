# 07 — Modèles de données & contrats API

> *Schémas Zod portables · API routes · contrats CMS*

---

## 1. Principe de conception

Tous les modèles sont définis comme **schémas Zod**. Du même schéma découlent :

- Le **type TypeScript** (via `z.infer`)
- La **validation runtime** (formulaires, API, frontières CMS)
- La **documentation** (via `zod-to-json-schema` ou commentaires JSDoc)
- L'**adaptateur CMS** (ce qu'on attend en entrée)

```ts
import { z } from 'zod';

export const articleSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1).max(120),
  // ...
});

export type Article = z.infer<typeof articleSchema>;
```

**Règle** : aucun type TS « libre » pour des entités métier. Toujours partir de Zod.

## 2. Modèles métier

### 2.1 Image

```ts
export const imageSchema = z.object({
  src: z.string().url(),
  alt: z.string(),                 // requis, accessibilité
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: z.string().optional(),
  caption: z.string().optional(),
});
```

### 2.2 SEO Meta

```ts
export const seoMetaSchema = z.object({
  title: z.string().min(10).max(60),
  description: z.string().min(50).max(160),
  ogImage: imageSchema.optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().default(false),
});
```

### 2.3 Article (Journal)

```ts
export const categorySchema = z.enum([
  'maison',
  'saison',
  'voix',
  'matieres',
  'pratique',
]);

export const articleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  description: z.string().max(280).optional(),
  category: categorySchema,
  readingTimeMinutes: z.number().int().positive().max(60),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  featuredImage: imageSchema,
  isFeatured: z.boolean().default(false),
  content: z.string().optional(),  // markdown
  author: z.string().default('FemiGlow'),
  seo: seoMetaSchema,
});

export type Article = z.infer<typeof articleSchema>;
```

### 2.4 Produit

```ts
export const ingredientSchema = z.object({
  name: z.string(),
  concentration: z.string().optional(),  // "15%"
  origin: z.string().optional(),
  purpose: z.string().optional(),
});

export const certificationSchema = z.enum([
  'vegan',
  'cruelty-free',
  'cosmebio',
  'bio',
  'naturelle',
]);

export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  shortDescription: z.string().optional(),
  price: z.number().positive(),
  currency: z.literal('MAD'),
  images: z.array(imageSchema).min(1),
  ingredients: z.array(ingredientSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  volume: z.string().optional(),         // "15ml"
  inStock: z.boolean().default(true),
  composition: z.array(z.string()).optional(), // IDs des sub-products du kit
  seo: seoMetaSchema,
});

export type Product = z.infer<typeof productSchema>;
```

### 2.5 Geste / Engagement

```ts
export const gesteEtapeSchema = z.object({
  numero: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  motItalique: z.enum(['paste', 'powder', 'shine', 'polish']),
  couleurEtiquette: z.enum(['sauge', 'petale', 'creme', 'ciel']),
  verbe: z.string(),
  phraseDescriptive: z.string(),
});

export const engagementSchema = z.object({
  id: z.string(),
  titre: z.string(),
  description: z.string(),
  icone: z.string().optional(),
});
```

### 2.6 Témoignage / Matière

```ts
export const testimonialSchema = z.object({
  id: z.string(),
  citation: z.string().min(10).max(280),
  prenom: z.string(),
  ville: z.string(),
  initieDepuis: z.string(),               // "avril 2026"
  photo: imageSchema,
});

export const matiereSchema = z.object({
  nom: z.string(),
  origine: z.string(),
  pourquoi: z.string(),
  image: imageSchema.optional(),
});
```

### 2.7 FAQ

```ts
export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),                     // markdown autorisé
  category: z.string().optional(),
  visibleForTypes: z.array(z.string()).optional(),
});
```

### 2.8 Adresse (Maroc)

```ts
export const phoneMarocSchema = z.string().regex(
  /^(\+212|0)[5-7][0-9]{8}$/,
  'Numéro marocain invalide'
);

export const addressSchema = z.object({
  line1: z.string().min(10).max(200),
  line2: z.string().max(200).optional(),
  quartier: z.string().min(1).max(100),
  ville: z.string().min(1).max(100),
  phone: phoneMarocSchema,
  notes: z.string().max(500).optional(),
});
```

### 2.9 Panier (Cart)

```ts
export const cartItemSchema = z.object({
  productId: z.string(),
  productSnapshot: z.object({       // figé au moment add
    name: z.string(),
    price: z.number(),
    image: imageSchema,
  }),
  quantity: z.number().int().min(1).max(10),
  addedAt: z.coerce.date(),
});

export const cartSchema = z.object({
  id: z.string().uuid(),
  items: z.array(cartItemSchema),
  subtotal: z.number().min(0),
  estimatedShipping: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  total: z.number().min(0),
  promoCode: z.string().optional(),
  createdAt: z.coerce.date(),
  lastModified: z.coerce.date(),
});
```

### 2.10 Commande (Order)

```ts
export const shippingModeSchema = z.enum(['standard', 'express']);
export const paymentModeSchema = z.enum(['card', 'cod']);
export const orderStatusSchema = z.enum([
  'draft',         // checkout en cours
  'pending',       // payée carte ou COD créée
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: imageSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  linePrice: z.number().positive(),
});

export const orderSchema = z.object({
  id: z.string().regex(/^FG-\d{4}-\d{5}$/),  // FG-2026-00037
  email: z.string().email(),
  firstName: z.string().optional(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema).min(1),
  shippingAddress: addressSchema,
  shippingMode: shippingModeSchema,
  shippingCost: z.number().min(0),
  paymentMode: paymentModeSchema,
  paymentStatus: z.enum(['pending', 'succeeded', 'failed']),
  stripePaymentIntentId: z.string().optional(),
  subtotal: z.number().positive(),
  promoCode: z.string().optional(),
  discountAmount: z.number().min(0),
  total: z.number().positive(),
  createdAt: z.coerce.date(),
  paidAt: z.coerce.date().optional(),
  estimatedDelivery: z.object({
    min: z.coerce.date(),
    max: z.coerce.date(),
  }),
  acceptNewsletter: z.boolean().default(false),
  notes: z.string().optional(),
});

export type Order = z.infer<typeof orderSchema>;
```

### 2.11 Soumission contact

```ts
export const contactTypeSchema = z.enum(['question', 'order', 'professional']);

export const contactSubmissionSchema = z.object({
  type: contactTypeSchema,
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: phoneMarocSchema.optional(),
  orderNumber: z.string().regex(/^FG-\d{4}-\d{5}$/).optional(),
  companyName: z.string().min(2).max(120).optional(),
  role: z.string().min(2).max(80).optional(),
  message: z.string().min(10).max(2000),
  gdprConsent: z.literal(true),
  newsletterOptIn: z.boolean().default(false),
  recaptchaToken: z.string(),
})
  .refine(
    (data) => data.type !== 'professional' || !!data.phone,
    { message: 'Téléphone requis pour les demandes professionnelles', path: ['phone'] }
  )
  .refine(
    (data) => data.type !== 'professional' || !!data.companyName,
    { message: 'Nom de société requis', path: ['companyName'] }
  )
  .refine(
    (data) => data.type !== 'order' || !!data.orderNumber,
    { message: 'Numéro de commande requis', path: ['orderNumber'] }
  );
```

### 2.12 Newsletter

```ts
export const newsletterSchema = z.object({
  email: z.string().email(),
  source: z.enum(['accueil', 'journal', 'merci', 'footer']),
  acceptedAt: z.coerce.date().default(() => new Date()),
});
```

## 3. Bundles de page

Chaque page consomme un bundle typé clairement délimité.

```ts
// src/lib/cms/types.ts
export interface AccueilPageData {
  hero: HeroData;
  gestes: GesteEtape[];          // 4 items
  manifeste: { lignes: string[] };
  avis: Testimonial[];            // 3 items
  journalExtraits: Article[];     // 3 items
}

export interface RituelPageData { /* cf. doc 04 */ }
export interface KitPageData { /* cf. doc 04 */ }
export interface JournalPageData { /* cf. doc 04 */ }
export interface MaisonPageData { /* cf. doc 04 */ }
// ...
```

## 4. Adapter CMS — interface

```ts
// src/lib/cms/adapter.ts
export interface CMSAdapter {
  // Articles
  getArticles(filter?: { category?: CategoryKey; limit?: number; offset?: number }): Promise<Article[]>;
  getArticleBySlug(slug: string): Promise<Article | null>;
  getFeaturedArticle(): Promise<Article | null>;

  // Produit kit
  getKit(): Promise<Product>;
  getKitComposition(): Promise<Product[]>;

  // Pages
  getHomepageData(): Promise<AccueilPageData>;
  getMaisonPage(): Promise<MaisonPageData>;
  getRituelPage(): Promise<RituelPageData>;
  getKitPage(): Promise<KitPageData>;
  getJournalPage(filter?: JournalFilter): Promise<JournalPageData>;

  // Contenus partagés
  getFAQ(category?: string): Promise<FAQItem[]>;
  getTestimonials(limit?: number): Promise<Testimonial[]>;
}
```

## 5. Routes API (`src/app/api/`)

### 5.1 Inventaire

| Route | Méthodes | Authentification | Rate limit | Description |
|---|---|---|---|---|
| `/api/newsletter` | POST | publique | 3/IP/h | Inscription newsletter |
| `/api/contact` | POST | publique | 3/IP/24h | Envoi formulaire contact |
| `/api/cart` | GET, POST, PATCH, DELETE | session | none | Sync panier serveur |
| `/api/orders` | POST | session | 5/session | Création commande |
| `/api/orders/[id]` | GET | session + token order | none | Récup commande (page merci) |
| `/api/orders/[id]/payment-intent` | POST | session | 3/order | Création Stripe PI |
| `/api/promo/validate` | POST | session | 10/h | Validation code promo |
| `/api/shipping/estimate` | POST | publique | 30/h | Estimation frais livraison |
| `/api/webhooks/stripe` | POST | signature Stripe | none | Webhook paiement |
| `/api/sitemap.xml` | GET | publique | none | Sitemap dynamique |

### 5.2 Conventions de réponse

```ts
// Succès
{
  data: T,
  meta?: { /* pagination, etc. */ }
}

// Erreur
{
  error: {
    code: 'VALIDATION_ERROR' | 'RATE_LIMIT' | 'NOT_FOUND' | 'INTERNAL',
    message: string,
    details?: Record<string, string>  // par champ
  }
}
```

### 5.3 Codes HTTP

| Code | Usage |
|---|---|
| 200 | succès, payload retourné |
| 201 | création réussie |
| 204 | succès sans payload |
| 400 | erreur validation (Zod) |
| 401 | non authentifié |
| 403 | interdit |
| 404 | ressource introuvable |
| 409 | conflit (panier modifié, commande déjà payée) |
| 422 | unprocessable (logique métier) |
| 429 | rate limit |
| 500 | erreur serveur (loggée + alertée) |

### 5.4 Squelette d'un handler typique

```ts
// src/app/api/newsletter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { newsletterSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { subscribeNewsletter } from '@/lib/email/resend';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const limit = await rateLimit('newsletter', ip, { max: 3, window: '1h' });
  if (!limit.success) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMIT', message: 'Trop de tentatives' }},
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Données invalides',
                 details: parsed.error.flatten().fieldErrors }},
      { status: 400 }
    );
  }

  await subscribeNewsletter(parsed.data);
  return NextResponse.json({ data: { ok: true }}, { status: 201 });
}
```

## 6. Validation aux frontières

**Toujours valider** :
- Body de toute requête entrante (`safeParse`)
- Réponse de toute API externe (Stripe, CMS) avant utilisation
- Données issues du CMS au moment de leur récupération (pas de confiance aveugle)

**Jamais ne pas valider** :
- Les frontières du système (réseau, fichier, env vars).

## 7. Mock data Phase 1

Les fichiers `src/data/*.json` contiennent les données prototype, conformes aux schémas. Le `mockAdapter` les charge et retourne des Promise (asynchrone) pour mimer un vrai CMS.

```ts
// src/lib/cms/mock.adapter.ts
import articles from '@/data/articles.json';
import { articleSchema } from '@/lib/validation';

export const mockAdapter: CMSAdapter = {
  async getArticles({ category, limit = 12 } = {}) {
    let list = articles;
    if (category) list = list.filter(a => a.category === category);
    return list.slice(0, limit).map(a => articleSchema.parse(a));
  },
  // ...
};
```

## 8. Migration Phase 2 vers CMS réel

Le passage à un CMS réel (Sanity recommandé pour l'aisance d'auteurage) consiste à :

1. Définir le schéma Sanity miroir des schémas Zod
2. Implémenter `sanity.adapter.ts` qui requête Sanity et transforme la réponse en objets validés Zod
3. Basculer `CMS_PROVIDER=sanity`
4. Aucun composant ni page n'est touché

Le contrat est garanti par la validation Zod : si le CMS retourne une donnée non conforme, l'erreur est attrapée *au plus tôt*, jamais en plein rendu.

> *Document suivant : [08 — UX, animations et micro-interactions](./08-ux-animations-interactions.md)*
