# 08 — Overrides per-média

## Pourquoi des overrides ?

La config globale (formats, breakpoints, qualités, stratégie de
chargement) couvre 95 % des cas. Les 5 % restants sont des médias
spéciaux :

- Le hero d'une landing qui doit être servi en `eager` même hors
  page d'accueil.
- Une illustration de journal qui doit garder le PNG (transparence)
  et ne pas être convertie en JPEG.
- Une vidéo de fond qui doit charger son poster en AVIF haute qualité
  même en `thumb`.
- Une image qui a un cadrage portrait sur mobile et paysage sur
  desktop (art direction).

Au lieu de forker la config globale, on stocke un **bloc JSONB
sparse** par média qui écrase ponctuellement la config.

## Structure JSON

```ts
interface MediaOverrides {
  // Stratégie de chargement
  loadingStrategy?: 'eager' | 'viewport' | 'idle' | 'interaction';

  // Profil de qualité
  qualityProfile?: 'hero' | 'inline' | 'thumb';

  // Liste explicite des breakpoints à générer
  breakpoints?: VariantBreakpoint[];

  // Liste explicite des formats à générer
  formats?: VariantFormat[];

  // Force la qualité de chaque format (override du profil)
  qualities?: Partial<Record<VariantFormat, number>>;

  // Lazy loading override (équivalent loadingStrategy mais court-form)
  lazy?: boolean;

  // FetchPriority HTML
  fetchPriority?: 'high' | 'low' | 'auto';

  // Génération du BlurHash
  blurhash?: boolean;

  // Art direction : médias différents selon breakpoint
  artDirection?: Partial<Record<VariantBreakpoint, { src: string; alt?: string }>>;

  // Loader Next/Image custom
  customLoader?: 'next' | 'cloudflare' | 'imgix';

  // SVG placeholder explicite (override de la génération auto)
  placeholderSvg?: string;

  // Empêche la conversion (passthrough même si source=upload)
  preventOptimization?: boolean;

  // Cache HTTP custom
  cacheControl?: string;
}
```

Toutes les clés sont **optionnelles**. Si absente → la config globale
ou le profil de contexte s'applique.

## Hiérarchie de résolution

L'ordre de précédence (du plus fort au plus faible) :

1. **Override per-média** (`media.overrides.X`)
2. **Prop du composant** (`<MediaImage loading="eager">`)
3. **Contexte d'usage** (`context="hero"` → profil `hero`)
4. **Config DB** (`media.loading_strategy`, `media.quality_profile`)
5. **Config globale** (`config.defaultLoadingStrategy`)

**Exception** : `is_hero=true` court-circuite tout ce qui concerne le
loading (cf. `07-lazy-loading.md` § "Règle absolue").

### Pseudo-code de résolution

```ts
export function resolveConfig(media: Media, context: MediaContext, props: ComponentProps): ResolvedConfig {
  const o = media.overrides;

  // Loading strategy
  let loadingStrategy: LoadingStrategy;
  if (media.isHero || context === 'hero' || props.priority) {
    loadingStrategy = 'eager';
  } else {
    loadingStrategy = o.loadingStrategy ?? props.loading ?? media.loadingStrategy ?? 'viewport';
  }

  // Quality profile
  const qualityProfile = o.qualityProfile ?? props.context ?? media.qualityProfile ?? 'inline';

  // Breakpoints
  const breakpoints = o.breakpoints ?? PROFILE_BREAKPOINTS[qualityProfile];

  // Formats
  const formats = o.formats ?? PROFILE_FORMATS[qualityProfile];

  // Qualities
  const qualities = { ...PROFILE_QUALITIES[qualityProfile], ...(o.qualities ?? {}) };

  // FetchPriority
  const fetchPriority = (media.isHero || context === 'hero' || props.priority)
    ? 'high'
    : (o.fetchPriority ?? 'auto');

  // BlurHash
  const useBlurhash = o.blurhash ?? true;

  return { loadingStrategy, qualityProfile, breakpoints, formats, qualities, fetchPriority, useBlurhash, artDirection: o.artDirection };
}
```

## Cas d'usage (exemples concrets)

