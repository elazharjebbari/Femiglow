# Migration runbook

**Version** : 1.0  
**Dernière mise à jour** : 2026-05-14  
**Responsable** : Younes (exécution), Lead dev + DBA (supervision)

## Objectif

Migrer les données existantes du système legacy (3 tables) vers le nouveau modèle unifié `TrackingPlan` sans perte de données et avec possibilité de rollback.

## Préconditions

- [ ] Schéma nouveau déjà créé (migrations Drizzle appliquées).
- [ ] Tables legacy renommées en `_legacy_v1_*` (lors d'une migration précédente).
- [ ] Script de migration `scripts/migrate-tracking-plan.ts` versionné.
- [ ] Dry-run testé sur copie de prod.
- [ ] Backup DB récent (< 1h).
- [ ] Feature flag `TRACKING_PLAN_V2_ENABLED=false` confirmé (on migre la data, pas l'usage).
- [ ] DBA dispo en standby.

## Fenêtre recommandée

Mardi/mercredi/jeudi, 14h-15h (heure de Paris/Maroc).

## Étapes

### Phase 1 — Préparation (T-30 min)

#### 1.1 Backup ad-hoc
```bash
pg_dump $DATABASE_URL \
  --table=tracking_providers \
  --table=event_mapping_versions \
  --table=tracking_settings \
  --table=_legacy_v1_tracking_providers \
  --table=_legacy_v1_event_mapping_versions \
  --table=_legacy_v1_tracking_settings \
  > backup-migration-$(date +%Y%m%d-%H%M).sql
```

Vérifier taille > 0.

#### 1.2 Snapshot état actuel
```bash
psql $DATABASE_URL <<EOF > snapshot-before-migration.txt
SELECT count(*) FROM _legacy_v1_tracking_providers;
SELECT count(*) FROM _legacy_v1_event_mapping_versions;
SELECT count(*) FROM _legacy_v1_tracking_settings;
SELECT count(*) FROM tracking_plans;
EOF
```

Attendu :
```
_legacy_v1_tracking_providers : X rows
_legacy_v1_event_mapping_versions : Y rows
_legacy_v1_tracking_settings : 1 row (singleton)
tracking_plans : 0 rows (empty before migration)
```

#### 1.3 Notification équipe
Slack `#tech-tracking-plan` :
> 🚀 Démarrage migration tracking data dans 30 min. Pas d'impact user attendu.

### Phase 2 — Dry-run (T-15 min)

#### 2.1 Lancer le script en mode dry-run
```bash
cd apps/web
npm run tracking-plan:dry-run
```

#### 2.2 Vérifier le rapport
Le script produit un rapport stdout :
```
Migration dry-run report
========================

Plans found in legacy : 1 active version
Plans to create : 1
Audit entries to insert : 1 (initial creation)
Defaults to update : N/A (already seeded)

Validation :
  - Schema OK ✓
  - Placeholders detected : 0 ✓
  - All required fields present : ✓
  - Bundle hash deterministic : computed = abc123def... ✓

Estimated execution time : ~3 seconds

DRY RUN - NO CHANGES APPLIED.
```

Attendu : 0 erreur, 0 warning bloquant.

#### 2.3 Vérifier diff sémantique
```bash
npm run tracking-plan:test-export -- --plan-id legacy --compare-with-migration
```

Compare le JSON GTM exporté depuis legacy avec celui produit après migration. Attendu : 0 différence sémantique.

### Phase 3 — Migration réelle (T+0)

#### 3.1 Annonce
Slack `#tech-tracking-plan` :
> ▶️ Migration tracking data en cours.

#### 3.2 Lancer le script en mode prod
```bash
cd apps/web
npm run tracking-plan:migrate
```

Le script :
1. Verrouille les tables `_legacy_v1_*` (lecture).
2. Construit le TrackingPlan canonique depuis les 3 tables.
3. Valide via `validatePlan`.
4. Insère dans `tracking_plans` avec status=`active`.
5. Insère entrée initiale dans `tracking_plan_audit`.
6. Déverrouille.

Durée typique : 2-5 secondes.

#### 3.3 Vérifier output
Le script affiche :
```
✓ Plan migré : id=plan_a1b2c3d4
✓ Status : active
✓ Bundle hash : abc123def456...
✓ Audit entry : created
✓ Exit code : 0
```

Si exit code ≠ 0 : **STOP**, lire les logs, escalader Lead.

### Phase 4 — Vérification (T+5 min)

#### 4.1 Snapshot état après
```bash
psql $DATABASE_URL <<EOF > snapshot-after-migration.txt
SELECT count(*) FROM _legacy_v1_tracking_providers;
SELECT count(*) FROM _legacy_v1_event_mapping_versions;
SELECT count(*) FROM _legacy_v1_tracking_settings;
SELECT count(*) FROM tracking_plans;
SELECT count(*) FROM tracking_plan_audit;
SELECT id, name, status, version FROM tracking_plans;
EOF
```

Attendu :
```
_legacy_v1_*           : intact (X, Y, 1)
tracking_plans         : 1 row
tracking_plan_audit    : 1 row (action='create')
1ère ligne plan        : id=..., name='Production v8', status='active', version=8
```

#### 4.2 Smoke test exporter
```bash
npm run tracking-plan:test-export -- --plan-id plan_a1b2c3d4 --env production
```

Attendu : JSON GTM produit identique sémantiquement à l'ancien export.

#### 4.3 Vérifier audit log
```bash
psql $DATABASE_URL <<EOF
SELECT * FROM tracking_plan_audit ORDER BY created_at DESC LIMIT 5;
EOF
```

Attendu : entrée récente avec action `migration_create`.

### Phase 5 — Communication (T+10 min)

#### 5.1 Slack
```
✅ Migration tracking data terminée à {time}.

Résumé :
- 1 plan actif migré
- 0 erreur
- Tables legacy intactes (rollback possible jusqu'à T+90j)

Prochaine étape : activation feature flag user-by-user demain à {time}.
```

#### 5.2 Email stakeholders (Lead + Amal + Aïcha)
```
Subject: [INFO] Migration data tracking terminée

Bonjour,

La migration des données tracking est terminée avec succès.

Pas d'impact utilisateur (feature flag reste OFF).
Le nouveau système sera activé progressivement à partir de demain.

Tout est tracké normalement.
Tables legacy intactes : rollback possible à tout moment.

Cordialement,
{Younes}
```

## Critères de succès

- [ ] Script migration exit code 0.
- [ ] `tracking_plans` contient 1 plan actif.
- [ ] `tracking_plan_audit` contient 1 entrée création.
- [ ] Tables `_legacy_v1_*` intactes.
- [ ] Export JSON sémantiquement identique vs legacy.
- [ ] 0 alerte SRE pendant la fenêtre.
- [ ] Bundle hash déterministe reproductible.

## Plan B si échec

### Script migration échoue
- Exit code ≠ 0 → lire stderr.
- Causes possibles :
  - Validation schema fail : un champ legacy ne respecte pas le nouveau schéma → script doit avoir géré ça avec un map de défauts.
  - Placeholder détecté en prod : c'est le bug actuel ! Le script doit lever une exception explicite "Cannot migrate plan with placeholder X. Fix legacy first or run with --allow-placeholders".
  - DB error : escalade DBA.

**Action** : ne pas réessayer aveuglément. Fix la cause, relancer dry-run, puis migration.

### Diff sémantique post-migration ≠ 0
- Le JSON exporté diffère du legacy de manière non-trivial.
- **STOP**. Investiguer le diff.
- Si bug : fix script + relancer (table `tracking_plans` est ré-écrasée, audit log accumule mais OK).

### Tables `_legacy_v1_*` corrompues
- Restore depuis backup pre-migration.
- Investiguer pourquoi.

## Rollback de la migration

Si décision de rollback (Lead) :

```bash
# Supprimer les données migrées
psql $DATABASE_URL <<EOF
DELETE FROM tracking_plan_audit;
DELETE FROM tracking_plans;
EOF

# Les tables legacy sont intactes, l'ancien admin continue à fonctionner.
```

C'est tout. Pas d'autre action nécessaire car le code en prod n'utilise pas encore les nouvelles tables (flag OFF).

## Maintenance long terme (T+30 à T+90)

### T+30 jours
- Audit que `tracking_plans` est utilisée activement.
- Audit que `_legacy_v1_*` n'est plus lue par aucun code.
```bash
# Activer pg_stat_statements et vérifier
psql $DATABASE_URL <<EOF
SELECT query, calls FROM pg_stat_statements 
WHERE query LIKE '%legacy_v1%' 
ORDER BY calls DESC;
EOF
```
Attendu : 0 query depuis le code applicatif (uniquement queries manuelles dev).

### T+90 jours — Cleanup

Préconditions :
- 30j sans usage legacy.
- Backup final pris.
- Lead + DBA sign-off.

```sql
-- Drop des tables legacy
DROP TABLE _legacy_v1_tracking_providers CASCADE;
DROP TABLE _legacy_v1_event_mapping_versions CASCADE;
DROP TABLE _legacy_v1_tracking_settings CASCADE;
```

Communication :
```
✅ Nettoyage final tracking : tables legacy supprimées.
Le projet Tracking Plan v2 est officiellement 100% complete.
```

Tag git : `tracking-plan-v2-cleanup-complete`.
