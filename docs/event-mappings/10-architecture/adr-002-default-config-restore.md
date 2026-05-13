# ADR-002 — Configuration par défaut et restauration

**Statut** : Proposed
**Date** : 2026-05-13
**Décideurs** : Tech Lead

## Contexte

L'utilisateur doit pouvoir "revenir au default factory" en 1 click. La question est : **qu'est-ce que c'est, ce default, et où vit-il ?**

## Options évaluées

### Option A — Default généré à la volée depuis `event-mapping.ts` (code)
- ✅ Toujours en sync avec le code
- ❌ Si on supprime un event du code, le default change silencieusement
- ❌ Pas de "factory" stable au sens marketing

### Option B — Default = fichier JSON versionné `20-data/default-mapping.json` (recommandé) ★
- Le fichier est la SSOT immutable du factory
- Le seed (boot ou commande) lit ce fichier et insère/met à jour une version `id = '__default__'`, `status = 'archived'`, `is_default = true`
- "Reset" = activate cette version
- ✅ Versionnable git + traçable
- ✅ Stable, ne dérive pas du code
- ✅ Marketing peut PR sur le default si besoin (review)
- ⚠ Le default peut diverger du code `event-mapping.ts` → mitigé par test CI

### Option C — Default = première version créée à l'install
- ❌ Aléatoire, non reproductible
- ❌ Pas de référence stable

## Décision

**Option B**.

## Conséquences

### Garanties
- Le fichier `docs/event-mappings/20-data/default-mapping.json` est **immutable** (PR/review obligatoire)
- L'ID `__default__` est réservé : tentative create avec cet id → 409 Conflict
- `is_default = true` est read-only via l'UI (le bouton "Éditer" est désactivé, hint explicite)
- Le seed est idempotent : si la version `__default__` existe déjà, on UPSERT son `mappings` depuis le fichier
- Le seed tourne :
  - Au boot du serveur (best-effort, async, non bloquant)
  - À la commande `pnpm seed:tracking` (sync)
  - À chaque restore via runbook

### Risques
- **R-A : Drift `default-mapping.json` vs `event-mapping.ts`**
  - Mitigation : test CI `pnpm tracking:check-default-mapping` qui parse les deux et fail si écart
  - Le PR qui modifie l'un doit modifier l'autre (CI bloque sinon)

- **R-B : Bouton "Reset" supprime des overrides admin sans warning**
  - Mitigation : Confirm modale obligatoire avec un récap des changements ("vous allez perdre les modifs de version v5 → reset au default")

## Implémentation

### Fichier `default-mapping.json`
```json
{
  "_meta": {
    "schemaVersion": 1,
    "generatedFromCode": "apps/web/src/lib/tracking/providers/event-mapping.ts",
    "generatedAt": "2026-05-13",
    "checksum": "sha256:...",
    "notes": "Source de vérité du factory mapping FemiGlow. Modifier en PR review-required."
  },
  "mappings": {
    "purchase": {
      "meta":        { "mappedName": "Purchase",       "isCustom": false, "isEnabled": true },
      "google_ga4":  { "mappedName": "purchase",       "isCustom": false, "isEnabled": true },
      "google_ads":  { "mappedName": "purchase",       "isCustom": false, "isEnabled": true },
      "tiktok":      { "mappedName": "CompletePayment","isCustom": false, "isEnabled": true },
      "snap":        { "mappedName": "PURCHASE",       "isCustom": false, "isEnabled": true },
      "pinterest":   { "mappedName": "checkout",       "isCustom": false, "isEnabled": true }
    },
    "form_start": { /* ... */ }
  }
}
```

### Seed (résumé)
```ts
// scripts/seed-event-mappings.ts (ou inline dans seed-tracking.ts)
async function seedDefaultMapping() {
  const fileContent = JSON.parse(readFileSync('docs/event-mappings/20-data/default-mapping.json'));
  await store.upsertDefault({
    mappings: fileContent.mappings,
    checksum: fileContent._meta.checksum,
  });
}
```

### Reset (route)
```
POST /api/admin/tracking/events/mappings/reset-default
→ store.activateById('__default__')
→ audit (action='reset_to_default', actor)
→ 200 OK
```

### Bouton "Reset" UI
- Bouton dans la liste des versions, visible seulement si l'active n'est pas `is_default`
- Confirm modale : "Revenir au mapping par défaut FemiGlow ? Tous les overrides de la version v3 (active) seront archivés mais récupérables."
- 2 actions : "Confirmer & Reset" / "Annuler"

## Test CI obligatoire

```typescript
// scripts/check-default-mapping.ts
import defaultJson from 'docs/event-mappings/20-data/default-mapping.json';
import { MAP } from 'apps/web/src/lib/tracking/providers/event-mapping';

for (const [event, providers] of Object.entries(MAP)) {
  for (const [kind, mappedName] of Object.entries(providers)) {
    const fromJson = defaultJson.mappings[event]?.[kind]?.mappedName;
    if (fromJson !== mappedName) {
      throw new Error(`Drift detected: ${event}/${kind} → code='${mappedName}', json='${fromJson}'`);
    }
  }
}
```

Le CI tourne ce script à chaque PR. Bloque le merge si drift.

## Liens
- ADR-001 (versioning)
- `20-data/default-mapping.json` (fichier)
- `90-plan/risks.md` R1 (drift)
