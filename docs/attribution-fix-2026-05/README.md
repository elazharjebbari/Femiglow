# Refonte attribution canal — Mai 2026

> **Sprint** : `fix/attribution-traffic-source`
> **Référence audit** : `01-audit-baseline.md`
> **Effort** : ~5-6 j-h dev + 7 j observation

## TL;DR

**Bug** : `/admin/analytics` affiche 100% du trafic en `'direct'` malgré des campagnes Meta/Google/Insta/TikTok actives.

**Cause racine** : les colonnes `traffic_source` et `traffic_medium` de `tracking_events_log` ne sont **jamais écrites** à l'INSERT. Le `/api/track` reçoit pourtant `entry.attribution` validé, mais le pipeline ingest ne le persiste pas.

**Fix structurant** : refactor pour rendre l'attribution **authoritative côté serveur** :
1. Taxonomie unifiée (`TrafficBucket` unique pour tout le repo)
2. Middleware capture exhaustive (UTM + 8 click IDs)
3. Helper `enrichEvent` server-side qui résoud depuis attribution DB + request signals
4. `logEvent` persiste `trafficSource`/`trafficMedium`/`utm`/`referrer`/`fbp`/`fbc` atomiquement
5. Backfill data historique
6. Reporting nettoyé (plus de fallback classifyTraffic)

## Sommaire

| Doc | Sujet |
|---|---|
| `01-audit-baseline.md` | Rapport audit complet — 3 causes racines |
| `02-vision-architecture.md` | Flow cible + diagramme + responsabilités |
| `03-plan-action-phases.md` | A0 → A8 détaillées |
| `04-tests-strategy.md` | Vitest + Playwright + dégradation |
| `05-runbook-rollout.md` | Feature flag + Canary 10% → Ramp 50% → Full |

## Cibles mesurables (J+7)

| KPI | Baseline | Cible |
|---|---|---|
| Events `traffic_source ≠ NULL` | ~0% | ≥ 95% |
| Sessions "direct" | ~100% | ≤ 35% |
| Canaux distincts > 5% trafic | 1 | ≥ 4 |
| Events Meta `_fbc` enrichi | ~0% | ≥ 80% |
