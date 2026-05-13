# 30.3 — Stratégie d'exclusion SEO

## Principe

Toutes les pages légales sont **`noindex, nofollow`** par défaut. Opt-in
explicite via `legal_pages.include_in_search = true` par page.

## Niveaux d'exclusion

### Niveau 1 — Meta robots

Dans `app/legal/[slug]/page.tsx` :

```typescript
import type { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  const page = await fetchLegalPage(params.slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    robots: {
      index: page.include_in_search,
      follow: page.include_in_search,
      // Sécurité supplémentaire
      googleBot: {
        index: page.include_in_search,
        follow: page.include_in_search,
        'max-snippet': page.include_in_search ? -1 : 0,
      },
    },
    alternates: {
      canonical: page.canonical_url ?? `/${params.slug}`,
    },
  };
}
```

→ Génère `<meta name="robots" content="noindex,nofollow">` quand
`include_in_search = false`.

### Niveau 2 — sitemap.xml

Le sitemap exclut par défaut les pages légales :

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const standard = [
    { url: '/', changeFrequency: 'weekly', priority: 1 },
    { url: '/kit', changeFrequency: 'monthly', priority: 0.9 },
    { url: '/journal', changeFrequency: 'weekly', priority: 0.7 },
    // ...
  ];

  // Pages légales : SEULEMENT si include_in_search = true
  const legal = await db.legalPages.find({
    status: 'published',
    include_in_search: true,
  });

  const legalEntries = legal.map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
    lastModified: p.published_at,
  }));

  return [...standard, ...legalEntries];
}
```

### Niveau 3 — robots.txt

Pas de modification de robots.txt (sécurité par défaut au niveau page).

Le robots.txt existant n'aura **pas** d'exclusion des pages légales (pas
besoin avec niveau 1 et 2).

## Avertissement admin pour opt-in

Si l'admin coche "Inclure dans la recherche Google" sur une page :

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠ Vous activez l'indexation pour "Mentions légales".            │
│                                                                  │
│  Êtes-vous sûr ? Ce type de page est généralement NON indexé     │
│  pour ne pas polluer les résultats de recherche.                 │
│                                                                  │
│  Cas typique d'opt-in : page FAQ (utile en SEO).                 │
│                                                                  │
│  [Annuler]                            [Oui, activer l'indexation]│
└──────────────────────────────────────────────────────────────────┘
```

Pages où l'opt-in est **recommandé** :
- `/faq` (questions courantes peuvent attirer du trafic SEO)

Pages où l'opt-in est **fortement déconseillé** :
- `/mentions-legales` (pas de valeur SEO)
- `/cgv`, `/cgu`, `/confidentialite`, `/cookies` (texte légal verbeux)
- `/retours-remboursements`, `/livraison` (peu intéressant en SEO direct)

## Test e2e

```typescript
test('Mentions légales has noindex by default', async ({ page }) => {
  await page.goto('/mentions-legales');
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robotsMeta).toContain('noindex');
  expect(robotsMeta).toContain('nofollow');
});

test('FAQ has index because include_in_search = true', async ({ page }) => {
  await page.goto('/faq');
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robotsMeta).toContain('index');
  expect(robotsMeta).not.toContain('noindex');
});

test('Sitemap excludes noindex pages', async ({ page }) => {
  const res = await page.goto('/sitemap.xml');
  const body = await res?.text() ?? '';
  expect(body).not.toContain('/mentions-legales');
  expect(body).not.toContain('/cgv');
  expect(body).toContain('/faq'); // opted in
});
```

## Validation Google Search Console

Après deploy, vérifier dans GSC :
- Pages légales : "Excluded by 'noindex' tag"
- FAQ (si opt-in) : indexé normalement

Si une page légale apparaît en search par accident :
1. Vérifier `include_in_search` (toggle off)
2. Demander suppression URL en GSC (Outils Suppressions)
3. Re-crawler la page
