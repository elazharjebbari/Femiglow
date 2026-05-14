# Runbook — Réponse à incident

## Vue d'ensemble

Cette doc est utilisée quand un drift est signalé. Elle traite chaque cas avec :
1. Symptôme observable
2. Diagnostic (comment confirmer)
3. Fix recommandé
4. Vérification post-fix

---

## INC-001 — `mapping_version_drift`

### Symptôme
- Banner rouge : "GTM exécute le mapping v{X} alors que v{Y} est actif côté admin."
- Page sync-status : carte Mapping en rouge.

### Diagnostic
```sql
-- Ce que pense le système
SELECT admin_snapshot, last_check_at FROM gtm_drift_state WHERE id = 'singleton';

-- Les derniers pings
SELECT received_at, mapping_version, config_version, bundle_id
FROM gtm_sentinel_pings ORDER BY received_at DESC LIMIT 10;
```

### Fix
- Cause habituelle : l'admin a activé une nouvelle version mais oublié de réimporter dans GTM.
- Action : aller dans `/admin/tracking/events/mappings`, ouvrir la version active, cliquer "Exporter", réimporter les 2 fichiers dans GTM, Submit & Publish.

### Vérification
- Attendre 2-5 min (premier pageview en prod).
- Banner doit disparaître automatiquement.

---

## INC-002 — `config_version_drift`

### Symptôme
- Banner rouge ou orange.
- Carte Config GTM en rouge.

### Diagnostic
- Vérifier la dernière version de config exportée vs version GTM courante.
- Causes :
  - Config importée mais pas Publish.
  - Mauvais workspace cible.
  - Hotfix manuel GTM qui a écrasé l'import.

### Fix
- Si version GTM > admin : aligner admin (la prod a la nouvelle version, admin retard).
- Si version admin > GTM : réimporter config dans GTM.

---

## INC-003 — `bundle_mismatch` (warning)

### Symptôme
- Banner orange.
- Versions cohérentes mais bundleId diffère.

### Diagnostic
- Cause habituelle : l'admin a régénéré le bundle mais GTM a un cache de variable.
- Vérifier sur GTM si la variable `FG Bundle Id` a bien été mise à jour.

### Fix
- Forcer un nouveau Publish dans GTM (sans changement, juste pour invalider cache).
- Si persiste après 1h : re-exporter depuis l'admin et réimporter.

---

## INC-004 — `silence_excess`

### Symptôme
- Aucun ping reçu depuis > 6h (warning) ou > 24h (critical).

### Diagnostic
- Causes possibles :
  - GTM container non publié.
  - Tag "FG Sentinel Ping" désactivé.
  - Site en maintenance.
  - Endpoint `/api/track/sentinel` en panne.
- Vérification :
  ```bash
  curl -X POST https://femiglow.ma/api/track/sentinel -d '{...}'
  ```

### Fix
- Si endpoint OK : aller dans GTM, vérifier le tag et le trigger.
- Si endpoint KO : escalader (incident infra).

---

## INC-005 — `container_id_mismatch`

### Symptôme
- Banner rouge "Container ID différent".

### Diagnostic
- L'admin attend GTM-A, GTM envoie depuis GTM-B.
- Causes : import dans le mauvais workspace (staging au lieu de prod).

### Fix
- **Critique** : déterminer lequel des 2 IDs est correct.
- Mettre à jour `tracking_providers` admin si nécessaire.
- Re-publier le bon workspace.

---

## INC-006 — `manifest_flag_mismatch`

### Symptôme
- Pings reçus mais avec `manifest_mismatch: true`.

### Diagnostic
- Couche C a détecté que `FG Bundle Id (Config)` ≠ `FG Bundle Id (Mapping)` côté GTM.
- Cause : un seul des 2 fichiers a été importé.

### Fix
- Identifier lequel manque (généralement il manque le mapping).
- Importer le fichier manquant + Submit & Publish.

---

## INC-007 — Spam de pings (DoS partiel)

### Symptôme
- `rate(gtm_sentinel_pings_received_total[1m])` > seuil normal.
- Latence DB en hausse.

### Diagnostic
- Bot trafic ? Tag GTM mal configuré (fire à chaque event au lieu de session) ?

### Fix
- Court terme : rate limit ↑ ou désactiver le tag.
- Long terme : sampling client.

---

## INC-008 — Tous les pings rejetés 400

### Symptôme
- Endpoint sentinel répond 400 sur tous les payloads.
- Aucun ping en DB.

### Diagnostic
- Probable changement de schema Zod incompatible avec la version client GTM.
- Vérifier les logs : `gtm.sentinel.invalid_payload`.

### Fix
- Soit relâcher la validation Zod côté backend (rollback du schema).
- Soit republier GTM avec un client à jour.

---

## Procédure générale "Incident GTM"

1. **Confirmer** : lire `/admin/tracking/gtm/sync-status` + logs récents.
2. **Catégoriser** : trouver le INC-XXX correspondant.
3. **Appliquer le fix** indiqué.
4. **Surveiller** 15 min : le statut doit repasser à OK.
5. **Documenter** dans un post-mortem si > 30 min.

## Post-mortem template

```markdown
# Post-mortem — [date] — [titre]

## Résumé
[3 lignes]

## Timeline
- T-X : événement déclencheur
- T-0 : alerte
- T+15 : fix appliqué
- T+25 : retour à OK

## Cause racine
[ce qui s'est vraiment passé]

## Impact
- Durée : X min
- Events tracking perdus : ~X
- Utilisateurs affectés : aucun (admin only)

## Ce qui a fonctionné
[Poka-Yoke detection bien]

## Ce qui peut être amélioré
[hystérésis trop courte ? règle drift trop sensible ?]

## Actions de suivi
- [ ] Action 1
- [ ] Action 2
```
