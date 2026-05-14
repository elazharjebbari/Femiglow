# `pairValidator` — règles de validation pré-import

## Vue d'ensemble

Le `pairValidator` prend en entrée 2 JSON (config GTM + mapping FemiGlow) et produit un rapport structuré. Il est **stateless** et **déterministe**.

## Localisation

`apps/web/src/lib/tracking/gtm/pair-validator.ts`

## API

```ts
export type PairValidationInput = {
  configJson: unknown;   // JSON parsé du config GTM
  mappingJson: unknown;  // JSON parsé du mapping FemiGlow
};

export type PairValidationResult = {
  ok: boolean;                 // true si aucune erreur
  bundleId: {
    config: string | null;
    mapping: string | null;
    match: boolean;
  };
  errors: ValidationIssue[];      // bloquants
  warnings: ValidationIssue[];    // non-bloquants mais à vérifier
  recommendations: Recommendation[];
};

export type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;       // affichage humain
  fix: string;           // action recommandée
  reference?: { path: string; line?: number };
};

export type Recommendation = {
  order: number;
  action: string;
};

export function validatePair(input: PairValidationInput): PairValidationResult;
```

## Règles implémentées

### R-001 — Bundle ID match
- **Severity** : `error` si mismatch ET les 2 sont définis. `warning` si un seul est défini.
- **Logique** : `config.variables.find(v => v.name === 'FG Bundle Id').value === mapping.manifest.bundleId`.
- **Fix** : "Re-générer les 2 fichiers ensemble depuis l'admin (le bundleId doit être partagé)."

### R-002 — Schema versions
- **Severity** : `error` si version inconnue.
- **Logique** : `mapping.manifest.schemaVersion` doit matcher le pattern `fg-mapping/<major>.<minor>`.
- **Fix** : "Le mapping a été généré par une version trop ancienne ou trop récente de FemiGlow. Re-générer depuis l'admin actuel."

### R-003 — Container ID match (si déclaré)
- **Severity** : `error` si déclaré ET diffère.
- **Logique** : `config.container.publicId === mapping.manifest.containerId`.
- **Fix** : "Les 2 fichiers ciblent des containers différents. Vérifier que tu importes dans le bon workspace."

### R-004 — Events couverts (config vs mapping)
- **Severity** : `error` si event mappé manque côté config (pas de trigger), `warning` si event configuré pas dans mapping.
- **Logique** :
  - `configEvents = config.tags.flatMap(t => t.triggers).map(...)`.
  - `mappingEvents = Object.keys(mapping.mappings)`.
  - `diff = mappingEvents - configEvents`.
- **Fix** : "Ajouter un trigger pour l'event 'xxx' dans la config GTM, ou retirer 'xxx' du mapping."

### R-005 — Variables résolvables
- **Severity** : `error`.
- **Logique** : pour chaque `{{FG Xxx}}` référencé dans le mapping, vérifier qu'il existe dans `config.variables`.
- **Fix** : "Ajouter la variable '{{FG Xxx}}' dans la config GTM (type Data Layer Variable)."

### R-006 — Required config version
- **Severity** : `error` si `mapping.manifest.requiredConfigVersion > config.containerVersion.version`.
- **Logique** : comparaison semver simplifiée (v1 < v2 < v3).
- **Fix** : "Mettre à jour la config GTM vers la version 'vN' avant d'importer ce mapping."

### R-007 — Vendors enabled cohérents
- **Severity** : `warning`.
- **Logique** : Si `mapping.mappings['purchase'].meta.enabled === false` mais config a un tag Meta Purchase, on flag.
- **Fix** : "Cohérence : si tu désactives Meta pour 'purchase' côté mapping, désactive aussi le tag Meta Purchase côté config (ou laisse, le mapping prendra le pas)."

### R-008 — Pas d'event orphelin
- **Severity** : `warning`.
- **Logique** : event dans config mais absent du mapping → fired avec nom par défaut, comportement legacy.
- **Fix** : "Event 'xxx' n'est pas dans le mapping. Il sera fired sous son nom canonique. Si voulu, ajouter au mapping pour traçabilité."

### R-009 — JSON bien formé
- **Severity** : `error` (court-circuit toutes les autres règles).
- **Logique** : parse JSON, vérifier structure de base.

## Stratégie d'erreur

- Toujours retourner un résultat structuré (pas de throw).
- Une erreur de parse → résultat avec `errors: [{ code: 'invalid_json', ... }]` et `ok: false`.
- L'ordre des erreurs est stable (utile pour tests + snapshots).

## Recommandations générées

L'ordre des recommandations est calculé en fonction des erreurs/warnings :

```ts
function buildRecommendations(errors, warnings, bundleIdMatch): Recommendation[] {
  if (errors.length > 0) {
    return [{ order: 1, action: 'Corriger les erreurs ci-dessus avant l\'import.' }];
  }
  const recs: Recommendation[] = [];
  recs.push({ order: 1, action: 'Importer config-vN.json en premier (Submit & Publish).' });
  recs.push({ order: 2, action: 'Importer mapping-vN.json en second.' });
  recs.push({ order: 3, action: 'Ouvrir GTM Preview Mode, faire un pageview, vérifier que le sentinel ping est tiré.' });
  recs.push({ order: 4, action: 'Revenir sur /admin/tracking/gtm/sync-status pour confirmer.' });
  if (warnings.length > 0) {
    recs.push({ order: 5, action: 'Surveiller les warnings ci-dessus pendant 24h.' });
  }
  return recs;
}
```

## Performance

- Stateless, pas de DB call.
- Complexité O(N + M) où N = events mapping, M = variables config.
- Pour des JSON de ~500 KB, exécution attendue < 100ms.
