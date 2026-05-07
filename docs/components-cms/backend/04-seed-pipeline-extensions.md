# B4 — Extensions du seed-pipeline

## Contrat

> Le pipeline existant (`seed-pipeline.ts`) synchronise le registre
> des composants et leurs médias. Cette extension lui ajoute la
> synchronisation des **bindings de champs** : pour chaque
> `ComponentFieldDefinition` du registre, garantir qu'il existe une
> ligne `published` initiale en DB avec la valeur `defaultValue`.
>
> Idempotence stricte : re-jouer le seed ne modifie aucun binding
> existant ; il **ajoute** seulement les manquants et **archive**
> seulement les orphelins.

## Pourquoi

Sans cette extension, le rendu RSC tomberait sur la cascade
(`defaultValue` du registre, A3) — ce qui marche techniquement, mais :

1. l'admin verrait toujours « jamais publié » dans l'UI, alors que la
   valeur du registre est en pratique en ligne ;
2. on ne pourrait pas tracer l'historique d'édition à partir de la
   valeur initiale ;
3. la migration A2 phase 1 (insérer un seed `published` v1) n'aurait
   pas lieu.

L'extension comble ces trois points.

## Position dans le pipeline

```
seedFromDocs(opts)
├─ phase: registry      (existant)  ← upsert siteComponents
├─ phase: animations    (existant)
├─ phase: fields        ◄── nouveau
│   ├─ pour chaque composant du registre
│   │   ├─ pour chaque field défini :
│   │   │   ├─ si pas de binding (componentId, fieldKey, locale='fr', status='published'):
│   │   │   │   └─ INSERT binding published v1 = encodeValue(defaultValue, type)
│   │   │   └─ sinon : NO-OP (jamais d'overwrite d'une valeur publiée)
│   │   └─ détecter les bindings orphelins (fieldKey absent du registre)
│   │       └─ UPDATE status='archived'
└─ phase: images        (existant)
```

Phase **après** registry/animations, **avant** images : on veut que
`siteComponents` soit à jour, mais peu importe l'état des médias.

## API

```ts
// apps/web/src/lib/components/field-seed.ts
import 'server-only';

export interface FieldSeedReport {
  inserted: number;             // nouveaux bindings published v1
  archived: number;             // orphelins
  skipped: number;              // déjà présents
  warnings: Array<{
    componentKey: string;
    fieldKey: string;
    reason: 'missing_default_required' | 'invalid_default';
  }>;
}

export async function syncComponentFieldBindings(opts: {
  dryRun?: boolean;
  actorId?: string | null;
  onProgress?: (event: SeedProgressEvent) => void;
}): Promise<FieldSeedReport>;
```

L'appelant l'invoque depuis `seedFromDocs` :

```ts
// apps/web/src/lib/components/seed-pipeline.ts (modifications)
import { syncComponentFieldBindings } from './field-seed';

export async function seedFromDocs(opts: SeedOptions = {}): Promise<SeedReport> {
  // … phases registry et animations existantes …

  if (opts.syncFields !== false) {
    emit({ type: 'phase', phase: 'fields', total: 0, message: 'Synchronisation des champs…' });
    if (!opts.dryRun) {
      const fieldsReport = await syncComponentFieldBindings({
        dryRun: false,
        actorId: opts.actorId ?? null,
        onProgress: opts.onProgress,
      });
      report.fields = fieldsReport;
    } else {
      report.fields = { inserted: 0, archived: 0, skipped: 0, warnings: [] };
    }
  }

  // … phase images …
}
```

`SeedPhase` est étendu : `'registry' | 'animations' | 'fields' | 'images'`.
`SeedReport` reçoit un nouveau champ `fields: FieldSeedReport`.

## Implémentation

