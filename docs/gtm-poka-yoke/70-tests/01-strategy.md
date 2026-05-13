# Stratégie de tests — Poka-Yoke GTM

## Pyramide

```
                ▲
                │  E2E Playwright
                │  ─ 4 scénarios critiques
                │
            ┌───┴───┐
            │       │
            │  Intégration MSW
            │  ─ 15 tests routes API
            │
        ┌───┴───┐
        │       │
        │  Unit (Vitest)
        │  ─ 50+ tests sur bundleId,
        │    pairValidator, driftDetector,
        │    schemas Zod
        ▼
```

## Couverture cible

| Module | Couverture lignes | Couverture branches |
|---|---|---|
| `bundle-id.ts` | 100% | 100% |
| `pair-validator.ts` | ≥ 95% | ≥ 90% |
| `drift-detector.ts` | ≥ 90% | ≥ 85% |
| `sentinel-schemas.ts` | 100% | 100% |
| Routes API | ≥ 90% (via MSW) | ≥ 80% |
| Composants UI | ≥ 80% | n/a |

## Outils

| Niveau | Outil | Pourquoi |
|---|---|---|
| Unit | Vitest | Cohérent avec le reste du projet |
| Intégration HTTP | MSW + Vitest | Mocks fetch sans réseau |
| Intégration DB | Vitest + drizzle test helpers | Vraie DB locale en docker |
| E2E | Playwright | Cohérent avec le reste du projet |

## Stratégie par couche

### Couche A — `pair-validator`

Tests unit déterministes :
- Inputs valides → résultat `ok: true`
- Chaque règle de validation (R-001 à R-009) testée séparément
- Snapshots de payloads d'erreur stables
- Edge cases : JSON invalide, fichier vide, fichier énorme (1 MB+)

Tests MSW :
- POST `/api/admin/tracking/gtm/validate-pair` avec auth admin
- Sans auth → 401
- Payload invalide → 400

E2E (Playwright) :
- Wizard 3 étapes : drop fichier, click suivant, voir résultat
- Drop fichier invalide (pas JSON) → message d'erreur clair

### Couche B — `drift-detector` + endpoint sentinel

Tests unit déterministes :
- `classifyDrift` testé sur la matrice complète (cf. drift-rules.md)
- Hystérésis : transition rapide retient le statut précédent
- Edge case : pas de ping → statut basé sur `lastEditAt`

Tests intégration :
- POST `/api/track/sentinel` → INSERT en DB + update drift_state
- Ping en double → idempotent
- Payload invalide → 400 (et pas d'INSERT)
- CORS rejeté → 403

E2E :
- Drift critical → banner rouge visible sur toutes les pages admin
- Drift résolu → banner disparaît

### Couche C — `bundle-id` + injection

Tests unit déterministes :
- Hash stable, déterministe, sensible aux changements
- `injectBundleIdIntoConfig` : ajoute si manque, met à jour si existe
- Pas d'effet de bord sur les autres variables config

Tests intégration :
- Export depuis `/api/admin/tracking/events/mappings/<id>/export` produit 2 fichiers avec même bundleId
- Réimport de ces 2 fichiers dans validate-pair → 0 erreurs

## Scénarios E2E critiques (Playwright)

### Scénario 1 — Happy path validate-pair
```
GIVEN un admin connecté
WHEN il va sur /admin/tracking/gtm/validate-pair
AND drop un config.json valide (étape 1)
AND drop un mapping.json valide partageant le même bundleId (étape 2)
AND clique "Valider la cohérence"
THEN il voit "VERDICT : OK"
AND la procédure recommandée est affichée
```

### Scénario 2 — validate-pair avec bundleId mismatch
```
GIVEN un admin connecté
WHEN il drop 2 fichiers avec bundleId différents
THEN il voit "VERDICT : Import bloqué — 2 erreurs"
AND l'erreur "Bundle ID mismatch" est affichée
AND le bouton "Tout va bien" est désactivé
```

### Scénario 3 — Drift critical déclenche banner global
```
GIVEN un admin connecté avec mapping admin v17
WHEN un sentinel ping arrive avec mapping_version="v16"
THEN après 30s, le banner rouge "Drift critique" apparaît
AND il est visible sur /admin (dashboard) et /admin/tracking/* (toutes les pages)
WHEN l'admin clique "Voir détails"
THEN il atterrit sur /admin/tracking/gtm/sync-status
AND voit "mapping_version_drift v17→v16"
```

### Scénario 4 — Sync-status auto-refresh
```
GIVEN admin sur /admin/tracking/gtm/sync-status (statut OK)
WHEN un drift critical est créé en backend (via API debug ou seed)
THEN dans les 30s, la page bascule en rouge
AND affiche la cause
```

## Données de test (fixtures)

`apps/web/src/test/fixtures/gtm-poka-yoke/`
- `valid-config-v4.json` — config GTM minimal valide
- `valid-mapping-v17.json` — mapping vendors valide
- `invalid-bundle-mismatch-config.json` — config avec bundleId différent
- `invalid-missing-variable-config.json` — config sans `{{FG Locale}}`
- `sentinel-ping-valid.json` — ping valide
- `sentinel-ping-mapping-drift.json` — ping en drift

## CI/CD

```yaml
# .github/workflows/test.yml (intégration)
jobs:
  test-poka-yoke:
    steps:
      - run: pnpm test:unit -- gtm-poka-yoke
      - run: pnpm test:integration -- gtm-poka-yoke
      - run: pnpm test:e2e -- --grep "gtm-poka-yoke"
```
