# 90.5 — Journal des décisions

## D-001 — Versioning immutable + clone à chaque édition

**Date** : 2026-05-13
**Contexte** : Cf. ADR-001
**Décision** : Toute édition crée une nouvelle version (status=draft). Activation explicite. Pas d'in-place update.
**Rationale** :
- Audit trail natif
- Bisect facile ("quelle version a cassé Meta ?")
- Rollback 1 click
- Cohérent avec D-003 GTM configs déjà adoptée
**Conséquences** : Plus de rows DB → FIFO max 50, UI explicite "édition = nouvelle version draft"

## D-002 — Default = fichier JSON versionné git

**Date** : 2026-05-13
**Contexte** : Cf. ADR-002
**Décision** : `default-mapping.json` est la SSOT du factory mapping. Seed lit ce fichier.
**Rationale** :
- Stable, ne dérive pas du code dynamique
- Versionnable git, review PR-required
- Recovery garantie (fichier immutable git)
**Conséquences** :
- Test CI `check-default-mapping` obligatoire
- Script `generate-default-mapping` pour re-gen depuis `event-mapping.ts`
- ID `__default__` réservé, read-only

## D-003 — Export GTM = Container Import JSON officiel

**Date** : 2026-05-13
**Contexte** : Cf. ADR-003
**Décision** : V1 produit un fichier `.json` au format `exportFormatVersion: 2` importable via GTM UI. Pas d'OAuth.
**Rationale** :
- Workflow simple (download → drag-drop GTM)
- Aucun risque OAuth (déjà skippé sur Google Ads CAPI)
- Format officiel Google → stable
**Conséquences** :
- gtm-export.ts produit la structure complète (tags + variables + triggers + container)
- Test ULTIMATE round-trip indispensable
- V2 : push direct via Tag Manager API v2 si besoin

## D-004 — MappingCell shape { mappedName, isCustom, isEnabled, notes }

**Date** : 2026-05-13
**Contexte** : Cf. ADR-004
**Décision** : Chaque cellule = objet avec 4 champs au lieu d'un simple string.
**Rationale** :
- Feature flag par cellule (isEnabled)
- Meta CustomEvent flag (isCustom)
- Notes admin pour documentation inline
**Conséquences** :
- JSON plus verbeux mais explicite
- Validation Zod par provider plus riche

## D-005 — JSONB monolithique par version vs cellules dépliées

**Date** : 2026-05-13
**Contexte** : Cf. CONCEPTUAL-ANALYSIS.md problème 2
**Décision** : V1 = 1 version = 1 JSONB. Pas de table `mapping_entries` séparée.
**Rationale** :
- Atomicité parfaite (1 row = 1 snapshot)
- Activation atomique (UPDATE is_active)
- Index GIN suffit pour query par cellule
**Conséquences** :
- Le JSON peut faire ~10-50 KB par version
- Pas de query SQL fine sur 1 cellule (acceptable)
- V2 si besoin : générer une vue `v_active_mapping_cells`

## D-006 — Pas de Branching V1

**Date** : 2026-05-13
**Contexte** : 1 seule version active à la fois
**Décision** : Pas de support multi-version active (A/B testing sur mappings)
**Rationale** :
- Complexité énorme pour cas d'usage rare en V1
- D'autres outils (sGTM, Google Optimize) couvrent l'A/B
**Conséquences** :
- `UNIQUE (is_active) WHERE is_active = true` au niveau DB
- V2 : feature flag pour activer le branching si besoin

## D-007 — Cache resolver in-memory TTL 30s

**Date** : 2026-05-13
**Contexte** : Performance dispatcher
**Décision** : Cache resolver dans `Map<string, ...>` avec TTL 30s.
**Rationale** :
- 0 latence DB pour 99% des dispatch
- TTL court pour propager les changements
- Invalidation explicite sur activate
**Conséquences** :
- Cache global process-scoped (non-shared multi-instance V1)
- Multi-instance V2 : Redis ou broadcast invalidation

## D-008 — Validation Zod côté serveur ET client

**Date** : 2026-05-13
**Contexte** : Sécurité + UX immediate feedback
**Décision** : Schema Zod partagé `lib/tracking/mappings/validator.ts`, validation aux 2 niveaux.
**Rationale** :
- Sécurité (serveur final source of truth)
- UX (client valide immédiatement, error inline)
- Réutilisation 100% du schema
**Conséquences** :
- Bundle client ajouté ~5 KB pour le validator
- Tests partagés entre client/server

## D-009 — Audit log : 2 destinations

**Date** : 2026-05-13
**Contexte** : Cohérence avec audit existant + besoin before/after riche
**Décision** : Insertion dans `audit_events` (global, via `auditTrackingChange`) + `event_mapping_audit` (dédié, avec before/after JSONB)
**Rationale** :
- Cohérence avec audit existant tracking-improvement
- before/after détaillé seulement où c'est utile (pas dans audit_events global)
**Conséquences** :
- Double insertion (lightweight)
- Query simple via `event_mapping_audit` pour module-specific

## Format pour nouvelles décisions

```
## D-XXX — [Titre court]

**Date** : YYYY-MM-DD
**Contexte** : Pourquoi décider maintenant
**Décision** : Choix retenu (1-2 phrases)
**Rationale** : Pourquoi ce choix
**Conséquences** : Impact code / docs / process
```