```ts
// apps/web/src/lib/components/field-seed.ts
import 'server-only';
import { revalidateTag } from 'next/cache';
import { SITE_COMPONENT_REGISTRY } from './registry';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  insertPublishedFieldBindingIfMissing,
  archiveFieldBindingsNotIn,
  listPublishedFieldBindings,
} from '@/lib/db/queries/component-fields';
import { encodeValue } from './field-encoding';
import { validateFieldValue } from './field-validation';

export async function syncComponentFieldBindings(opts: {
  dryRun?: boolean;
  actorId?: string | null;
  onProgress?: (event: SeedProgressEvent) => void;
}): Promise<FieldSeedReport> {
  const report: FieldSeedReport = {
    inserted: 0,
    archived: 0,
    skipped: 0,
    warnings: [],
  };

  const total = SITE_COMPONENT_REGISTRY.reduce(
    (n, seed) => n + (seed.fields?.length ?? 0),
    0,
  );
  opts.onProgress?.({ type: 'phase', phase: 'fields', total, message: 'Synchronisation des champs…' });

  let current = 0;
  const archivedComponents = new Set<string>();

  for (const seed of SITE_COMPONENT_REGISTRY) {
    const fields = seed.fields ?? [];
    if (fields.length === 0) continue;

    const cmp = await getSiteComponentByKey(seed.key);
    if (!cmp) continue; // sera créé à la phase registry suivante

    const registryKeys = new Set(fields.map((f) => f.key));

    // 1. Insert manquants
    for (const fieldDef of fields) {
      current += 1;
      try {
        // a. Cas required mais pas de defaultValue → warning, skip
        if (fieldDef.required && fieldDef.defaultValue === undefined) {
          report.warnings.push({
            componentKey: seed.key,
            fieldKey: fieldDef.key,
            reason: 'missing_default_required',
          });
          opts.onProgress?.({
            type: 'item', phase: 'fields', current, total,
            item: `${seed.key}/${fieldDef.key}`, status: 'error',
            message: 'required sans defaultValue',
          });
          continue;
        }
        // b. Pas de defaultValue tout court → skip silencieux (le rendu tombera sur null si !required)
        if (fieldDef.defaultValue === undefined) {
          report.skipped += 1;
          continue;
        }
        // c. Validation Zod du defaultValue (sécurité : un PR avec un default invalide doit échouer)
        const valid = validateFieldValue(fieldDef.defaultValue, fieldDef);
        if (!valid.success) {
          report.warnings.push({
            componentKey: seed.key,
            fieldKey: fieldDef.key,
            reason: 'invalid_default',
          });
          continue;
        }

        if (opts.dryRun) {
          report.inserted += 1;
          continue;
        }

        // d. INSERT IF NOT EXISTS (idempotent côté SQL)
        const inserted = await insertPublishedFieldBindingIfMissing({
          componentId: cmp.id,
          fieldKey: fieldDef.key,
          locale: 'fr',
          encodedValue: encodeValue(fieldDef.defaultValue, fieldDef.type),
          version: 1,
          authorId: opts.actorId ?? null,
        });

        if (inserted) {
          report.inserted += 1;
          opts.onProgress?.({
            type: 'item', phase: 'fields', current, total,
            item: `${seed.key}/${fieldDef.key}`, status: 'seeded',
          });
        } else {
          report.skipped += 1;
          opts.onProgress?.({
            type: 'item', phase: 'fields', current, total,
            item: `${seed.key}/${fieldDef.key}`, status: 'skipped',
          });
        }
      } catch (err) {
        report.warnings.push({
          componentKey: seed.key,
          fieldKey: fieldDef.key,
          reason: 'invalid_default',
        });
      }
    }

    // 2. Archiver les orphelins (bindings existants pour des keys absentes du registre)
    if (!opts.dryRun) {
      const archived = await archiveFieldBindingsNotIn(cmp.id, Array.from(registryKeys));
      if (archived > 0) {
        report.archived += archived;
        archivedComponents.add(seed.key);
      }
    }
  }

  // 3. Invalidation de cache pour les composants ayant subi une archivage
  //    (les inserts purs n'invalident pas : la cascade avant insert renvoyait
  //    déjà la même valeur via defaultValue → cache stable).
  if (!opts.dryRun && archivedComponents.size > 0) {
    revalidateTag('components');
    for (const key of archivedComponents) {
      revalidateTag(`components:fields:${key}`);
    }
  }

  return report;
}
```

## SQL `INSERT IF MISSING`

```sql
-- queries/component-fields.ts
INSERT INTO component_field_bindings
  (id, "componentId", "fieldKey", locale, value, status, version, "publishedAt", "authorId", "createdAt", "updatedAt")
VALUES
  ($1, $2, $3, $4, $5, 'published', 1, NOW(), $6, NOW(), NOW())
ON CONFLICT (componentId, fieldKey, locale) WHERE status = 'published'
DO NOTHING
RETURNING id;
```

L'index unique partial `cfb_publish_uniq` (cf. A2) garantit
l'idempotence : le `ON CONFLICT … DO NOTHING` rend l'insert
re-jouable sans risque.

## Politique d'overwrite : NEVER

> Si un binding `published` existe pour `(componentId, fieldKey, 'fr')`,
> le seed **ne le touche pas**, même si `defaultValue` du registre a
> changé.

