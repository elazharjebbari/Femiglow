# Runbook — Déploiement

## Prérequis

- Branche `feat/gtm-poka-yoke` créée depuis `master`.
- Migration DB testée localement.
- Tests verts (`pnpm test` + `pnpm test:e2e`).
- Build OK (`pnpm build`).

## Séquence de déploiement

### Étape 1 — Code (Vercel auto-deploy)

```bash
git checkout feat/gtm-poka-yoke
git push origin feat/gtm-poka-yoke
# → Vercel build déclenché automatiquement
# → Wait deploy preview, smoke test
```

### Étape 2 — Migration DB (manuelle, contrôlée)

```bash
# Sur l'env de prod (via Vercel CLI ou shell ssh)
pnpm db:migrate
# Vérifier la sortie : "Migration gtm_poka_yoke_001 applied"
```

Verification post-migration :
```sql
SELECT to_regclass('gtm_sentinel_pings');     -- doit être 'gtm_sentinel_pings'
SELECT to_regclass('gtm_drift_state');        -- idem
SELECT * FROM gtm_drift_state;                -- 1 ligne 'singleton'
```

### Étape 3 — Merge & deploy prod

```bash
gh pr create --base master --head feat/gtm-poka-yoke ...
# Review, merge
# → Vercel déploie en prod
```

### Étape 4 — Smoke test post-deploy

```bash
# 1. Endpoint sentinel répond
curl -X POST https://femiglow.ma/api/track/sentinel \
  -H 'content-type: application/json' \
  -H 'origin: https://femiglow.ma' \
  -d '{"bundleId":"a7c4f2e9b81d","mappingVersion":"v17","configVersion":"v4","containerId":"GTM-XXXX","sentAt":"2026-05-13T19:32:01.000Z"}'
# Expected: 204 No Content

# 2. Page admin charge
curl -I https://femiglow.ma/admin/tracking/gtm/sync-status
# Expected: 200 (avec auth admin)

# 3. Vérifier qu'un ping a bien atterri
psql -c "SELECT count(*) FROM gtm_sentinel_pings WHERE received_at > now() - interval '5 min';"
# Expected: >= 1
```

### Étape 5 — Configurer GTM (manuelle)

#### 5.1 — Variables à ajouter (si pas déjà présentes)

Dans GTM Container :
- `FG Bundle Id` — type Constant, valeur = `a7c4f2e9b81d` (calculée par l'export)
- `FG Mapping Version` — type Constant, valeur = `v17`
- `FG Config Version` — type Constant, valeur = `v4`

#### 5.2 — Tag "FG Sentinel Ping" (Couche B)

- **Type** : Custom HTML
- **Trigger** : All Pages — Once Per Session
- **Configuration** :

```html
<script>
(function () {
  if (window.__fgSentinelSent) return;
  window.__fgSentinelSent = true;
  var payload = {
    bundleId:        {{FG Bundle Id}},
    mappingVersion:  {{FG Mapping Version}},
    configVersion:   {{FG Config Version}},
    containerId:     {{Container ID}},
    gtmId:           {{GTM Container ID}},
    sentAt:          new Date().toISOString(),
    manifestMismatch: window.__fgManifestMismatch || false,
    manifestMismatchDetails: window.__fgManifestMismatchDetails || null
  };
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/sentinel', JSON.stringify(payload));
    } else {
      fetch('/api/track/sentinel', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload),
        keepalive: true
      });
    }
  } catch (e) { /* swallow */ }
})();
</script>
```

#### 5.3 — Tag "FG Manifest Check" (Couche C)

- **Type** : Custom HTML
- **Trigger** : All Pages — Once Per Session — Avant le sentinel ping (priority +10)
- **Configuration** :

```html
<script>
(function () {
  var cfg = {{FG Bundle Id (Config)}};
  var map = {{FG Bundle Id (Mapping)}};
  if (cfg && map && cfg === map) {
    window.__fgManifestMismatch = false;
  } else {
    window.__fgManifestMismatch = true;
    window.__fgManifestMismatchDetails = 'config=' + (cfg || 'undefined') + ',mapping=' + (map || 'undefined');
  }
})();
</script>
```

> Note : `FG Bundle Id (Config)` et `FG Bundle Id (Mapping)` sont des variables distinctes, **chacune injectée par un seul des 2 fichiers**. Si un seul est importé, l'autre = undefined.

#### 5.4 — Submit & Publish workspace GTM

- Workspace name : `Poka-Yoke v1`
- Description : `Ajout sentinel ping + manifest check`

### Étape 6 — Première validation

1. Ouvrir https://femiglow.ma dans un onglet privé.
2. Faire un pageview.
3. Aller sur `/admin/tracking/gtm/sync-status`.
4. Vérifier : 🟢 ping reçu, statut OK.

## Critères de succès du déploiement

- [ ] Build prod vert
- [ ] Migration appliquée sans erreur
- [ ] Endpoint sentinel répond 204 sur payload valide
- [ ] Endpoint sentinel répond 400 sur payload invalide
- [ ] Page sync-status accessible (auth admin)
- [ ] Page validate-pair accessible (auth admin)
- [ ] Au moins 1 ping reçu en prod dans les 10 min suivant le deploy GTM
- [ ] Statut affiche OK
- [ ] Email envoyé aux admins : "Poka-Yoke GTM opérationnel"

## Rollback rapide

Si quelque chose casse :
1. **Backend** : revert le commit, redéployer (Vercel auto).
2. **Migration** : appliquer le rollback SQL de `02-migration.md`.
3. **GTM** : restaurer le workspace précédent (GTM versions).
