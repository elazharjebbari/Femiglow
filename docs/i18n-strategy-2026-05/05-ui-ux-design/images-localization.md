# Images — Stratégies de localisation visuelle FemiGlow

> Comment gérer les visuels FemiGlow (hero, packshots, illustrations) en contexte multilingue : neutres, variantes par locale, ou text overlay HTML. Workflow CMS pour swap, alt text traduit, considérations CDN.

## 1. Principe directeur

### 1.1 Doctrine "images neutres par défaut"

**Stratégie cible** : 90 % des visuels FemiGlow sont **neutres** (sans texte incrusté) et utilisables pour les 3 locales. Les 10 % restants utilisent une stratégie de variantes ou d'overlay.

Avantages :
- 1 seul asset à produire / shooter
- 1 seul CDN cache
- Pas de duplication storage
- Évite les drift visuels (FR splendide, AR négligé)
- Pas d'oubli si on ajoute une 4ème langue

### 1.2 Quand cette doctrine s'applique

| Type de visuel | Neutre par défaut ? |
|---|---|
| Hero éditorial (mains, ongles, packshot) | OUI |
| Photo lifestyle (modèle, ambiance maison) | OUI |
| Packshot produit pur | OUI |
| Mood board / texture | OUI |
| Photo studio détail | OUI |
| Illustration décorative motif | OUI |
| Avatar / portrait | OUI |
| Map du Maroc | OUI (pas de texte villes) |
| Bannière promotionnelle saisonnière | NON (texte = variantes) |
| Carte cadeau visuelle | NON (texte = variantes) |
| Pictogramme avec label intégré | NON (variantes ou overlay) |
| Infographie avec annotations | NON (variantes ou overlay) |

### 1.3 Voix de marque appliquée

FemiGlow étant sobre éditorial, les hero shots reposent sur :
- Photographie produit / lifestyle
- Couleurs sand / ivoire / café
- Mains, ongles, gestes
- Peu de texte (le texte est dans le HTML autour)

→ Cette voix **facilite naturellement** la stratégie neutre.

## 2. Trois stratégies techniques

### 2.1 Stratégie A — Images neutres (recommandée)

**Description** : l'image ne contient AUCUN texte. Toutes les paroles sont dans le HTML qui l'entoure.

**Cas d'usage** : 90 % des situations FemiGlow.

**Exemple** :

```tsx
// Hero avec image neutre + headline HTML par-dessus / à côté
<section className="grid lg:grid-cols-2 gap-12 items-center">
  <div>
    <h1 className="text-5xl font-serif">{t('marketing.hero.title')}</h1>
    <p className="mt-4 text-lg">{t('marketing.hero.subtitle')}</p>
    <Button>{t('marketing.hero.cta')}</Button>
  </div>
  <Image
    src="/images/hero-kit-mains.jpg"
    alt={t('marketing.hero.image_alt')}
    width={800}
    height={600}
    priority
  />
</section>
```

**Avantages**
- 1 image pour 3 locales
- Bundle minimal
- Aucun risque de drift
- CDN cache optimal

**Inconvénients**
- Limité aux compositions où le texte est dans le HTML
- Peut sembler "désincrusté" du visuel (moins immersif)

### 2.2 Stratégie B — Variantes par locale

**Description** : on shoot ou compose une image différente par locale, généralement parce que du texte est incrusté ou pour des raisons culturelles.

**Cas d'usage** : bannières saisonnières, infographies, cartes cadeaux.

**Exemple** :

```tsx
// Banner saison "Édition Ramadan" avec calligraphie AR vs FR
const locale = useLocale();
<Image
  src={`/images/banners/ramadan-2026/${locale}.jpg`}
  alt={t('banners.ramadan.alt')}
  width={1200}
  height={400}
/>
```

Storage :

```
public/
  images/
    banners/
      ramadan-2026/
        fr.jpg
        ar.jpg
        en.jpg
```

**Avantages**
- Texte parfaitement intégré au design
- Possibilité de variations culturelles fines

**Inconvénients**
- 3× le travail design
- 3× le storage
- Risque de drift si une langue est négligée
- Mise à jour = 3 fichiers à régénérer

