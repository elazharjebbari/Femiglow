# ADR-003 — bundleId = SHA-256 court partagé

**Statut** : Accepté
**Date** : 2026-05-13

## Contexte

Le `bundleId` doit :
1. Identifier uniquement une paire (config, mapping) générée ensemble.
2. Être identique dans les 2 fichiers exportés.
3. Être facilement comparable (string).
4. Être court (lisible humainement, debug).
5. Ne pas révéler de PII / secrets.

## Décision

`bundleId = SHA-256(JSON.stringify(canonicalBundle))` tronqué à **12 caractères hex**.

```ts
function computeBundleId(input: {
  mappingVersion: string;   // e.g. "v17"
  configVersion: string;    // e.g. "v4"
  events: ReadonlyArray<{ name: string; resolvedNames: Record<string, string> }>;
  containerId: string;      // e.g. "GTM-XXXX"
  generatedAt: string;      // ISO 8601 (millisecond truncated)
}): string {
  const canonical = JSON.stringify({
    m: input.mappingVersion,
    c: input.configVersion,
    cid: input.containerId,
    e: [...input.events].sort((a, b) => a.name.localeCompare(b.name)),
    t: input.generatedAt,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}
```

## Justification du choix

| Choix | Pourquoi |
|---|---|
| SHA-256 | Standard, collision-résistant pour notre usage non-crypto. |
| Tronqué à 12 hex (~48 bits) | 281 trillions de valeurs possibles, suffisant pour notre usage (~50 bundles/an). Lisibilité humaine pour debug. |
| Hash sur contenu canonique (sorted events) | Garantit que le même bundle produit le même hash quelle que soit l'ordre des events. |
| Inclut `generatedAt` | Évite la collision si on régénère exactement le même bundle (utile pour `Replay` / audit). |
| Pas de secret | Ce n'est pas un HMAC : pas de modèle de menace anti-falsification. |

## Format dans les fichiers exportés

### Côté config GTM (extrait)
```json
{
  "containerVersion": {
    "container": {"publicId": "GTM-XXXX"},
    "variable": [
      {
        "name": "FG Bundle Id",
        "type": "c",
        "parameter": [
          {"type": "TEMPLATE", "key": "value", "value": "a7c4f2e9b81d"}
        ]
      },
      {
        "name": "FG Config Version",
        "type": "c",
        "parameter": [{"type": "TEMPLATE", "key": "value", "value": "v4"}]
      }
    ]
  }
}
```

### Côté mapping
```json
{
  "manifest": {
    "schemaVersion": "fg-mapping/2.0",
    "bundleId": "a7c4f2e9b81d",
    "mappingVersion": "v17",
    "requiredConfigVersion": "v4",
    "generatedAt": "2026-05-13T19:30:00.000Z",
    "containerId": "GTM-XXXX"
  },
  "mappings": { ... }
}
```

## Conséquences

### Bénéfices
- Comparaison triviale côté GTM (constante = constante).
- Lisible dans les logs / UI ("Bundle a7c4f2e9b81d expected").
- Pas de dépendance externe (pas de clé à gérer).
- Stable : même input → même output.

### Trade-offs
- Pas de signature cryptographique : un attaquant peut forger un `bundleId` cohérent. **Non pertinent ici** (l'attaque ne change rien — le pire est un faux positif).

## Évolutivité

Si on a besoin un jour de vérifier l'origine (HMAC), on peut ajouter un champ `signature` séparé sans casser l'existant.
