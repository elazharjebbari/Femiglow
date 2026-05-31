# 40.5 — Rendu public d'une page légale : design

## Route

```
app/legal/[slug]/page.tsx
```

Plus fallback `app/[slug]/page.tsx` catch-all DB lookup pour URLs sans préfixe
(pour compatibilité avec `/mentions-legales`, `/cgv`, etc.).

## Server Component

```tsx
// app/legal/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { renderLegalMarkdown } from '@/lib/legal/render';
import { getLegalPage } from '@/lib/legal/repository';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const page = await getLegalPage(params.slug);
  if (!page || page.status !== 'published') return { robots: 'noindex' };

  return {
    title: page.title,
    description: page.description,
    robots: page.include_in_search ? 'index, follow' : 'noindex, follow',
    alternates: page.canonical_url ? { canonical: page.canonical_url } : undefined,
  };
}

export async function generateStaticParams() {
  const slugs = await listPublishedLegalSlugs();
  return slugs.map(slug => ({ slug }));
}

export default async function LegalPage({ params }) {
  const page = await getLegalPage(params.slug);
  if (!page || page.status !== 'published') notFound();

  const html = await renderLegalMarkdown(page.body_md);

  return (
    <LegalPageLayout
      title={page.title}
      lastUpdated={page.published_at}
      slug={page.slug}
    >
      <article
        className="legal-prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <LegalRelatedLinks currentSlug={page.slug} />
    </LegalPageLayout>
  );
}
```

## Layout dédié

```tsx
// app/legal/[slug]/layout.tsx — DOIT exister pour partager le wrapper
export default function LegalLayout({ children }) {
  return (
    <div className="bg-stone-50 min-h-screen">
      <SiteHeader variant="minimal" />
      <main className="mx-auto max-w-3xl px-6 py-12 lg:py-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
```

## Composant `LegalPageLayout`

```tsx
<LegalPageLayout title="..." lastUpdated={Date} slug="...">
  {children}
</LegalPageLayout>
```

Structure :

```
┌───────────────────────────────────────┐
│         ⟵ Retour à l'accueil           │
│                                       │
│      [title en Cormorant Garamond]    │
│      Mis à jour le 13 mai 2026         │
│                                       │
├───────────────────────────────────────┤
│                                       │
│  Contenu MD rendu (prose)             │
│  …                                    │
│                                       │
├───────────────────────────────────────┤
│  Voir aussi :                          │
│  → CGV                                 │
│  → Politique de confidentialité        │
│  → Politique cookies                   │
├───────────────────────────────────────┤
│  Une question ? hello@femiglow.ma     │
│  Mise à jour le 13/05/2026 · v3        │
└───────────────────────────────────────┘
```

## Typo & couleurs (charte FemiGlow)

```css
.legal-prose {
  /* Hérité de Tailwind Typography + override charte */
  --tw-prose-body: theme('colors.stone.700');
  --tw-prose-headings: theme('colors.stone.900');
  --tw-prose-links: theme('colors.rose.700');

  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  line-height: 1.75;
  max-width: 65ch;
}

.legal-prose h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 500;
  margin-block-end: 0.75rem;
  letter-spacing: -0.02em;
}

.legal-prose h2 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.625rem;
  font-weight: 500;
  margin-block-start: 2.5rem;
  margin-block-end: 1rem;
  border-bottom: 1px solid theme('colors.stone.200');
  padding-bottom: 0.5rem;
}

.legal-prose h3 {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 1.125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: theme('colors.stone.500');
}

.legal-prose a {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
```

## Sanitization HTML

Whitelist DOMPurify :

```typescript
const FEMIGLOW_DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'u', 'del', 's', 'code',
    'ul', 'ol', 'li',
    'a', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'id', 'class', 'aria-label'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};
```

## SEO

- `<meta name="robots" content="noindex, follow">` par défaut sur toutes les pages légales
- Si `include_in_search === true` : `index, follow`
- Sitemap : exclure les pages avec `include_in_search === false`
- Structured data : pas d'application (pas un Article/Product)
- `<link rel="canonical">` self-referencing (sauf si custom canonical_url)

## OpenGraph

```typescript
openGraph: {
  title: page.title,
  description: page.description ?? `${page.title} — FemiGlow`,
  type: 'website',
  locale: 'fr_MA',
  url: `${SITE_URL}/legal/${page.slug}`,
  siteName: 'FemiGlow',
},
twitter: {
  card: 'summary',
  title: page.title,
}
```

## A11y

- `<main>` avec `id="main"` pour skip-link
- Headings hierarchy strict (H1 → H2 → H3, pas de saut)
- `<a>` avec text contenant l'action ("Voir la politique cookies"), pas "Cliquez ici"
- Tableaux avec `<thead>`, `<th scope="col">`
- Color contrast AAA pour body (high stakes)
- `prefers-reduced-motion` respecté

## Mobile

- Largeur max 65ch → confortable même sur 320px
- Font-size base 16px (pas de zoom forcé iOS)
- Padding latéral 1.5rem
- Liens "Voir aussi" en colonne (pas tab)
- Bouton "Retour en haut" fixed après scroll de 50%

## Cache & ISR

- Pages statiquement générées au build (`generateStaticParams`)
- Revalidation : 3600s (1h) → couvre les modifications fréquentes
- Sur publish, `revalidatePath('/legal/[slug]')` côté serveur pour purger immédiatement

## Microcopy bas de page

```
Une question ? Contactez-nous : hello@femiglow.ma · +212 6XX XX XX XX
Mise à jour le 13/05/2026 · Version 3
```

Si page contient `requires_consent_link` :

```
Vous avez le droit de retirer votre consentement à tout moment via les
[paramètres cookies](#cookie-settings).
```

## Tests E2E

- `/legal/cgv` charge avec 200 + contenu attendu
- `<meta robots>` = `noindex` par défaut
- Page non-publiée → 404
- Slug archivé → 410 Gone + redirect optionnel
- Sitemap n'inclut pas les pages noindex
- Accessibilité axe-core pass

## i18n (V2)

V1 : français uniquement. V2 :

```
app/legal/[lang]/[slug]/page.tsx  → /legal/fr/cgv, /legal/ar/cgv
```

DB : ajouter `lang` aux clés uniques.