### 2.3 Stratégie C — Text overlay HTML

**Description** : image neutre + texte HTML positionné en absolu par-dessus avec CSS.

**Cas d'usage** : moyen terme entre A et B — l'image est neutre mais le rendu final ressemble à du texte incrusté.

**Exemple** :

```tsx
<div className="relative">
  <Image
    src="/images/banners/spring/neutral.jpg"
    alt=""
    width={1200}
    height={400}
    className="w-full h-auto"
  />
  <div className="absolute inset-0 flex items-center justify-center">
    <h2 className="text-white text-4xl font-serif drop-shadow-lg">
      {t('banners.spring.headline')}
    </h2>
  </div>
</div>
```

**Avantages**
- 1 image pour 3 locales (sauf si la composition force différemment selon longueur du texte)
- Texte sélectionnable, accessible, SEO indexable
- Mise à jour du texte sans regénérer l'image
- Compatible RTL automatiquement

**Inconvénients**
- Difficile de garantir lisibilité (contraste texte / image varie selon zoom)
- Limité dans les typographies expressives (text-shadow, blend mode)
- Longueur de texte varie selon locale → débordements possibles

## 3. Décision par page / surface FemiGlow

### 3.1 Page d'accueil `/[locale]/`

| Section | Stratégie | Notes |
|---|---|---|
| Hero (visuel principal) | A — neutre | Photo packshot ongles, headline en HTML à côté |
| Section "Le rituel" | A — neutre | Photos gestes manucure |
| Section "Maison FemiGlow" | A — neutre | Photo lifestyle marocaine |
| Press / testimonials | A — neutre | Citations en HTML |
| Footer banner | A ou C selon design | Selon saison |

### 3.2 Page Kit `/[locale]/kit`

| Section | Stratégie | Notes |
|---|---|---|
| Hero produit | A — neutre | Packshot pur |
| Galerie thumbnails | A — neutre | Différents angles |
| Diagramme contenu kit | B — variantes | Texte légendes incrusté (FR/AR/EN) |
| Steps "comment appliquer" | C — overlay | Photo gestes + numéros + labels HTML |
| FAQ section | A — neutre | Texte HTML pur |

### 3.3 Page Rituel `/[locale]/rituel`

| Section | Stratégie | Notes |
|---|---|---|
| Hero | A — neutre | Photo conceptuelle |
| Timeline 5 étapes | C — overlay | Photo par étape + labels HTML |
| Témoignages photos | A — neutre | Citations en HTML |

### 3.4 Journal `/[locale]/journal`

| Section | Stratégie | Notes |
|---|---|---|
| Cover articles | A — neutre | Photo éditoriale, titre HTML |
| Inline images articles | A — neutre | Légendes en HTML caption |
| Article hero | A — neutre | Photo + titre HTML par-dessus |

### 3.5 Contact `/[locale]/contact`

| Section | Stratégie | Notes |
|---|---|---|
| Hero | A — neutre | Photo accueil maison |
| Map Maroc | A — neutre | Points sans labels villes (labels HTML) |

### 3.6 Pages légales