### 1. Une image qui doit garder la transparence (PNG only)

```json
{
  "overrides": {
    "formats": ["webp", "png"],
    "preventOptimization": false
  }
}
```

Le pipeline génère WebP (avec alpha) et garde le PNG original. Pas de
JPEG (perdrait la transparence).

### 2. Hero hors page d'accueil

Image de fond d'une page de campagne marketing temporaire. On veut
`eager` même si `is_hero=false` :

```json
{
  "is_hero": false,
  "overrides": {
    "loadingStrategy": "eager",
    "fetchPriority": "high",
    "qualityProfile": "hero"
  }
}
```

Côté composant :

```tsx
<MediaImage slug="campagne-printemps-2026" priority />
```

(`priority` côté prop renforce, mais l'override DB suffit aussi.)

### 3. Art direction (mobile portrait, desktop paysage)

```json
{
  "overrides": {
    "artDirection": {
      "xs": { "src": "hero-rituel-mobile" },
      "sm": { "src": "hero-rituel-mobile" },
      "md": { "src": "hero-rituel-desktop" },
      "lg": { "src": "hero-rituel-desktop" },
      "xl": { "src": "hero-rituel-desktop" },
      "2xl": { "src": "hero-rituel-desktop" }
    }
  }
}
```

Le composant `<MediaImage slug="hero-rituel">` rend alors un
`<picture>` avec plusieurs `<source media="(…)">` qui pointent vers
deux médias **différents** (chacun ayant ses propres variants).

### 4. Image externe non optimisable (logo partenaire)

```json
{
  "source": "external",
  "original_url": "https://partner.example.com/logo.svg",
  "status": "passthrough",
  "overrides": {
    "preventOptimization": true,
    "loadingStrategy": "eager"
  }
}
```

Pas de pipeline, on rend l'URL telle quelle.

### 5. Vidéo dont on veut un poster AVIF haute qualité

Par défaut le poster utilise le profil `inline`. Pour un hero vidéo,
on veut un poster `hero` :

```json
{
  "kind": "video",
  "overrides": {
    "qualityProfile": "hero",
    "qualities": { "avif": 75, "webp": 80 }
  }
}
```

Le pipeline applique ce profil au poster extrait.

### 6. Pas de BlurHash pour une image vectorielle

```json
{
  "overrides": {
    "blurhash": false,
    "placeholderSvg": "/products/icon-rituel.svg"
  }
}
```

Le composant utilise directement le SVG fallback comme background, pas
de BlurHash.

### 7. Cache court pour une image volatile

```json
{
  "overrides": {
    "cacheControl": "public, max-age=300"
  }
}
```

(rare ; utile pour des graphes générés dynamiquement Phase 2)

## UI admin pour les overrides

Cf. `05-ui-ux-design.md` § "Section Override".

Le drawer affiche un formulaire structuré (pas du JSON brut), mais
permet aux power-users de basculer en mode JSON via un toggle.

Validation côté UI :

- Schéma Zod strict sur le bloc.
- Refus si `formats` contient un format non supporté.
- Warning si `breakpoints` exclut tous les breakpoints courants
  (l'image ne sera pas servie correctement).
- Confirmation si l'override invalide les variantes existantes
  ("Régénérer maintenant ?").

## Validation côté backend

Le PATCH `/api/admin/media/{id}` valide le bloc avec Zod :

```ts
const overridesSchema = z.object({
  loadingStrategy: z.enum(['eager', 'viewport', 'idle', 'interaction']).optional(),
  qualityProfile: z.enum(['hero', 'inline', 'thumb']).optional(),
  breakpoints: z.array(z.enum(['xs','sm','md','lg','xl','2xl'])).optional(),
  formats: z.array(z.enum(['avif','webp','jpeg','png','mp4','webm','mp3','opus','poster'])).optional(),
  qualities: z.record(z.enum(['avif','webp','jpeg','png']), z.number().int().min(1).max(100)).optional(),
  lazy: z.boolean().optional(),
  fetchPriority: z.enum(['high','low','auto']).optional(),
  blurhash: z.boolean().optional(),
  artDirection: z.record(
    z.enum(['xs','sm','md','lg','xl','2xl']),
    z.object({ src: z.string().min(1), alt: z.string().optional() }),
  ).optional(),
  customLoader: z.enum(['next','cloudflare','imgix']).optional(),
  placeholderSvg: z.string().optional(),
  preventOptimization: z.boolean().optional(),
  cacheControl: z.string().regex(/^[a-zA-Z0-9 ,=\-]+$/).optional(),
}).strict(); // strict() refuse les clés inconnues
```

Refus si :

- `artDirection.X.src` ne réfère à aucun média existant.
- `customLoader` est défini mais le hostname Vercel/Cloudflare/Imgix
  n'est pas autorisé dans `next.config.js`.
- `formats` exclut tous les formats du `kind` (ex. `formats: []` pour
  une image).

## Effet sur le pipeline

Quand `overrides` change ET que les variantes existantes deviennent
incohérentes :

```ts
// src/lib/media/queries/media.ts
export async function updateMediaOverrides(id: string, before: MediaOverrides, after: MediaOverrides) {
  const needsRegeneration = mustRegenerate(before, after);
  if (needsRegeneration) {
    await scheduleJob({ media_id: id, kind: 'regenerate', payload: { reason: 'overrides_changed' } });
  }
}

function mustRegenerate(before: MediaOverrides, after: MediaOverrides): boolean {
  return (
    !arrayEqual(before.breakpoints, after.breakpoints) ||
    !arrayEqual(before.formats, after.formats) ||
    !objectEqual(before.qualities, after.qualities) ||
    before.qualityProfile !== after.qualityProfile ||
    before.preventOptimization !== after.preventOptimization
  );
}
```

Les overrides qui ne touchent pas au pipeline (`loadingStrategy`,
`fetchPriority`, `lazy`) ne déclenchent **pas** de régénération.

## Diff et audit

Chaque modification d'overrides logge un `audit_event`
`media.override_changed` avec :

```json
{
  "media_id": "me_4k7m2n",
  "before": { "loadingStrategy": "viewport" },
  "after": { "loadingStrategy": "eager", "fetchPriority": "high" },
  "actor": "admin_xxx"
}
```

Le drawer admin affiche le journal d'audit (cf. `05-ui-ux-design.md`
§ "Section Journal").

## Testabilité

Tests unit (Vitest) sur `resolveConfig` :

```ts
describe('resolveConfig', () => {
  it('hero overrides loadingStrategy to eager', () => {
    const media = { isHero: true, loadingStrategy: 'idle', overrides: {} };
    const result = resolveConfig(media, 'inline', {});
    expect(result.loadingStrategy).toBe('eager');
  });

  it('per-media override beats config DB', () => {
    const media = { isHero: false, loadingStrategy: 'viewport', overrides: { loadingStrategy: 'eager' } };
    expect(resolveConfig(media, 'inline', {}).loadingStrategy).toBe('eager');
  });

  it('component prop beats DB but not override', () => {
    const media = { overrides: { loadingStrategy: 'idle' } };
    expect(resolveConfig(media, 'inline', { loading: 'eager' }).loadingStrategy).toBe('idle');
  });

  it('priority prop forces eager', () => {
    const media = { overrides: { loadingStrategy: 'idle' } };
    expect(resolveConfig(media, 'inline', { priority: true }).loadingStrategy).toBe('eager');
  });

  it('art direction merges breakpoint sources', () => {
    const media = { overrides: { artDirection: { xs: { src: 'mobile' }, md: { src: 'desktop' } } } };
    expect(resolveConfig(media, 'hero', {}).artDirection).toBeDefined();
  });
});
```

Couverture cible : 100 % des branches de résolution.

## Évolutivité

Si on ajoute une nouvelle option (ex. `dpr` cap pour limiter les
écrans Retina à 2x au lieu de 3x), on étend `MediaOverrides` :

1. Ajouter le champ optionnel dans `types.ts`.
2. Ajouter la validation Zod.
3. Étendre `resolveConfig`.
4. Ajouter l'UI dans le drawer.

**Aucune migration DB** car JSONB est sparse. Les médias existants
n'ont simplement pas la clé.
