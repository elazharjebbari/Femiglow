# 04 — Design backend / CMS / API

Conception des couches backend touchées : CMS adapter, services, API admin, validation, cache.

## 1. Architecture cible

```
                +---------------------------------+
   Public RSC   | KitPage (Server Component)      |
                |   └─ cms.getKitPageContent()    |
                +-----------------+---------------+
                                  |
                                  v
                +---------------------------------+
   CMS adapter  | apps/web/src/lib/cms/index.ts   |
                |   ├─ mock (production court)    |
                |   └─ sanity (Phase 2, hors)     |
                +-----------------+---------------+
                                  |
                  override admin  v   (phase 6)
                +---------------------------------+
   Override DB  | kitSubProductsOverrides         |
                |   (phase 6, table optionnelle)  |
                +-----------------+---------------+
                                  |
                                  v
                +---------------------------------+
                | mock/kit.ts (defaults TS)       |
                +---------------------------------+
```

## 2. CMS — `getKitPageContent()`

### 2.1 Signature actuelle

```ts
// apps/web/src/lib/cms/types.ts
interface KitPageContent {
  hero: HeroContent;
  composition: SubProduct[];       // ← cible de la refonte
  comparatif: ComparatifData;
  videoSrc: VideoSrc;
  faq: FaqItem[];
  reassurances: ReassuranceData[];
  handsTestimonials: HandTestimonial[];
  // ... autres
}

export async function getKitPageContent(): Promise<KitPageContent>;
```

### 2.2 Phase 1 — extension transparente

Aucune modification de signature. Les nouveaux champs `sensation`, `contextualImage`, `accentColor` sont portés par l'objet `SubProduct` (cf. `03-data-model.md`). L'adapter mock retourne les valeurs enrichies.

```ts
// apps/web/src/lib/cms/mock/kit.ts (déjà existant, à étendre)
export const mockKitPageContent: KitPageContent = {
  ...,
  composition: [
    {
      id: '1-paste',
      name: 'Paste',
      volume: '15 g',
      sensation: 'Tiède au contact.',                // ← nouveau
      accentColor: 'sauge',                          // ← nouveau
      shortDescription: 'Crème onctueuse, sauge verte. Une noisette filme dix doigts.',
      image: { src: '...', alt: '...', width: 800, height: 1000 },
      // contextualImage rempli en phase 3
      ingredients: [...],
      certifications: [...],
    },
    // ... 2 autres
  ],
};
```

### 2.3 Phase 6 — override admin

Ajout d'un service `resolveKitComposition()` qui applique la cascade :

```ts
// apps/web/src/lib/cms/composition-resolver.ts (nouveau, phase 6)
export async function resolveKitComposition(): Promise<SubProduct[]> {
  const baseline = (await getKitPageContent()).composition;
  const overrides = await getKitSubProductsOverrides();   // depuis DB

  return baseline.map((sub) => {
    const override = overrides.get(sub.id);
    if (!override || !override.publishedAt) return sub;
    return {
      ...sub,
      name: override.name ?? sub.name,
      shortDescription: override.shortDescription ?? sub.shortDescription,
      volume: override.volume ?? sub.volume,
      sensation: override.sensation ?? sub.sensation,
      accentColor: override.accentColor ?? sub.accentColor,
      ingredients: override.ingredients ?? sub.ingredients,
      certifications: override.certifications ?? sub.certifications,
    };
  });
}
```

`KitPage` consommerait `resolveKitComposition()` au lieu de `content.composition` direct.

## 3. Services internes

### 3.1 `lib/composition/copy.ts` (nouveau, phase 1)

Fonctions pures de formatage utilisées par `CompositionCard`. Test-first.

```ts
/**
 * Construit la ligne d'en-tête `{name} · {volume}` avec normalisation
 * de la casse du volume (« 15 G » → « 15 g »).
 */
export function buildCardHeader(sub: SubProduct): string {
  const volume = sub.volume.toLowerCase().trim();
  return `${sub.name} · ${volume}`;
}

/**
 * Encadre la sensation entre guillemets français si non vide.
 * Retourne null si absente — l'appelant n'affiche rien.
 */
export function formatSensation(sub: SubProduct): string | null {
  if (!sub.sensation) return null;
  return `« ${sub.sensation.trim()} »`;
}

/**
 * Pastille numérotée — 2 digits zero-padded.
 */
export function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * Mappe accentColor enum → hex color de la palette.
 */
const ACCENT_HEX: Record<NonNullable<SubProduct['accentColor']>, string> = {
  sauge: '#A8B89E',
  petale: '#F2CECC',
  ciel: '#C5DBE5',
  champagne: '#B8956B',
};
export function resolveAccentHex(accent: SubProduct['accentColor']): string {
  return ACCENT_HEX[accent ?? 'champagne'];
}
```