| Section | Stratégie |
|---|---|
| Texte pur HTML | n/a (pas d'images critiques) |

### 3.7 Emails transactionnels

| Section | Stratégie |
|---|---|
| Header logo | A — neutre (logo brand) |
| Hero email banner | A — neutre + texte HTML email-safe |
| CTA buttons | HTML (pas d'images) |

### 3.8 Bannières marketing temporaires

| Cas | Stratégie |
|---|---|
| Promo Saint-Valentin | B — variantes (calligraphie locale) |
| Édition Ramadan | B — variantes (sensibilité culturelle) |
| Soldes / Black Friday | C — overlay |
| Lancement produit | A — neutre + HTML headline |

## 4. Implémentation Next.js — patterns

### 4.1 Image avec alt traduit (cas neutre)

```tsx
// app/[locale]/page.tsx
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export default async function HomePage({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'marketing.hero' });
  return (
    <Image
      src="/images/home/hero-kit.jpg"
      alt={t('image_alt')}
      width={1200}
      height={800}
      priority
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
```

### 4.2 Image avec variantes par locale (cas B)

```tsx
// Pattern 1 — interpolation directe
<Image
  src={`/images/banners/ramadan-2026/${locale}.jpg`}
  alt={t('banners.ramadan.alt')}
  width={1200}
  height={400}
/>

// Pattern 2 — manifest pour fallback explicite
const banners = {
  fr: '/images/banners/ramadan-2026/fr.jpg',
  ar: '/images/banners/ramadan-2026/ar.jpg',
  en: '/images/banners/ramadan-2026/en.jpg',
} as const;
<Image src={banners[locale] ?? banners.fr} alt={t('banners.ramadan.alt')} />
```

### 4.3 Image avec text overlay (cas C)

```tsx
<div className="relative aspect-[3/1] w-full">
  <Image
    src="/images/banners/spring/neutral.jpg"
    alt="" /* Image décorative, texte ailleurs */
    fill
    className="object-cover"
  />
  <div className="absolute inset-0 flex items-center px-8 lg:px-16">
    <h2 className="max-w-md text-white text-3xl lg:text-5xl font-serif">
      {t('banners.spring.headline')}
    </h2>
  </div>
</div>
```

→ Si l'image décorative est purement esthétique, `alt=""` et `aria-hidden="true"` éventuel.

### 4.4 Image avec miroir conditionnel RTL

Cas rare où l'image est asymétrique (flèche directionnelle) et doit suivre le sens lecture.

```tsx
const locale = useLocale();
const isRtl = locale === 'ar';
<Image
  src="/images/diagram-arrow.svg"
  alt={t('diagram.alt')}
  width={400}
  height={100}
  className={cn(isRtl && '-scale-x-100')}
/>
```

→ Préférer des SVG (vectoriel) pour ce cas — pas de pixelisation au miroir.

## 5. Alt text — règles éditoriales

### 5.1 Pourquoi traduire l'alt

- **A11y** : screen reader annonce dans la langue de la page
- **SEO** : Google indexe alt par locale
- **WCAG 1.1.1** : alt requis pour images non décoratives

### 5.2 Stratégie de stockage

Toujours via clé i18n :

```json
{
  "marketing": {
    "hero": {
      "image_alt": "Mains élégantes appliquant le vernis FemiGlow couleur ivoire"
    },
    "kit": {
      "packshot_alt": "Kit complet FemiGlow ouvert sur table en bois clair"
    }
  }
}
```

### 5.3 Règles de rédaction alt

- **120 caractères max** (limite tolérée screen readers)
- **Pas de "image de" / "photo de"** redondant
- **Décrit le contenu utile** pas la décoration
- **Traduire l'intention** pas la lettre :
  - FR : `"Mains élégantes appliquant le vernis FemiGlow"`
  - AR : `"يدان أنيقتان تضعان طلاء أظافر FemiGlow"`
  - EN : `"Elegant hands applying FemiGlow nail polish"`

### 5.4 Image purement décorative

```tsx
<Image src="/decorative-texture.jpg" alt="" aria-hidden="true" />
```

Vide explicite, pas omis. Évite que les SR annoncent le nom du fichier.

### 5.5 Image fonctionnelle (icône cliquable)

```tsx
<button aria-label={t('common.close_aria')}>
  <Image src="/icons/close.svg" alt="" width={16} height={16} />
</button>
```

Alt vide, label sur le wrapper.

## 6. Workflow CMS pour swap d'images

### 6.1 Contexte CMS FemiGlow

FemiGlow utilise un CMS interne avec table `component_field_bindings` qui contient `value` et `locale` (cf. `02-design-conception/data-model.md`). Les images sont référencées par URL relative ou ID.

### 6.2 Pattern V1 — URL par locale dans le binding

```sql
-- component_field_bindings
component_id | field_name | value                              | locale
123          | image      | /images/hero-fr.jpg                | fr
123          | image      | /images/hero-ar.jpg                | ar
123          | image      | /images/hero-en.jpg                | en
```

L'éditeur CMS sait que `image` est localisable et propose un upload par locale.

### 6.3 Pattern V2 — Image neutre + métadonnées (alt) par locale

```sql
-- component_field_bindings
component_id | field_name | value                  | locale
123          | image_src  | /images/hero.jpg       | fr (single — neutral)
123          | image_alt  | "Mains élégantes ..."  | fr
123          | image_alt  | "يدان أنيقتان ..."     | ar
123          | image_alt  | "Elegant hands ..."    | en
```

→ V2 est plus efficace storage. À privilégier pour FemiGlow qui est majoritairement en stratégie A (neutre).

### 6.4 UI admin pour gestion images i18n

| Écran | Champs |
|---|---|
| Détail composant | `image_src` (1 upload), `image_alt` (3 inputs par locale) |
| Édition banner promo | `image_src_fr`, `image_src_ar`, `image_src_en` (3 uploads) |
| Indicateur visuel | Tag "Localisé" sur champ avec variantes par locale |

### 6.5 Validation upload

| Règle | Action |
|---|---|
| Image > 2 MB | Warning, propose compression |
| Aspect ratio inhabituel | Warning |
| Alt text manquant pour une locale | ERROR — bloque publication |
| Image avec texte détecté (OCR optionnel) | Warning "vérifier que texte est aussi en autres langues" |
| Nom de fichier sans locale suffix | Recommandation cosmétique |

### 6.6 Workflow étape par étape (créateur de contenu)

1. Éditeur ouvre le component dans admin
2. Voit champ `image` avec tab "Neutre" (par défaut) ou "Variantes par locale"
3. Si neutre : upload 1 fichier, remplit 3 alt texts (FR/AR/EN)
4. Si variantes : upload 3 fichiers, remplit 3 alt texts
5. Preview par locale (toggle FR/AR/EN dans admin)
6. Publish → CDN purge + new asset URL

## 7. CDN considérations

### 7.1 Cache stratégie

| Type | Cache TTL | Headers |
|---|---|---|
| Image neutre (réutilisable 3 locales) | 1 an | `Cache-Control: public, max-age=31536000, immutable` |
| Image variante par locale | 1 an | Idem (URLs différentes = cache séparé) |
| Image dynamique (panier preview) | 1 jour | `max-age=86400, must-revalidate` |

### 7.2 Format servir

Next.js Image gère automatiquement WebP / AVIF si supporté navigateur. Configuration globale :

```js
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

### 7.3 CDN edge

Si FemiGlow utilise Vercel CDN ou Cloudflare :

- Image neutre stockée 1 fois, servie depuis edge le plus proche
- Variante par locale = 3 entrées CDN distinctes (acceptable si peu de variantes)
- Image processing (resize, format conversion) cache au edge

### 7.4 URLs versionnées

Pour invalider le cache sans purge manuelle :

```
/images/hero-kit.v2.jpg
/images/hero-kit-fr.20260527.jpg
```

Pattern simple : versionnage via query param :

```tsx
<Image src={`/images/hero-kit.jpg?v=${VERSION}`} />
```

## 8. Lazy loading et priorité

### 8.1 `priority` prop

Activer sur les images above-the-fold uniquement :

```tsx
<Image src="/hero.jpg" alt={...} priority />
```

Limite : 1-2 par page max. Sinon, perte de perf.

### 8.2 Lazy par défaut

Toutes les autres images : Next.js applique lazy loading automatique. Pas d'action.

### 8.3 Placeholder blur

Pour images lourdes au-dessus du fold :

```tsx
import heroImg from '@/public/images/hero.jpg';

<Image src={heroImg} alt={...} placeholder="blur" />
```

`next/image` génère automatiquement un blur dataURL.

### 8.4 Sizes attribute

Indispensable pour images responsive :

```tsx
<Image
  src="/hero.jpg"
  alt={...}
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

Évite de servir 2048px sur mobile (économie bande passante massive).

## 9. Naming convention assets

### 9.1 Folder structure

```
public/
  images/
    home/
      hero-kit-mains.jpg        # neutre, 1 seul
      manifesto-bg.jpg
    kit/
      packshot-1.jpg
      packshot-2.jpg
      diagram-content/
        fr.svg                  # variante par locale
        ar.svg
        en.svg
    rituel/
      step-1.jpg
      ...
    journal/
      <slug>/
        cover.jpg               # cover article neutre
    banners/
      ramadan-2026/
        fr.jpg
        ar.jpg
        en.jpg
    legal/
      logo-cmi.svg              # neutre, partout
```

### 9.2 Naming règle

| Cas | Format |
|---|---|
| Neutre | `<page>/<section>-<element>.<ext>` ex: `home/hero-kit.jpg` |
| Variante par locale | `<page>/<section>-<element>/<locale>.<ext>` ex: `kit/diagram-content/fr.svg` |
| Versionné | `<page>/<element>.v<n>.<ext>` ex: `home/hero.v2.jpg` |

### 9.3 Formats préférés

| Usage | Format | Pourquoi |
|---|---|---|
| Photo packshot, hero | JPG ou WebP | Petit, qualité OK |
| Photo éditoriale haute qualité | WebP + AVIF fallback | Best compression |
| Logo | SVG | Vectoriel, scalable |
| Diagrammes / illustrations | SVG | Vectoriel |
| Icônes | SVG inline ou sprite | Vectoriel |
| Décoration / texture | WebP | Compromis |
| Animations | MP4 / WebM (pas GIF) | Poids |

## 10. SEO et Open Graph

### 10.1 OG image par locale

Chaque page doit déclarer une `og:image` localisée :

```tsx
// app/[locale]/kit/page.tsx
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });
  return {
    title: t('title'),
    openGraph: {
      images: [{
        url: `https://femiglow.ma/og/kit-${locale}.jpg`,
        width: 1200,
        height: 630,
        alt: t('og_image_alt'),
      }],
    },
  };
}
```

→ Variantes par locale obligatoires pour `og:image` (Facebook / Twitter ne re-traduisent pas).

### 10.2 Spec OG image

| Aspect | Valeur |
|---|---|
| Dimensions | 1200 × 630 px |
| Format | JPG ou PNG |
| Poids | < 1 MB |
| Texte | À inclure dans l'image (overlay HTML impossible en partage social) |

→ C'est un des rares cas où la stratégie B (variantes) est nécessaire.

### 10.3 Twitter card

```tsx
twitter: {
  card: 'summary_large_image',
  images: [`https://femiglow.ma/og/twitter-${locale}.jpg`],
}
```

## 11. Tests visuels

### 11.1 Test images par locale

```ts
// e2e/images/banners.spec.ts
test('ramadan banner shows correct locale variant', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.locator('[data-testid="ramadan-banner"]')).toHaveAttribute(
    'src',
    /ramadan-2026\/fr\.jpg/
  );

  await page.goto('/ar/');
  await expect(page.locator('[data-testid="ramadan-banner"]')).toHaveAttribute(
    'src',
    /ramadan-2026\/ar\.jpg/
  );
});
```

### 11.2 Test alt texts traduits

```ts
test('hero image alt is translated', async ({ page }) => {
  await page.goto('/fr/');
  const altFr = await page.locator('[data-testid="hero-img"]').getAttribute('alt');
  expect(altFr).toContain('Mains');

  await page.goto('/ar/');
  const altAr = await page.locator('[data-testid="hero-img"]').getAttribute('alt');
  expect(altAr).toContain('يدان');
});
```

### 11.3 Test OG image par locale

```ts
test('OG image URL contains locale', async ({ page }) => {
  await page.goto('/ar/kit');
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toContain('kit-ar.jpg');
});
```

### 11.4 Test screenshots regression visual

```ts
test('hero looks same in FR and AR (neutral image)', async ({ page }) => {
  await page.goto('/fr/');
  const heroFr = await page.locator('[data-testid="hero-img"]').screenshot();
  await page.goto('/ar/');
  const heroAr = await page.locator('[data-testid="hero-img"]').screenshot();
  // Buffer comparison
  expect(heroFr).toEqual(heroAr); // same image data
});
```

## 12. Anti-patterns

- ❌ Incruster du texte traduit dans une image JPG (lourd à maintenir, pas SEO)
- ❌ Stocker la même image neutre 3 fois (`hero-fr.jpg`, `hero-ar.jpg`, `hero-en.jpg` identiques)
- ❌ Oublier l'alt text quand image décorative (mettre `alt=""` explicite, pas omettre)
- ❌ Hardcoder un alt en FR pour les 3 locales
- ❌ Utiliser `Image` Next sans `sizes` sur responsive (gaspille bandwidth)
- ❌ Charger toutes les variantes en parallèle (pas de chargement conditionnel)
- ❌ Servir PNG quand WebP suffit (poids x3)
- ❌ Mettre `priority` sur 5+ images (CLS + LCP dégradés)
- ❌ Miroir CSS sur image avec texte (texte inversé illisible)
- ❌ OG image neutre sans texte (partage social = perte d'impact)
- ❌ Variante par locale d'une image neutre (gaspillage storage)
- ❌ Manquer un fallback locale (`banners.ramadan.fr` existe mais `.en` n'existe pas)
- ❌ Stocker images dans `messages.json` au lieu de `public/` (gonfle bundle)

## 13. Stratégie de migration depuis l'existant

### 13.1 Audit assets actuels

```bash
# Lister toutes les images contenant du texte (manuel ou OCR)
find apps/web/public/images -name "*.jpg" -o -name "*.png" | xargs -I{} echo "Reviewer needed: {}"
```

### 13.2 Audit usage dans le code

```bash
grep -r "Image src" apps/web/src --include="*.tsx" | wc -l
# Listing total des images utilisées
```

### 13.3 Plan de migration

| Étape | Action |
|---|---|
| 1 | Lister 100 % des `<Image>` dans le code |
| 2 | Classifier par stratégie cible (A/B/C) |
| 3 | Pour A : extraire `alt` vers messages.json |
| 4 | Pour B : produire variantes manquantes (designer) |
| 5 | Pour C : refactor avec overlay HTML |
| 6 | Migrer composant par composant (Header, Hero, Cards, etc.) |
| 7 | Tests visuels à chaque étape |
| 8 | Validation finale fondatrice |

### 13.4 Compatibilité backward

Tant que `ar` et `en` ne sont pas en prod, les variantes par locale peuvent être identiques au FR (placeholder). Le code i18n marche, on remplit au fur et à mesure.

## 14. Coût production estimé

### 14.1 Effort designer pour les variantes

| Type d'asset | Effort par locale |
|---|---|
| Banner promo (1200×400) | 30 min |
| OG image (1200×630) | 20 min |
| Diagramme avec labels | 1h |
| Carte cadeau | 45 min |

→ Pour 3 locales : ×3 effort.

### 14.2 Réduction grâce à stratégie A

Si on suit la doctrine "neutre par défaut", l'effort est :

- 90 % des assets : 1× effort (neutre)
- 10 % des assets (variantes obligatoires) : 3× effort

Économie globale : ~75 % du temps designer vs full-variantes.

## 15. Checklist livraison images i18n

- [ ] Inventaire complet des images du site (script + audit manuel)
- [ ] Classification A/B/C documentée
- [ ] Alt text extraits vers `messages.json` pour toutes images A
- [ ] Variantes créées pour images B (designer livre 3 versions)
- [ ] Pattern overlay HTML implémenté pour images C
- [ ] CMS UI gère le toggle "neutre / variantes" par champ image
- [ ] CDN configuré (cache 1 an, formats AVIF/WebP)
- [ ] Sizes prop renseigné sur toutes images responsive
- [ ] OG images générées par locale (Twitter + Facebook + LinkedIn)
- [ ] Tests visuels Playwright stables FR / AR / EN
- [ ] Validation a11y (alts présents, vides explicites pour décoratives)
- [ ] Lighthouse perf >= 90 sur pages avec images lourdes
- [ ] Mise à jour banners CMS testée par éditeur non-tech
- [ ] Documentation interne pour designers (naming, formats, neutre vs variantes)

## 16. Liens

- `rtl-support.md` section 6 — quand miroirer une image
- `02-design-conception/data-model.md` — schema `component_field_bindings`
- `04-frontend/` — composant `<LocalizedImage />` (à produire)
- `06-data-strategy/` — workflow upload assets via CMS
- `docs/kolenda/Color.pdf` — palette FemiGlow pour cohérence visuelle
