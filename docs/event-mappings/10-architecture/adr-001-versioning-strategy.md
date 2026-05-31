# ADR-001 — Stratégie de versionning

**Statut** : Proposed
**Date** : 2026-05-13
**Décideurs** : Tech Lead, Marketing Manager

## Contexte

Les mappings event→vendor doivent évoluer dans le temps (renommage Meta CustomEvent, ajout d'un provider, expérimentations marketing). Aujourd'hui les mappings sont dans `event-mapping.ts` (code) versionnés via git. On veut autoriser des modifications sans deploy, tout en préservant l'auditabilité et le rollback facile.

## Options évaluées

### Option A — Édition in-place
- 1 seule "version" mutable dans une table
- Audit log capture les diffs
- ❌ Rollback complexe (rejouer les audit logs)
- ❌ Pas de "snapshot" facile

### Option B — Immutable + clone à chaque édition (recommandé) ★
- Chaque édition crée une nouvelle version (status `draft`)
- L'admin "active" la version explicitement
- L'ancienne reste `archived`
- Rollback = `activate` une version antérieure
- Soft-delete pour cleanup
- ✅ Audit trail natif via les versions elles-mêmes
- ✅ Bisect facile ("quelle version a cassé Meta ?")
- ✅ Cohérent avec D-003 (déjà adopté pour GTM configs)
- ⚠ Plus de rows en DB → mitigation par FIFO (max 50 versions par défaut)

### Option C — Branching (git-style)
- Plusieurs branches actives simultanément
- ❌ Overkill V1, complexité énorme
- → V2 si A/B testing sur mappings devient besoin

## Décision

**Option B** — immutable + clone à chaque édition.

## Conséquences

### Positives
- Chaque "version" est un snapshot complet, atomique
- Audit log se résume à `INSERT audit (action='activate', version_id=X)`
- Rollback = 1 update `is_active`
- Cohérent avec le système GTM configs existant (réutilisation du pattern)

### Négatives
- Nombre de rows croît → FIFO max 50 versions actives (configurable via setting)
- Stockage : ~30 events × 6 providers × 50 versions × ~500 bytes/cell = ~4.5 MB max
- L'édition n'est pas "live" : il faut explicitement activer la nouvelle version

### Mitigations
- FIFO préserve toujours la `is_active=true` + les 49 dernières (jamais drop l'active)
- UI explicite "Vous éditez la v3 (draft). Active la version pour la mettre en production."
- Bouton "Tester" disponible sur draft sans activer (validation avant prod)

## Implémentation

### Schéma DB
```sql
CREATE TABLE event_mapping_versions (
  id text PRIMARY KEY,
  name text NOT NULL,
  notes text,
  status text NOT NULL CHECK (status IN ('draft','active','archived','deleted')),
  is_active boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  mappings jsonb NOT NULL,
  cloned_from text REFERENCES event_mapping_versions(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz
);

-- 1 seule version active à la fois.
CREATE UNIQUE INDEX one_active_version
  ON event_mapping_versions (is_active) WHERE is_active = true;

-- Index GIN pour query par clé JSONB (event_name, provider_kind).
CREATE INDEX event_mapping_versions_mappings_gin
  ON event_mapping_versions USING GIN (mappings);

-- Index sur status pour la liste.
CREATE INDEX event_mapping_versions_status_idx
  ON event_mapping_versions (status, created_at DESC);
```

### Transitions de status
```
draft   → active   (via /activate, désactive l'ancienne)
draft   → deleted  (via DELETE, soft)
active  → archived (forcé quand une autre est activée)
archived → active  (réactivation possible)
archived → deleted (soft)
deleted → archived (restore)
```

### Règles d'intégrité
- `is_default=true` ⇒ `status IN ('active','archived')`, **jamais** `deleted`
- Tentative de delete sur `is_default=true` → 403
- Tentative d'édition sur `is_default=true` → 403 (le default est immutable)

## Liens
- ADR-002 (default config)
- ADR-004 (provider config shape)
- D-003 de tracking-improvement (clone pattern pour GTM configs)
