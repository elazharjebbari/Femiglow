# ADR-004 — Rétention 90 jours + agrégation journalière

**Statut** : Accepté
**Date** : 2026-05-13

## Contexte

Le sentinel ping arrive à chaque première-pageview-de-session. Volume estimé :
- ~3 000 sessions/jour en croisière.
- ~3 000 pings/jour, soit ~1.1M / an.
- Chaque ping ≈ 200 bytes en DB → ~220 MB/an si on garde tout.

## Décision

| Donnée | Rétention | Granularité |
|---|---|---|
| `gtm_sentinel_pings` (table principale) | 90 jours rolling | Ping individuel |
| `gtm_sentinel_daily_aggregates` (table agrégée) | Indéfinie | 1 ligne / jour / bundleId |

## Cron de purge

```
0 3 * * *  → /api/cron/sentinel-cleanup
  1. Agrège les pings de J-91 dans gtm_sentinel_daily_aggregates
  2. DELETE FROM gtm_sentinel_pings WHERE received_at < NOW() - INTERVAL '90 days'
```

## Agrégat journalier

```ts
type DailyAggregate = {
  day: string;                          // YYYY-MM-DD
  bundleId: string;                     // hash 12 chars
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  pingsCount: number;                   // nombre de pings reçus ce jour
  driftDetected: boolean;               // au moins 1 ping avec drift ce jour
  firstPingAt: Date;
  lastPingAt: Date;
};
```

## Justification

### Pourquoi 90 jours ?
- Couvre 1 trimestre fiscal pour audit "post-incident".
- Suffisant pour rejouer la chronologie d'un drift complexe.
- Au-delà, le ping individuel n'apporte plus d'info (l'agrégat suffit).

### Pourquoi agréger ?
- Permet d'afficher un graph "drift par jour" sur 12 mois sans charger des millions de lignes.
- Coût stockage négligeable (~1 KB/jour/bundle = ~360 KB/an).

## Conséquences

### Bénéfices
- DB compacte, requêtes rapides sur la table principale.
- Historique long terme pour rapport/audit.

### Trade-offs
- Code double-écriture (insert ping + update agrégat). Mitigé par job nightly idempotent.