### 3.2 `lib/composition/media.ts` (nouveau, phase 3)

Helpers Component-Media pour les images contextuelles. Côté server only.

```ts
import 'server-only';
import { resolveComponentSlot } from '@/lib/components/resolve';

const CONTEXTUAL_SLOTS: Record<string, string> = {
  '1-paste': 'kit-base-contextual',
  '2-powder': 'kit-fortifiant-contextual',
  'polissoir-step-4': 'kit-lime-contextual',
};

export async function resolveContextualSlot(subProductId: string) {
  const slot = CONTEXTUAL_SLOTS[subProductId];
  if (!slot) return null;
  return resolveComponentSlot('kit-comparatif', slot);
}
```

## 4. API admin (phase 6)

### 4.1 Routes prévues

| Route | Méthode | Rôle |
|---|---|---|
| `/api/admin/kit/composition` | GET | Liste les 3 sous-produits avec leurs overrides |
| `/api/admin/kit/composition/[id]` | GET | Lit l'override d'un sous-produit |
| `/api/admin/kit/composition/[id]` | PATCH | Met à jour le draft |
| `/api/admin/kit/composition/[id]/publish` | POST | Publie le draft (snapshot audit) |
| `/api/admin/kit/composition/[id]/unpublish` | POST | Repasse en draft (rendu public retombe sur mock) |
| `/api/admin/kit/composition/[id]/reset` | POST | Supprime l'override (rendu retombe sur mock) |

### 4.2 Validation Zod

```ts
// apps/web/src/lib/composition/schemas.ts (phase 6)
export const kitSubProductOverrideUpsertSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  shortDescription: z.string().min(1).max(280).optional(),
  volume: z.string().min(1).max(20).optional(),
  sensation: z
    .string()
    .min(1)
    .max(80)
    .regex(/[.!?»]$/)
    .nullable()
    .optional(),
  accentColor: z.enum(['sauge', 'petale', 'ciel', 'champagne']).nullable().optional(),
  ingredients: z.array(ingredientDetailedSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
});
```

### 4.3 Audit trail

À chaque mutation, log `auditEvent` :

| Action | Meta |
|---|---|
| `composition.draft` | `{ id, fields: Object.keys(patch) }` |
| `composition.publish` | `{ id, previous: snapshotBeforePublish }` |
| `composition.unpublish` | `{ id }` |
| `composition.reset` | `{ id, previous: full override deleted }` |

Préserve la possibilité de retour en arrière manuel.

### 4.4 Cache et revalidation

À chaque publish/unpublish/reset :

```ts
revalidateTag('kit-composition');
revalidatePath('/kit');
```

`KitPage` lit avec :

```ts
const compositionTag = ['kit-composition'];
const composition = await unstable_cache(
  () => resolveKitComposition(),
  ['kit-composition-v1'],
  { tags: compositionTag, revalidate: 3600 },
)();
```

## 5. Sécurité

- **Auth admin** sur toutes les routes (`getAdminSession`).
- **Validation Zod** stricte sur tous les inputs (rejet 400).
- **Whitelisting des accentColors** par enum Zod, pas de hex libre.
- **Sanitization** des descriptions / sensations : aucun HTML accepté (Zod `.string()` neutre, le rendu utilise `{value}` JSX).
- **Rate limit** non critique sur ces endpoints faiblement traffickés ; pas de protection ajoutée.

## 6. Observabilité

- Logs structurés à chaque mutation (`logger.info`, scope `composition`).
- Header de debug `x-composition-source: override|mock` côté admin uniquement (pas en public).
- Métriques :
  - Compteur d'overrides publiés par sous-produit.
  - Compteur de revalidations déclenchées.
  - Latence P95 de `resolveKitComposition()`.

## 7. Compatibilité

- **Zéro changement de signature publique.** `getKitPageContent()` retourne le même type, enrichi de champs optionnels.
- **Feature flag `NEXT_PUBLIC_COMPOSITION_V2`** : si `false`, le rendu retombe sur l'ancien `CompositionReveal` (phase 0 visuels appliqués, mais sans crossfade ni vue éclatée).
- **Rollback granulaire** : chaque phase est indépendante. Phase 6 (admin) peut être désactivée sans toucher au rendu public.

## 8. Risques backend

| Risque | Mitigation |
|---|---|
| `unstable_cache` ne revalide pas le tag en dev | Documenté, vérifier en build prod |
| Cascade override → mock → schema cassée si mock invalide | Test Vitest `mockKitPageContent` parsé par `kitPageContentSchema` |
| Override DB stale après changement schema | Migration script en phase 6 qui valide chaque ligne |
| Photo contextuelle introuvable côté DB | `resolveContextualSlot` retourne `null`, le composant masque le crossfade sans crash |
