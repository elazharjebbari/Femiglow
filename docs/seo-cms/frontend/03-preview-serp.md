# Frontend — Previews SERP / Facebook / Twitter

Trois composants de prévisualisation rendent ce que voit l'utilisateur
final dans les surfaces externes (Google, Facebook, Twitter/X).

Tous trois rendent côté client à partir des données résolues
(API `GET /api/admin/seo/preview/[scope]/[targetKey]`).

## `<SerpPreview>`

Carte Google desktop / mobile.

### Props

```ts
interface SerpPreviewProps {
  url: string;            // ex: https://femiglow.com/kit
  title: string;          // tronqué à 60 chars affichés
  description: string;    // tronqué à 158 chars affichés
  faviconUrl?: string;
  device?: 'desktop' | 'mobile';   // défaut 'desktop'
  date?: string;          // ISO, affiché en gris si présent
  breadcrumbs?: string[]; // ex: ['femiglow.com', 'kit']
}
```

### Layout desktop

```
favicon  femiglow.com › kit
Le Kit FemiGlow — soin essentiel pour peaux …
Une routine douce, pensée pour les peaux pressées et …
```

### Layout mobile

Width 360px, font Roboto 14px, plus dense, séparateur fin entre cartes
(simulation de SERP).

### Troncature

```ts
function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  // tronque sur le dernier espace avant max - 1
  const cut = s.lastIndexOf(' ', max - 1);
  return (cut > 0 ? s.slice(0, cut) : s.slice(0, max - 1)) + '…';
}
```

## `<FacebookPreview>`

Carte Open Graph (link unfurl).

### Props

```ts
interface FacebookPreviewProps {
  ogTitle: string;
  ogDescription: string;
  ogImageUrl?: string;            // 1200×630 idéal
  urlHost: string;                // ex: 'femiglow.com'
  variant?: 'large' | 'small';    // défaut 'large'
}
```

### Layout `large` (image > 600×315)

```
┌─────────────────────────────────────────┐
│ [        OG image (16:9)        ]       │
├─────────────────────────────────────────┤
│ FEMIGLOW.COM                             │
│ Le Kit FemiGlow                          │
│ Routine douce …                          │
└─────────────────────────────────────────┘
```

### Fallback image

Si `ogImageUrl` absent : placeholder gris uni avec icône image et
texte « Aucune image OG ».

## `<TwitterPreview>`

Carte Twitter/X.

### Props

```ts
interface TwitterPreviewProps {
  card: 'summary' | 'summary_large_image';
  title: string;
  description: string;
  imageUrl?: string;
  handle?: string;        // ex: '@femiglow'
  domain: string;         // ex: 'femiglow.com'
}
```

### Variantes

- `summary` : image carrée 144×144 à gauche, texte à droite
- `summary_large_image` : image 16:9 dessus, texte dessous

## Implémentation

Tous les 3 sous `apps/web/src/components/admin/seo/previews/`.

### Cliché statique vs hot reload

Le composant accepte des props pure ; un hook
`useSeoPreviewData(scope, targetKey, candidate?)` débounce 300 ms
pour limiter les calculs lors de la frappe.

### Style

CSS modules locaux (pas Tailwind ici — on simule des UI externes
fidèlement, donc police/spacing custom).

Polices :

- SerpPreview : Arial / system-ui (Google)
- FacebookPreview : SegoeUI / system-ui (FB)
- TwitterPreview : `'Chirp', system-ui` (X)

## Tests

### RTL

Pour chaque composant : `render(<Component {...fixture} />)` →
`expect(screen.getByText(...))`. 3 fixtures par composant
(plein, vide, image manquante).

### Visual regression

Snapshot Playwright sur la page admin avec un override fixture →
comparé à un PNG de référence (tolérance 1% par pixel).

### Accessibilité

- Pas de rôle ARIA spécifique (les previews sont décoratives ;
  l'éditeur reste la source d'interaction)
- Cependant : `role="img"` + `aria-label` sur les conteneurs preview
  pour annoncer « Prévisualisation Google de la page kit »

## Limites connues

- La SERP réelle peut afficher des sitelinks, FAQ, breadcrumbs,
  rating — non simulés en v1
- Facebook/X cachent agressivement leurs unfurls ; la preview montre
  ce qui *devrait* s'afficher, pas ce qui s'affiche maintenant
- Pour valider en prod : utiliser
  https://developers.facebook.com/tools/debug/ et
  https://cards-dev.twitter.com/validator
