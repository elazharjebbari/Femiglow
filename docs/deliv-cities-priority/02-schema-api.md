# Schéma & API — Villes prioritaires

## 1. Migration SQL

```sql
-- 0054_priority_cities.sql
-- Attribution des positions优先 aux villes les plus commandées

UPDATE delivery_cities SET position =  1 WHERE slug = 'casablanca';
UPDATE delivery_cities SET position =  2 WHERE slug = 'marrakech';
UPDATE delivery_cities SET position =  3 WHERE slug = 'tanger';
UPDATE delivery_cities SET position =  4 WHERE slug = 'agadir';
UPDATE delivery_cities SET position =  5 WHERE slug = 'kenitra';
UPDATE delivery_cities SET position =  6 WHERE slug = 'fes';
UPDATE delivery_cities SET position =  7 WHERE slug = 'meknes';
UPDATE delivery_cities SET position =  8 WHERE slug = 'tetouan';
UPDATE delivery_cities SET position =  9 WHERE slug = 'dar-bouaza';
UPDATE delivery_cities SET position = 10 WHERE slug = 'mohammedia';
UPDATE delivery_cities SET position = 11 WHERE slug = 'el-jadida';
UPDATE delivery_cities SET position = 12 WHERE slug = 'bouskoura-ville-verte';
UPDATE delivery_cities SET position = 13 WHERE slug = 'oujda';
```

**Note** : Bouskoura-Ville Verte et Dar Bouaza devront être créées préalablement si elles n'existent pas en DB (soit via le seed, soit via l'admin).

## 2. Zod Schemas — Nouvel endpoint

### `deliveryCityPositionsSchema`

```typescript
// src/lib/checkout/delivery/schemas.ts

export const deliveryCityPositionsSchema = z.object({
  positions: z.array(
    z.object({
      slug: z.string().min(1).max(80),
      position: z.number().int().min(0).max(100000),
    })
  ).min(1).max(100),
});
```

### Endpoint `PATCH /api/admin/delivery-cities/positions`

**Request** :
```json
{
  "positions": [
    { "slug": "casablanca", "position": 1 },
    { "slug": "marrakech", "position": 2 },
    { "slug": "oujda", "position": 13 }
  ]
}
```

**Response 200** :
```json
{
  "updated": 3,
  "positions": [
    { "slug": "casablanca", "position": 1 },
    { "slug": "marrakech", "position": 2 },
    { "slug": "oujda", "position": 13 }
  ]
}
```

**Response 400** : Validation Zod
**Response 401** : Non authentifié
**Response 404** : Slug introuvable (retourne les slugs non trouvés)

## 3. Query — `updateDeliveryCityPositions`

```typescript
// src/lib/db/queries/delivery-cities.ts

export async function updateDeliveryCityPositions(
  patches: Array<{ slug: string; position: number }>,
  opts: { actorId?: string | null } = {},
): Promise<{ updated: number; notFound: string[] }> {
  const drizzle = db();
  let updated = 0;
  const notFound: string[] = [];

  if (drizzle) {
    for (const patch of patches) {
      const result = await drizzle
        .update(schema.deliveryCities)
        .set({
          position: patch.position,
          updatedAt: new Date(),
          updatedBy: opts.actorId ?? null,
        })
        .where(eq(schema.deliveryCities.slug, patch.slug));
      // Note: Drizzle .rowsAffected n'est pas disponible sur tous les drivers
      // On vérifie via un SELECT count après
    }
    // Vérification
    const slugs = patches.map(p => p.slug);
    const found = await drizzle
      .select({ slug: schema.deliveryCities.slug })
      .from(schema.deliveryCities)
      .where(inArray(schema.deliveryCities.slug, slugs));
    const foundSet = new Set(found.map(r => r.slug));
    for (const s of slugs) {
      if (!foundSet.has(s)) notFound.push(s);
    }
    updated = found.length;
    return { updated, notFound };
  }

  // Fallback mémoire
  const store = ext();
  for (const patch of patches) {
    let found = false;
    for (const [id, city] of store.deliveryCities) {
      if (city.slug === patch.slug) {
        store.deliveryCities.set(id, {
          ...city,
          position: patch.position,
          updatedAt: new Date(),
          updatedBy: opts.actorId ?? null,
        });
        found = true;
        break;
      }
    }
    if (found) updated++;
    else notFound.push(patch.slug);
  }
  return { updated, notFound };
}
```

## 4. Modification de `searchDeliveryCities` — Aucun changement nécessaire

La fonction `searchDeliveryCities` trie déjà par `position ASC, nameFr ASC` :

```typescript
// Query vide (top-N actifs)
.orderBy(
  asc(schema.deliveryCities.position),
  asc(schema.deliveryCities.nameFr),
)
```

Les villes avec `position > 0` apparaîtront en tête, suivies des villes avec `position = 0` triées alphabétiquement. C'est exactement le comportement souhaité.

## 5. Modification de `searchCities()` (fallback statique)

```typescript
// src/lib/checkout/data/moroccan-cities.ts

// Avant :
export function searchCities(query: string, limit = 8): MoroccanCity[] {
  const trimmed = query.trim();
  if (!trimmed) return MOROCCAN_CITIES.slice(0, limit);
  // ...
}

// Après :
export function searchCities(query: string, limit = 8): MoroccanCity[] {
  const trimmed = query.trim();
  if (!trimmed) {
    // Trier par position (> 0 en tête) puis alpha
    const sorted = [...MOROCCAN_CITIES].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa > 0 && pb > 0) return pa - pb;      // toutes deux优先 → par position
      if (pa > 0 && pb === 0) return -1;           // a优先, b non → a en tête
      if (pa === 0 && pb > 0) return 1;            // a non优先, b优先 → b en tête
      return a.label.localeCompare(b.label, 'fr'); // toutes deux non优先 → alpha
    });
    return sorted.slice(0, limit);
  }
  // ... (suite inchangée pour les queries avec texte)
}
```

## 6. Modification de l'interface `MoroccanCity`

```typescript
// Avant :
export interface MoroccanCity {
  value: string;
  label: string;
  labelAr: string;
  aliases?: string[];
  expressEligible: boolean;
}

// Après :
export interface MoroccanCity {
  value: string;
  label: string;
  labelAr: string;
  aliases?: string[];
  expressEligible: boolean;
  /** Position d'affichage (0 = non优先, >0 = prioritaire). */
  position: number;
}
```

## 7. Positions优先 dans les données statiques

```typescript
// Ajout du champ position aux 13 villes优先 (les autres restent à 0)
const PRIORITY_POSITIONS: Record<string, number> = {
  casablanca: 1,
  marrakech: 2,
  tanger: 3,
  agadir: 4,
  kenitra: 5,
  fes: 6,
  meknes: 7,
  tetouan: 8,
  'dar-bouaza': 9,
  mohammedia: 10,
  'el-jadida': 11,
  'bouskoura-ville-verte': 12,
  oujda: 13,
};

// Dans MOROCCAN_CITIES, chaque ville reçoit :
// position: PRIORITY_POSITIONS[value] ?? 0,
```