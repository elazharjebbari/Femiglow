# 30.2 — Service layer

> Couche métier `lib/tracking/mappings/`. Indépendante du framework
> (testable unitairement sans Next.js).

## Modules

### `store.ts` — CRUD + transitions

```typescript
export const mappingStore = {
  // Lecture
  list(opts: { status?: Status[]; limit?: number }): Promise<MappingVersionListItem[]>
  get(id: string): Promise<MappingVersion | null>
  getActive(): Promise<MappingVersion | null>
  getDefault(): Promise<MappingVersion | null>
  
  // Création
  create(input: { name: string; notes?: string; mappings: Mappings }, opts: { actorId: string }): Promise<MappingVersion>
  
  // Clone (D-001 : édition crée toujours une nouvelle version)
  clone(sourceId: string, overrides: { name?: string; notes?: string; mappings?: Mappings }, opts: { actorId: string }): Promise<MappingVersion>
  
  // Transitions
  activate(id: string, opts: { actorId: string }): Promise<MappingVersion>
  archive(id: string, opts: { actorId: string }): Promise<MappingVersion>
  softDelete(id: string, opts: { actorId: string }): Promise<void>
  restore(id: string, opts: { actorId: string }): Promise<MappingVersion>
  
  // Default
  upsertDefault(input: { mappings: Mappings; checksum: string }): Promise<MappingVersion>
  resetToDefault(opts: { actorId: string }): Promise<MappingVersion>
  
  // Test seam
  _resetForTests(opts: { actorId: string }): Promise<void>
};
```

**Invariants** :
- `create()`, `clone()` ne touchent pas `is_active` (toujours créées en `draft`)
- `activate()` est **atomique** (transaction) : désactive l'ancienne + active la nouvelle
- `softDelete()` refuse `is_active=true` ou `is_default=true` → throw `cannot_delete_active_or_default`
- `upsertDefault()` insère ou met à jour `id='__default__'`, `is_default=true`, `status='archived'`
- FIFO trim après chaque create/clone : garde max 50 rows, jamais supprime `is_active` ni `is_default`

### `resolver.ts` — résolution event → vendor

```typescript
export interface ResolvedMapping {
  mappedName: string;        // non-null garanti
  isCustom: boolean;
  notes: string | null;
}

export async function resolveEventMapping(
  eventName: string,
  providerKind: TrackingProviderKind,
): Promise<ResolvedMapping | null>; // null = pas de dispatch

export function invalidateMappingCache(): void;
```

**Implémentation** :
- Cache `Map<string, { value: ResolvedMapping | null; expiresAt: number }>` keyé par `${eventName}|${providerKind}`
- TTL 30s (configurable via env `MAPPING_CACHE_TTL_MS`)
- Lookup : DB `getActive()` (lui-même mémoïsé 30s) → JSONB access
- Si DB vide / pas d'active → fallback `event-mapping.ts` (compat période transitoire)

### `validator.ts` — Zod par provider

```typescript
import { z } from 'zod';

const META_NAME       = z.string().regex(/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/);
const GA4_NAME        = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const GOOGLE_ADS_NAME = z.string().max(60);
const TIKTOK_NAME     = z.string().max(50);
const SNAP_NAME       = z.string().max(50);
const PINTEREST_NAME  = z.string().max(50);

export const mappingCellSchema = z.object({
  mappedName: z.string().nullable(),
  isCustom: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  notes: z.string().max(200).nullable().optional(),
});

export function validateMappingForProvider(cell: MappingCell, kind: ProviderKind): z.SafeParseReturnType
```

### `gtm-export.ts` — Build GTM Container JSON

```typescript
export interface GtmExportInput {
  mappings: Mappings;
  env: 'production' | 'stage' | 'preview' | 'dev';
  containerName?: string;
  publicId?: string;
}

export interface GtmExportOutput {
  containerJson: GtmContainerImportFormat; // typé strictement
  meta: {
    sha256: string;
    eventsCount: number;
    tagsCount: number;
    variablesCount: number;
    triggersCount: number;
    env: string;
  };
}

export function buildGtmContainer(input: GtmExportInput): GtmExportOutput;
```

**Algorithme** :
1. Pour chaque event canonique de mappings :
   - Crée 1 trigger custom event GTM (clé : `_event === eventName`)
2. Pour chaque (event, provider) où `mappedName !== null && isEnabled === true` :
   - Crée 1 tag GTM (type : `cvt_meta_pixel`, `googtag`, etc. selon provider)
   - Référence le trigger correspondant
   - Si Meta + isCustom → tag type `trackCustom` avec eventName customisé
3. Liste les variables `DLV` (Data Layer Variables) référencées : `event_id`, `currency`, `value`, `items`
4. Assemble en `{ exportFormatVersion: 2, containerVersion: {...} }`
5. sha256 du payload pour intégrité

### `audit.ts` — Audit log

```typescript
export async function auditMappingChange(input: {
  versionId: string | null;
  action: MappingAuditAction;
  actorId: string;
  before?: object | null;
  after?: object | null;
  meta?: Record<string, unknown>;
}): Promise<void>;

export async function listAuditForVersion(versionId: string, opts?: { limit?: number }): Promise<MappingAuditEntry[]>;
```

## Diagramme appels

```
Route handler
  └─► store.X()
       ├─► validator.validateMappings()   (write only)
       ├─► drizzle (DB)
       └─► audit.auditMappingChange()

Route handler /test
  └─► resolver.resolveEventMapping() × 6 providers (parallel)

Route handler /export-gtm
  └─► store.get(id) → gtm-export.buildGtmContainer()

Dispatcher (consommateur runtime)
  └─► resolver.resolveEventMapping()  (cache hit 99%)
```

## Tests unit

- `store.test.ts` : 25+ tests (CRUD, transitions, FIFO, default upsert, edge cases)
- `resolver.test.ts` : 10+ tests (cache, fallback, invalidation, perf)
- `validator.test.ts` : 15+ tests (Zod par provider, formats invalides)
- `gtm-export.test.ts` : 12+ tests (build, sha256, round-trip)
- `audit.test.ts` : 8+ tests (insert, list, meta)
