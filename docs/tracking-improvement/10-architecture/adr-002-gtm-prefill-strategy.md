# ADR-002 — Stratégie de pré-remplissage GTM ← Providers

> **Statut** : Proposed
> **Date** : 2026-05-13

## Contexte

Deux tables désynchronisées : `tracking_providers` et
`tracking_settings.gtm.config_versions`. Aucun lien entre les deux. Admin
re-saisit manuellement les pixel IDs à chaque nouvelle version GTM.

## Options évaluées

### Option A — SSOT Providers + dérivation auto
- Une seule source de vérité (Providers)
- GTM export = pure function de Providers
- ❌ Perte de flexibilité (pas d'override per-version)
- ❌ Migration douloureuse des versions existantes

### Option B — Pré-remplissage à la création + édition libre
- Form GTM hydrate depuis Providers à la création
- Admin peut overrider
- Diff visuel signale les divergences
- ✅ Best-of-both worlds : commodité + flexibilité
- ⚠ Deux sources possibles (acceptable avec diff visuel)

### Option C — Édition collaborative type Notion
- Édition in-place avec historique par champ
- Drafts vs publié
- ❌ Complexité OT/CRDT prohibitive
- ❌ Overkill pour 1-2 admins

## Décision

**Option B — Pré-remplissage + édition libre + diff visuel**.

Rationale :
- Effort raisonnable (~8-12h)
- Migration douce (versions existantes intactes)
- UX intuitive : pattern « Reprendre depuis » connu
- Diff visuel évite désync silencieuse

## Conséquences

### Positives
- Temps de remplissage divisé par 6 (30min → 5min)
- Erreurs de saisie réduites (less manual)
- Audit clair (version stockée = snapshot indépendant)

### Négatives
- Désync possible si admin oublie de re-sync après modif Providers
- Plus de champs visuels à maintenir (indicateurs ✅/⚠)

### Mitigations
- Indicateur de sync visible en permanence
- Bouton « Re-sync depuis Providers » en un clic
- Tooltip explicatif sur les divergences

## Implementation notes

- Route `GET /api/admin/tracking/providers/snapshot` : agrège les pixels
  des providers enabled en un objet plat.
- Prop `seedFrom` du form : `'providers' | 'version' | 'template' | 'empty'`
- Composant `<SyncIndicator>` pour chaque champ : compare `value` vs `providerValue`.

## Schéma de la SnapshotResponse

```typescript
interface ProvidersSnapshot {
  metaPixelId: string | null;
  ga4MeasurementId: string | null;
  googleAdsCustomerId: string | null;
  googleAdsConvLabels: Record<string, string>;
  tiktokPixelId: string | null;
  snapPixelId: string | null;
  pinterestTagId: string | null;
  gtmContainerId: string | null;
  // Métadonnées
  fetchedAt: string;
  providersCount: number;
}
```
