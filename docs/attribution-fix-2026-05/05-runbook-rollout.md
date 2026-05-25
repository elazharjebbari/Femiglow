# 05 — Runbook rollout

## Pré-requis avant A8

- [ ] A0 → A7 mergés sur `master`
- [ ] CI verte (vitest + Playwright)
- [ ] PR review humaine OK
- [ ] Baseline SQL exécuté + résultat archivé
- [ ] Git tag `attribution-baseline-2026-05-22` créé

## Procédure rollout (4 paliers)

### Palier 1 — Internal (0% trafic)

**Durée** : 2h
**Activation** : preview deployment Vercel uniquement
**Vérifs équipe** :
- [ ] `/kit?utm_source=test_internal` → DB row a `traffic_source` rempli
- [ ] `/admin/analytics` montre bucket "Direct" + "Test Internal"
- [ ] Sentry : 0 nouvelle erreur
- [ ] Latence `/api/track` P95 < 200ms

### Palier 2 — Canary (10% trafic)

**Durée** : 24h
**Activation** :
```bash
# Vercel env
NEXT_PUBLIC_ATTRIBUTION_V2=true  # 10% via cookie sticky fg_attr_v2_optin
```

**Métriques à surveiller** :
- pct events avec `traffic_source = NULL` ≤ 10%
- Latence `/api/track` P95 ≤ baseline + 50ms
- Sentry : 0 erreur 500 supplémentaire
- Conv rate kit stable (±5%)

**Gate** : ✅ Canary OK → palier 3. ❌ Sinon **rollback**.

### Palier 3 — Ramp (50% trafic)

**Durée** : 3 j
**Activation** : split edge middleware 50/50
**Mesure** :
- Distribution canaux : ≥ 4 buckets > 5%
- pct NULL ≤ 5% (devrait converger vers 0 après backfill)
- Aucune régression performance

**Gate** : ✅ → palier 4. ❌ → diagnostic + rollback.

### Palier 4 — Full (100% trafic)

**Activation** :
```bash
NEXT_PUBLIC_ATTRIBUTION_V2=true   # 100%
```

Suppression du split middleware. Lancer backfill final pour rattraper les events Canary/Ramp restés en v1.

## Rollback procedure

### Rollback rapide (< 60 sec)

```bash
vercel env rm NEXT_PUBLIC_ATTRIBUTION_V2 --env production
vercel --prod
```

Effet : retour comportement v1 instantané. Le code v1 reste fonctionnel.

### Rollback profond

```bash
git revert <merge-commit>
git push origin master
```

## Monitoring continu

### Dashboard santé

Plausible event `attribution_health` fire 1×/h serveur :
- `pct_null_24h`
- `bucket_distribution`
- `avg_enrich_latency_ms`

### Alerte Sentry

```ts
// Dans /api/track
if (ATTRIBUTION_V2 === 'v2' && !enriched.trafficSource) {
  Sentry.captureMessage('attribution_v2_null', {
    level: 'warning',
    tags: { hasClientHint: !!clientHint, hasDbRow: !!stored },
  });
}
```

Seuil alerte : > 5% events avec `null` après bascule.

### Smoke test post-deploy

```bash
pnpm tsx scripts/smoke-attribution.ts
```

Crée 5 sessions synthétiques (Meta/Google/TikTok/Email/Direct) → vérifie DB rows.

## Timeline

| Jour | Action |
|---|---|
| J+0 | Merge PR `fix/attribution-traffic-source` |
| J+0 | Internal 2h (équipe) |
| J+0 PM | Canary 10% |
| J+1 | Vérif Canary → Ramp 50% si OK |
| J+4 | Vérif Ramp → Full 100% si OK |
| J+5 | Backfill final |
| J+7 | Décision Go/No-Go ferme |
| J+30 | Suppression flag + clean v1 code path |

## Post-mortem (si rollback)

Document `06-postmortem-rollback.md` à créer si applicable :
- Cause racine
- Métrique déclencheuse
- Apprentissages
- Itération v3 envisagée
