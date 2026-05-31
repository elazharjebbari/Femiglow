import type { Article, FAQItem, Product } from '@/lib/schemas';

const SITE_URL = 'https://femiglow-maroc.com';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FemiGlow',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: ['https://www.instagram.com/femiglow'],
    // LEGAL-V2 — Anonymisé : pas d'exposition du prénom personnel dans le JSON-LD public.
    // Conservation du jobTitle (informationnel sans PII).
    founder: {
      '@type': 'Person',
      name: 'Founder',
      jobTitle: 'Biologiste, formulatrice et formatrice',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'info@femiglow-maroc.com',
      telephone: '+212630035905',
      areaServed: 'MA',
      availableLanguage: ['French', 'Arabic'],
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: '25 bis avenue Patrice Lumumba',
      addressLocality: 'Rabat',
      addressCountry: 'MA',
    },
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'FemiGlow',
    url: SITE_URL,
    inLanguage: 'fr-MA',
  };
}

interface HowToStep {
  name: string;
  text: string;
}

interface HowToInput {
  name: string;
  description: string;
  totalTimeIso: string;
  slug: string;
  steps: HowToStep[];
}

export function howToSchema(input: HowToInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    totalTime: input.totalTimeIso,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}${input.slug}`,
    },
    step: input.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/**
 * Données enrichies optionnelles pour Schema.org Product.
 *
 * - `aggregateRating` débloque les **étoiles dans les SERP Google** (Rich
 *   Results). Sans aggregateRating, Google n'affiche pas la note moyenne.
 * - `reviews` permet à Google d'extraire des extraits de témoignages.
 *
 * Les valeurs sont remontées depuis le builder feed (`buildKitProductFeed`)
 * qui agrège `KitPageContent.handsTestimonials` + le compteur global.
 */
export interface ProductSchemaEnrichment {
  aggregateRating?: {
    /** Note moyenne, ex 4.8 (chiffre précis Pricing #14). */
    ratingValue: number;
    /** Nombre total d'avis. */
    reviewCount: number;
    /** Échelle, défaut 5. */
    bestRating?: number;
    /** Note plancher, défaut 1. */
    worstRating?: number;
  };
  /** Échantillon de reviews (ex 3-5 témoignages les plus récents). */
  reviews?: ReadonlyArray<{
    authorName: string;
    /** Texte de la review. */
    body: string;
    /** Note individuelle. Si absent, on hérite de l'aggregate (ou 5). */
    ratingValue?: number;
    /** ISO 8601, optionnel. */
    datePublished?: string;
  }>;
}

export function productSchema(
  product: Product,
  urlPath = '/kit',
  enrichment: ProductSchemaEnrichment = {},
) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((image) => `${SITE_URL}${image.src}`),
    sku: product.id,
    brand: { '@type': 'Brand', name: 'FemiGlow' },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${urlPath}`,
      priceCurrency: product.currency,
      price: (product.priceCents / 100).toFixed(2),
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      areaServed: 'MA',
      seller: { '@type': 'Organization', name: 'FemiGlow' },
    },
  };

  if (enrichment.aggregateRating) {
    const r = enrichment.aggregateRating;
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: r.ratingValue.toFixed(1),
      reviewCount: r.reviewCount,
      bestRating: (r.bestRating ?? 5).toFixed(1),
      worstRating: (r.worstRating ?? 1).toFixed(1),
    };
  }

  if (enrichment.reviews && enrichment.reviews.length > 0) {
    const fallbackRating = enrichment.aggregateRating?.ratingValue ?? 5;
    base.review = enrichment.reviews.map((rev) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: rev.authorName },
      reviewBody: rev.body,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: (rev.ratingValue ?? fallbackRating).toFixed(1),
        bestRating: '5.0',
        worstRating: '1.0',
      },
      ...(rev.datePublished ? { datePublished: rev.datePublished } : {}),
    }));
  }

  return base;
}

export function faqPageSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function blogSchema(articles: Article[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Le carnet de la maison',
    description:
      'Le journal FemiGlow — récits saisonniers, matières et voix d\u2019initiées, publiés au rythme des saisons.',
    url: `${SITE_URL}/journal`,
    inLanguage: 'fr-MA',
    publisher: {
      '@type': 'Organization',
      name: 'FemiGlow',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    blogPost: articles.map((article) => ({
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.excerpt,
      url: `${SITE_URL}/journal/${article.slug}`,
      datePublished: article.publishedAt.toISOString(),
      dateModified: article.updatedAt.toISOString(),
      author: { '@type': 'Person', name: article.author.name },
      image: [`${SITE_URL}${article.featuredImage.src}`],
    })),
  };
}

export function blogPostingSchema(article: Article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    image: [`${SITE_URL}${article.featuredImage.src}`],
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: article.author.name,
      ...(article.author.bio ? { description: article.author.bio } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'FemiGlow',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/journal/${article.slug}`,
    },
    inLanguage: 'fr-MA',
    articleSection: article.category,
    ...(article.wordCount ? { wordCount: article.wordCount } : {}),
  };
}

export function articleSchema(article: Article) {
  return blogPostingSchema(article);
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface LocalBusinessInput {
  name: string;
  url: string;
  addressLocality: string;
  addressCountry: string;
  streetAddress?: string;
  areaServed?: string;
}

export function localBusinessSchema(input: LocalBusinessInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.name,
    url: input.url,
    address: {
      '@type': 'PostalAddress',
      ...(input.streetAddress ? { streetAddress: input.streetAddress } : {}),
      addressLocality: input.addressLocality,
      addressCountry: input.addressCountry,
    },
    ...(input.areaServed ? { areaServed: input.areaServed } : {}),
  };
}

export function breadcrumbListSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}
