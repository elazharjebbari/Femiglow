# Tests d'intégration

Tests qui valident **plusieurs systèmes ensemble** : frontend ↔ backend ↔ DB ↔ exporter ↔ runtime client.

## Fichiers

| Fichier | Portée |
|---------|--------|
| `ultimate-test.md` | **THE** test ultime — valide TOUT le flow E2E de bout en bout |
| `cross-system.spec.md` | Tests d'intégration intermédiaires (3-4 systèmes à la fois) |
| `migration.spec.md` | Tests spécifiques au passage legacy → v2 |
| `drift-detection.spec.md` | Tests de détection de drift client/serveur |

## Différence avec Playwright E2E

| Aspect | Playwright E2E | Tests intégration ici |
|--------|----------------|------------------------|
| **Cible** | Un parcours utilisateur (UI seul) | Un flux **technique** (UI + API + DB + exporter + runtime) |
| **Stub** | DB de test seedée | DB réelle + composants applicatifs |
| **Verdict** | "l'écran X est OK" | "le bundle hash de l'export client == celui du serveur" |
| **Lent** | ~30s par parcours | ~3 min pour l'ultime (forcément lourd) |

## Quand exécuter

- À chaque PR : Playwright + tests d'intégration partiels.
- **Test ultime** : nightly + avant chaque release (CI tag `@ultimate`).
- En manuel : `npm run test:ultimate`.

## Schéma de l'ultimate

```
[Wizard UI] → POST /plans → [DB create] → activate
   ↓                                          ↓
[Export server]      ←——      [Repository]
   ↓
[GTM JSON deterministe] ← bundleId SHA-256
   ↓
[Client simulator] → GET /export?env=production
   ↓
[Compare bundleIds] → drift = none ✅
   ↓
[Modify plan] → activate v2
   ↓
[Client simulator] (vieux cache) → drift = critical ⚠
   ↓
[Refresh client] → drift = none ✅
   ↓
[Verify audit log] → 6 entries (create, update*3, activate*2, archive*1)
```
