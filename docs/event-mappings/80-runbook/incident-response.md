# 80.4 — Incident response

## Playbooks par symptôme

### P0 — /api/track 500 sur tous les events

**Symptôme** : monitoring alerte sur 5xx > 5%, journalctl montre stack trace `resolveEventMapping` ou `event_mapping_versions`.

**Diagnostique** :
1. Vérifier que la table existe : `psql -c "SELECT count(*) FROM event_mapping_versions"`
2. Vérifier qu'il y a une version active : `psql -c "SELECT id, name FROM event_mapping_versions WHERE is_active = true"`
3. Si 0 active → activer `__default__` :
   ```sql
   UPDATE event_mapping_versions SET is_active = true, status = 'active', activated_at = now()
   WHERE id = '__default__';
   ```
4. Si table absente → migrations pas appliquées → re-run migrate

### P0 — Conversions providers à 0

**Symptôme** : dashboard /admin/tracking/analytics/providers montre 0 events dispatched depuis X min.

**Diagnostique** :
1. Vérifier l'active version : son `mappings` contient-il purchase ?
2. Vérifier `cell.isEnabled = true` pour les providers attendus
3. Si quelqu'un a sauvé une version avec tout disabled → identifier via audit :
   ```sql
   SELECT created_at, actor_id, action, version_id FROM event_mapping_audit
   ORDER BY created_at DESC LIMIT 10;
   ```
4. **Quick fix** : activer une version antérieure connue bonne :
   ```bash
   curl -X POST .../api/admin/tracking/events/mappings/<previous_id>/activate
   ```
   Ou via UI.
5. Cas extrême : reset au default :
   ```bash
   curl -X POST .../api/admin/tracking/events/mappings/reset-default
   ```

### P1 — Admin ne peut pas sauver

**Symptôme** : édition matrice → click "Sauvegarder" → toast erreur "Validation failed".

**Diagnostique** :
1. Ouvrir DevTools → Network → voir le body de la réponse PUT
2. `error.details.field` pointe vers la cellule fautive
3. Vérifier que `mappedName` respecte la regex provider (cf. validation-rules.md)
4. Si validation OK localement mais serveur refuse → version Zod différente → rebuild

### P1 — Export GTM produit un fichier invalide

**Symptôme** : admin télécharge → import GTM UI échoue avec "Format invalide".

**Diagnostique** :
1. Comparer le sha256 du fichier téléchargé vs celui dans le toast (intégrité)
2. Parser le JSON localement avec `jq` — exportFormatVersion=2 ?
3. Vérifier les `firingTriggerId` référencent bien les triggerId existants
4. Si format Google a changé → mettre à jour `gtm-export.ts` selon nouvelle spec

### P2 — Cache resolver lent

**Symptôme** : /api/track p95 > 300ms (vs 100ms baseline).

**Diagnostique** :
1. Vérifier cache hit rate dans logs (devrait être > 95%)
2. Si miss rate élevé → activations trop fréquentes ? Un admin spam ?
3. Augmenter TTL : `MAPPING_CACHE_TTL_MS=60000` (60s) au lieu de 30s
4. Restart service

### P3 — Drift `default-mapping.json` vs `event-mapping.ts`

**Symptôme** : CI fail `tracking:check-default-mapping`.

**Diagnostique** :
1. Le PR a modifié un des deux fichiers sans modifier l'autre
2. Re-générer default-mapping.json depuis event-mapping.ts :
   ```bash
   pnpm tracking:generate-default-mapping > docs/event-mappings/20-data/default-mapping.json
   ```
3. Commit + push

## Contacts urgence

| Rôle | Contact |
|---|---|
| Tech Lead | (à attribuer) |
| Backend dev tracking | (à attribuer) |
| Marketing (impact) | Sara |

## Communication

### Status page

- ⚠ "Tracking dégradé — mappings non synchronisés" si P0
- ❌ "Service partiel indisponible" si /api/track 500

### Slack

```
🚨 [P0] event-mappings down
Symptôme : /api/track 500 % > 50% sur 5 min
Cause suspectée : version active corrompue
Action : reset au default en cours
Owner : @backend-dev
ETA fix : 5 min
```

## Drills

Mensuel : simuler un reset-default et un rollback de version pour entraîner l'équipe.
