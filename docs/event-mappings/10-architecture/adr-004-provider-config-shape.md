# ADR-004 — Forme du mapping par provider (cellule)

**Statut** : Proposed
**Date** : 2026-05-13
**Décideurs** : Tech Lead

## Contexte

Chaque cellule de la matrice (event × provider) doit décrire suffisamment pour le dispatcher, mais rester lisible et éditable côté admin.

## Options évaluées

### Option A — String simple `"Purchase"`
- Léger, compact
- ❌ Pas moyen de distinguer standard vs custom event Meta
- ❌ Pas moyen de désactiver temporairement un dispatch

### Option B — Object riche `{ mappedName, isCustom, isEnabled, notes? }` (recommandé) ★
- ✅ Explicite, extensible
- ✅ Permet feature-flag (isEnabled=false → skip dispatch)
- ✅ Permet Meta CustomEvent flag
- ⚠ Un peu plus lourd à éditer (3-4 champs au lieu de 1)

### Option C — Object complet `{ mappedName, isCustom, isEnabled, params, transformer, ... }`
- ❌ Overkill V1, params/transformer ne servent pas en V1 (le dispatcher gère déjà ça)

## Décision

**Option B** avec la shape suivante :

```typescript
interface MappingCell {
  /** Nom de l'event tel qu'envoyé au vendor. Vide ou null = pas de dispatch. */
  mappedName: string | null;
  /**
   * Pour Meta uniquement : true ⇒ envoyer en CustomEvent (trackCustom).
   * Pour les autres providers : ignoré.
   */
  isCustom: boolean;
  /**
   * Feature flag par cellule. Permet de désactiver temporairement
   * sans perdre la valeur mappedName.
   */
  isEnabled: boolean;
  /**
   * Notes admin (optionnel). Affichées en tooltip. Max 200 chars.
   */
  notes?: string | null;
}
```

## Conséquences

### Avantages
- Self-explanatory : 4 champs par cellule, pas de magie cachée
- Feature flag par cellule : marketing peut désactiver Meta sans toucher au mapping
- Notes : documentation inline (ex : "TikTok : pas de Purchase, on utilise CompletePayment selon doc 2024")

### Inconvénients
- Légère redondance avec `isEnabled` au niveau provider (futur) — résolu en V1 par : provider désactivé au niveau settings → toutes ses cellules ignorées

### Sérialisation dans `mappings_jsonb`

```json
{
  "purchase": {
    "meta":        { "mappedName": "Purchase",        "isCustom": false, "isEnabled": true,  "notes": null },
    "google_ga4":  { "mappedName": "purchase",        "isCustom": false, "isEnabled": true,  "notes": null },
    "google_ads":  { "mappedName": "purchase",        "isCustom": false, "isEnabled": true,  "notes": null },
    "tiktok":      { "mappedName": "CompletePayment", "isCustom": false, "isEnabled": true,  "notes": "TikTok event for purchase" },
    "snap":        { "mappedName": "PURCHASE",        "isCustom": false, "isEnabled": true,  "notes": null },
    "pinterest":   { "mappedName": "checkout",        "isCustom": false, "isEnabled": true,  "notes": null }
  },
  "form_start": {
    "meta":        { "mappedName": "form_start",      "isCustom": true,  "isEnabled": true,  "notes": "Meta CustomEvent, séparé de InitiateCheckout" },
    "google_ga4":  { "mappedName": "form_start",      "isCustom": false, "isEnabled": true,  "notes": null },
    "google_ads":  { "mappedName": null,              "isCustom": false, "isEnabled": false, "notes": null },
    "tiktok":      { "mappedName": null,              "isCustom": false, "isEnabled": false, "notes": null },
    "snap":        { "mappedName": null,              "isCustom": false, "isEnabled": false, "notes": null },
    "pinterest":   { "mappedName": null,              "isCustom": false, "isEnabled": false, "notes": null }
  }
}
```

### Validation Zod

```typescript
const META_NAME = z.string().min(1).max(40).regex(/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/);
const GA4_NAME  = z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]{0,39}$/);
const ADS_NAME  = z.string().min(1).max(60); // peu de restrictions
const TIKTOK_NAME    = z.string().min(1).max(50);
const SNAP_NAME      = z.string().min(1).max(50);
const PINTEREST_NAME = z.string().min(1).max(50);

const mappingCellSchema = z.object({
  mappedName: z.string().nullable(),
  isCustom: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  notes: z.string().max(200).nullable().optional(),
});

const mappingsByProviderSchema = z.object({
  meta:       mappingCellSchema.refine(c => c.mappedName === null || META_NAME.safeParse(c.mappedName).success),
  google_ga4: mappingCellSchema.refine(c => c.mappedName === null || GA4_NAME.safeParse(c.mappedName).success),
  google_ads: mappingCellSchema.refine(c => c.mappedName === null || ADS_NAME.safeParse(c.mappedName).success),
  tiktok:     mappingCellSchema.refine(c => c.mappedName === null || TIKTOK_NAME.safeParse(c.mappedName).success),
  snap:       mappingCellSchema.refine(c => c.mappedName === null || SNAP_NAME.safeParse(c.mappedName).success),
  pinterest:  mappingCellSchema.refine(c => c.mappedName === null || PINTEREST_NAME.safeParse(c.mappedName).success),
});

const mappingsSchema = z.record(z.string(), mappingsByProviderSchema);
```

## Fonction résolution

```typescript
export async function resolveEventMapping(
  eventName: string,
  providerKind: TrackingProviderKind,
): Promise<MappingCell | null> {
  const active = await store.getActive();
  if (!active) return fallbackFromCode(eventName, providerKind);
  const cell = active.mappings[eventName]?.[providerKind];
  if (!cell || !cell.isEnabled || !cell.mappedName) return null;
  return cell;
}
```

Le dispatcher fait : `if (cell === null) skip` au lieu de l'erreur silencieuse actuelle.

## Liens
- ADR-001 (versioning, structure DB)
- ADR-002 (default file shape)
- `30-backend/validation-rules.md`