Justification :

- Le `defaultValue` est la **valeur initiale d'amorçage**, pas la
  source de vérité.
- Une fois le binding publié, c'est l'**admin** qui décide
  (modification, restauration). Si un PR change `defaultValue`,
  l'admin garde la main : aucun overwrite silencieux.
- Si l'équipe veut effectivement aligner sur la nouvelle valeur, on
  utilise un script ad hoc (cf. R5) qui :
  1. archive le binding actuel (cf. A4 transition `published →
     archived` via republish),
  2. insère un nouveau `published` avec la nouvelle valeur,
  3. invalide les tags.

## Détection des orphelins

Un binding est **orphelin** quand `fieldKey` n'apparaît plus dans
`component.fields` du registre (ex un PR supprime le champ).

```sql
UPDATE component_field_bindings
SET status = 'archived', "updatedAt" = NOW()
WHERE "componentId" = $1
  AND "fieldKey" NOT IN ( <registry keys> )
  AND status IN ('published', 'draft', 'scheduled');
```

L'archivage ajoute aussi une ligne dans `component_field_history`
avec `action='archive'` (audit visible).

> Note : on n'archive **pas** les lignes `archived`. Idempotence.

## Avertissements émis

| Code | Sens | Action attendue |
|---|---|---|
| `missing_default_required` | `field.required=true && defaultValue===undefined` | Corriger le registre. Le seed skip ; le rendu RSC affichera un placeholder dev. |
| `invalid_default` | `defaultValue` ne passe pas le schéma Zod du field | Corriger le registre. Bug clair côté code. |

Les warnings sont remontés dans `SeedReport` et affichés dans le
panneau admin du runbook (cf. R5).

## Idempotence vérifiée par les tests

```ts
// apps/web/src/lib/components/field-seed.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { syncComponentFieldBindings } from './field-seed';
import { resetDb, listAllBindings } from '@/test/utils/db';

describe('syncComponentFieldBindings', () => {
  beforeEach(async () => { await resetDb(); /* seed registry */ });

  it('insère un binding published v1 par champ', async () => {
    const r = await syncComponentFieldBindings({});
    expect(r.inserted).toBeGreaterThan(0);
    expect(r.archived).toBe(0);
  });

  it("est idempotent : 2nd run ne change rien", async () => {
    await syncComponentFieldBindings({});
    const r = await syncComponentFieldBindings({});
    expect(r.inserted).toBe(0);
    expect(r.skipped).toBeGreaterThan(0);
  });

  it("ne touche pas un binding modifié par un admin", async () => {
    await syncComponentFieldBindings({});
    await editBindingValue('home-hero', 'title', 'Édité par admin');
    await syncComponentFieldBindings({});
    expect(await readBinding('home-hero', 'title')).toMatchObject({
      value: { v: 'Édité par admin' },
    });
  });

  it("archive un orphelin quand un field disparaît du registre", async () => {
    await syncComponentFieldBindings({});
    removeFieldFromRegistry('home-hero', 'kicker');
    const r = await syncComponentFieldBindings({});
    expect(r.archived).toBe(1);
    const orphan = await readBinding('home-hero', 'kicker');
    expect(orphan?.status).toBe('archived');
  });

  it("warne sur required sans defaultValue", async () => {
    addRequiredFieldWithoutDefault('home-hero', 'newRequired');
    const r = await syncComponentFieldBindings({});
    expect(r.warnings).toContainEqual(
      expect.objectContaining({ fieldKey: 'newRequired', reason: 'missing_default_required' }),
    );
  });

  it("dryRun ne touche pas la DB", async () => {
    const before = await listAllBindings();
    await syncComponentFieldBindings({ dryRun: true });
    const after = await listAllBindings();
    expect(after).toEqual(before);
  });
});
```

Cf. T2.

## Performance

- ~30 composants × 8 fields = 240 itérations.
- Chaque insert : `INSERT … ON CONFLICT DO NOTHING` (≈ 2 ms en
  Postgres local).
- Total seed-fields : **< 600 ms** sur DB local. Négligeable
  comparé à la phase images (qui domine).

## Cross-références

- A2 : encodage `value` jsonb (`encodeValue`).
- A3 EC1, EC2 : edge cases champ supprimé/ajouté.
- A4 : transitions, history.
- B2 : `validateFieldValue` réutilisé pour valider les `defaultValue`.
- B3 : tags invalidés sur archivage.
- R5 : runbook pour aligner DB sur registre quand `defaultValue` change après coup.
